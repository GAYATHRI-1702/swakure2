// Orchestrates prescription analysis. All I/O is injected so the flow can be unit tested without Deno,
// Supabase or Gemini.
//
// Consistency rule: a prescription only has OCR/analysis/medicine rows when its status is "completed".
// Results are cleared when a run starts and again if it fails.

import type { ExtractionResult, PrescriptionStage, ValidatedAnalysis } from "./types.ts";
import { checkFile, checkTranscript, validateExtraction } from "./validation.ts";

export interface PipelineStore {
  // Atomically mark the prescription as processing. Returns false if another run owns it.
  claim(): Promise<boolean>;
  // Delete OCR, analysis and medicine rows for this prescription.
  clearResults(): Promise<void>;
  setStage(stage: PrescriptionStage): Promise<void>;
  saveOcr(rawText: string, confidence: number | null): Promise<void>;
  saveAnalysis(analysis: ValidatedAnalysis, modelName: string): Promise<void>;
  markCompleted(qualityScore: number | null): Promise<void>;
  // onlyIfUnclaimed: only change a row that is still "uploaded", so an active run is never overwritten.
  markFailed(options?: { onlyIfUnclaimed?: boolean }): Promise<void>;
}

export interface PipelineServices {
  download(): Promise<Uint8Array>;
  transcribe(file: { mimeType: string; bytes: Uint8Array }): Promise<{ raw_text?: unknown; legibility?: unknown }>;
  extract(transcript: string): Promise<ExtractionResult>;
  // Logs a short operational message. Must never receive prescription content.
  log?(message: string): void;
}

export interface PipelineInput {
  mimeType: string;
  fileSize: number;
  modelName: string;
}

export type PipelineResult =
  | { ok: true; medicineCount: number; warnings: string[] }
  | { ok: false; status: number; message: string };

export class UserFacingError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

export async function runPipeline(
  input: PipelineInput,
  store: PipelineStore,
  services: PipelineServices,
): Promise<PipelineResult> {
  let claimed: boolean;
  try {
    claimed = await store.claim();
  } catch (e) {
    services.log?.(`could not start analysis: ${e instanceof Error ? e.message : "unknown error"}`);
    // Stop the app polling forever, without touching a row another run may own.
    try {
      await store.markFailed({ onlyIfUnclaimed: true });
    } catch { /* already logged the cause */ }
    return { ok: false, status: 503, message: "Prescription analysis is temporarily unavailable. Please try again later." };
  }
  if (!claimed) {
    return { ok: false, status: 409, message: "This prescription is already being analysed." };
  }

  try {
    await store.clearResults();

    await store.setStage("quality_check");
    const bytes = await services.download();
    const fileProblem = checkFile({ mimeType: input.mimeType, size: input.fileSize || bytes.length, bytes });
    if (fileProblem) throw new UserFacingError(fileProblem);

    await store.setStage("ocr");
    const ocr = await services.transcribe({ mimeType: input.mimeType.toLowerCase(), bytes });
    const transcript = checkTranscript(ocr);
    if ("error" in transcript) throw new UserFacingError(transcript.error);
    await store.saveOcr(transcript.text, transcript.legibility);

    await store.setStage("ai_analysis");
    const extracted = await services.extract(transcript.text);

    await store.setStage("medicine_extraction");
    const analysis = validateExtraction(extracted, transcript.text);
    await store.saveAnalysis(analysis, input.modelName);

    await store.markCompleted(transcript.legibility);
    return { ok: true, medicineCount: analysis.medicines.length, warnings: analysis.warnings };
  } catch (error) {
    // Roll back: remove partial results first, then mark failed. Each step is attempted even if the
    // other fails, and neither may hide the original error.
    try {
      await store.clearResults();
    } catch (e) {
      services.log?.(`cleanup after failure did not complete: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    try {
      await store.markFailed();
    } catch (e) {
      services.log?.(`could not mark prescription as failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    if (error instanceof UserFacingError) return { ok: false, status: error.status, message: error.message };
    const message = error instanceof Error ? error.message : "Unknown error occurred.";
    return { ok: false, status: 502, message: `Prescription analysis failed: ${message}` };
  }
}
