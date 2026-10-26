import type { PipelineStore } from "./pipeline.ts";
import type { PrescriptionStage, PrescriptionStatus, ValidatedAnalysis } from "./types.ts";

// A run still "processing" after this long is treated as dead and may be restarted.
// Longer than the Edge Function wall-clock limit (150s free / 400s paid), so a live run is never taken over.
export const STALE_PROCESSING_MS = 7 * 60 * 1000;

export async function getCurrentUser(supabase: any) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("User not authenticated.");
  return data.user;
}

// Uses the caller's (user-scoped) client, so RLS plus the explicit user_id filter prove ownership.
// Returns null when the prescription does not exist or belongs to someone else.
export async function getPrescriptionById(supabase: any, prescriptionId: string, userId: string) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("id", prescriptionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Malformed ids (not a uuid) are treated as "not found" rather than a server error.
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ?? null;
}

export async function updatePrescriptionStatus(
  supabase: any,
  prescriptionId: string,
  status: PrescriptionStatus,
  stage: PrescriptionStage,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("prescriptions")
    .update({ status, processing_stage: stage, ...extra })
    .eq("id", prescriptionId);
  if (error) throw error;
}

async function must<T>(promise: PromiseLike<{ data: T; error: any }>, what: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`Could not ${what}: ${error.message}`);
  return data;
}

// Store writes for one prescription. `db` must be the service-role (admin) client: ownership has already
// been checked with the user's client, and every write is scoped to this prescription id.
export function createStore(db: any, prescriptionId: string, now: () => number = Date.now): PipelineStore {
  return {
    async claim() {
      const staleBefore = new Date(now() - STALE_PROCESSING_MS).toISOString();
      // Single conditional UPDATE, so two concurrent runs cannot both claim the same prescription.
      const { data, error } = await db
        .from("prescriptions")
        .update({
          status: "processing",
          processing_stage: "upload",
          processing_started_at: new Date(now()).toISOString(),
          completed_at: null,
        })
        .eq("id", prescriptionId)
        .or(
          `status.in.(uploaded,failed),and(status.eq.processing,or(processing_started_at.is.null,processing_started_at.lt.${staleBefore}))`,
        )
        .select("id");
      if (error) throw new Error(`Could not start analysis: ${error.message}`);
      return Array.isArray(data) && data.length === 1;
    },

    async clearResults() {
      // Children first: prescription_medicines.analysis_id may reference prescription_analysis.
      await must(db.from("prescription_medicines").delete().eq("prescription_id", prescriptionId), "clear old medicines");
      await must(db.from("prescription_analysis").delete().eq("prescription_id", prescriptionId), "clear old analysis");
      await must(db.from("prescription_ocr_results").delete().eq("prescription_id", prescriptionId), "clear old OCR results");
    },

    async setStage(stage) {
      await updatePrescriptionStatus(db, prescriptionId, "processing", stage);
    },

    async saveOcr(rawText, confidence) {
      await must(
        db.from("prescription_ocr_results").insert({ prescription_id: prescriptionId, raw_text: rawText, confidence }),
        "save OCR results",
      );
    },

    async saveAnalysis(analysis: ValidatedAnalysis, modelName: string) {
      const saved = await must(
        db.from("prescription_analysis").insert({
          prescription_id: prescriptionId,
          doctor_name: analysis.doctor_name,
          hospital_name: analysis.hospital_name,
          diagnosis: analysis.diagnosis,
          food_instructions: analysis.food_instructions,
          follow_up_instructions: analysis.follow_up_instructions,
          warnings: analysis.warnings,
          model_name: modelName,
        }).select("id").single(),
        "save the analysis",
      ) as { id: string };

      if (analysis.medicines.length > 0) {
        // One multi-row INSERT: PostgREST runs it as a single statement, so it is all-or-nothing.
        await must(
          db.from("prescription_medicines").insert(
            analysis.medicines.map((m) => ({ ...m, prescription_id: prescriptionId, analysis_id: saved.id })),
          ),
          "save the medicines",
        );
      }
    },

    async markCompleted(qualityScore) {
      await updatePrescriptionStatus(db, prescriptionId, "completed", "completed", {
        completed_at: new Date(now()).toISOString(),
        quality_score: qualityScore,
      });
    },

    async markFailed(options = {}) {
      let query = db.from("prescriptions").update({ status: "failed" }).eq("id", prescriptionId);
      if (options.onlyIfUnclaimed) query = query.eq("status", "uploaded");
      const { error } = await query;
      if (error) throw error;
    },
  };
}
