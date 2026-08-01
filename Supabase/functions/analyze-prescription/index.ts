import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getCurrentUser, getPrescriptionById, updatePrescriptionStatus } from "./database.ts";
import { downloadPrescriptionFile } from "./storage.ts";
import { AnalyzePrescriptionRequest } from "./types.ts";

export default {
  fetch: withSupabase(
    { auth: ["user"] },
    async (req, ctx) => {
      try {
        const body: AnalyzePrescriptionRequest = await req.json();

        if (!body.prescriptionId) {
          return Response.json({ success: false, message: "Prescription ID is required." }, { status: 400 });
        }

        const user = await getCurrentUser(ctx.supabase);
        const prescription = await getPrescriptionById(ctx.supabase, body.prescriptionId, user.id);

        await updatePrescriptionStatus(ctx.supabase, prescription.id, "processing", "quality_check");

        if (!prescription.storage_path) {
          return Response.json({ success: false, message: "Prescription file path is missing." }, { status: 422 });
        }

        const file = await downloadPrescriptionFile(ctx.supabase, prescription.storage_path);

        // TODO: OCR (Google Cloud Vision) → AI Analysis (Google Gemini) → Medicine Extraction → Reminder Generation

        return Response.json({
          success: true,
          message: "Prescription downloaded successfully.",
          data: {
            prescriptionId: prescription.id,
            filename: prescription.original_filename,
            mimeType: prescription.mime_type,
            size: file.size,
          },
        });
      } catch (error) {
        console.error(error);
        return Response.json(
          { success: false, message: error instanceof Error ? error.message : "Unknown error occurred." },
          { status: 500 }
        );
      }
    }
  ),
};
