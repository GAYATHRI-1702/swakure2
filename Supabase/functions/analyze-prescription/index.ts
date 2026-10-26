import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createStore, getCurrentUser, getPrescriptionById, updatePrescriptionStatus } from "./database.ts";
import { downloadPrescriptionFile } from "./storage.ts";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  extractFromTranscript,
  resolveApiBase,
  transcribePrescription,
} from "./gemini.ts";
import { runPipeline } from "./pipeline.ts";
import type { AnalyzePrescriptionRequest } from "./types.ts";

// Stop starting new AI requests after this long, so the function ends cleanly (and marks the prescription
// failed) before the platform's 150s wall-clock limit kills it mid-write.
const TIME_BUDGET_MS = 120_000;

// Logs operational messages only. Never pass prescription text, file contents or AI output here.
const log = (message: string) => console.error(`[analyze-prescription] ${message}`);
const info = (message: string) => console.log(`[analyze-prescription] ${message}`);

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default {
  fetch: withSupabase(
    { auth: ["user"] },
    async (req, ctx) => {
      const startedAt = Date.now();
      try {
        if (req.method !== "POST") return json({ success: false, message: "Method not allowed." }, 405);
        const body = await req.json().catch(() => ({})) as Partial<AnalyzePrescriptionRequest>;
        if (typeof body.prescriptionId !== "string" || !body.prescriptionId) {
          return json({ success: false, message: "Prescription ID is required." }, 400);
        }

        // Ownership check with the caller's own RLS-scoped client.
        const user = await getCurrentUser(ctx.supabase);
        const prescription = await getPrescriptionById(ctx.supabase, body.prescriptionId, user.id);
        if (!prescription) return json({ success: false, message: "Prescription not found." }, 404);

        if (prescription.status === "completed") {
          return json({
            success: true,
            message: "Prescription was already analysed.",
            data: { prescriptionId: prescription.id, alreadyCompleted: true },
          });
        }
        if (prescription.status === "cancelled") {
          return json({ success: false, message: "This prescription was cancelled." }, 409);
        }

        // Admin (service-role) client from @supabase/server: server-side only, used for writes scoped to
        // this prescription after the ownership check above.
        const admin = ctx.supabaseAdmin;

        const apiKey = Deno.env.get("GEMINI_API_KEY");
        let apiBase: string | null = null;
        try {
          apiBase = resolveApiBase(Deno.env.get("GEMINI_API_BASE"));
        } catch { /* reported below */ }

        const setupProblem = !apiKey
          ? { log: "GEMINI_API_KEY not set", message: "Prescription analysis is not configured yet (missing GEMINI_API_KEY).", status: 503 }
          : !apiBase
          ? { log: "GEMINI_API_BASE is not allowed", message: "Prescription analysis is misconfigured.", status: 503 }
          : !prescription.storage_path
          ? { log: "storage_path missing", message: "Prescription file path is missing.", status: 422 }
          : null;
        if (setupProblem) {
          log(`${prescription.id}: ${setupProblem.log}`);
          // Mark failed so the app stops polling; never touch a row another run is processing.
          if (prescription.status !== "processing") {
            await updatePrescriptionStatus(admin, prescription.id, "failed", "upload").catch(() => {});
          }
          return json({ success: false, message: setupProblem.message }, setupProblem.status);
        }

        const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
        const timeoutEnv = Number(Deno.env.get("GEMINI_TIMEOUT_MS"));
        const gemini = {
          apiKey: apiKey as string,
          model,
          apiBase: apiBase as string,
          requestTimeoutMs: Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? timeoutEnv : DEFAULT_REQUEST_TIMEOUT_MS,
          deadline: startedAt + TIME_BUDGET_MS,
        };

        const result = await runPipeline(
          { mimeType: prescription.mime_type ?? "", fileSize: prescription.file_size ?? 0, modelName: model },
          createStore(admin, prescription.id),
          {
            // Download with the user's client so storage RLS also applies to the file.
            download: async () => {
              const file = await downloadPrescriptionFile(ctx.supabase, prescription.storage_path);
              return new Uint8Array(await file.arrayBuffer());
            },
            transcribe: (file) => transcribePrescription(gemini, file),
            extract: (transcript) => extractFromTranscript(gemini, transcript),
            log: (message) => log(`${prescription.id}: ${message}`),
          },
        );

        if (!result.ok) {
          log(`${prescription.id}: failed with ${result.status}: ${result.message}`);
          return json({ success: false, message: result.message }, result.status);
        }

        info(`${prescription.id}: completed in ${Date.now() - startedAt}ms, ${result.medicineCount} medicines`);
        return json({
          success: true,
          message: result.medicineCount > 0
            ? `Found ${result.medicineCount} medicine${result.medicineCount === 1 ? "" : "s"}. Please review them before creating reminders.`
            : "Analysis finished, but no medicines could be confirmed from the prescription.",
          data: { prescriptionId: prescription.id, medicineCount: result.medicineCount, warnings: result.warnings },
        });
      } catch (error) {
        log(`unexpected error: ${error instanceof Error ? error.message : "unknown"}`);
        return json({ success: false, message: "Prescription analysis failed unexpectedly. Please try again." }, 500);
      }
    },
  ),
};
