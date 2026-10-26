export interface AnalyzePrescriptionRequest {
  prescriptionId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PrescriptionRecord {
  id: string;
  user_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: string;
  processing_stage: string;
}

// Values of the prescription_status / prescription_stage enums in the database.
export type PrescriptionStatus = "uploaded" | "processing" | "completed" | "failed" | "cancelled";
export type PrescriptionStage =
  | "upload"
  | "quality_check"
  | "ocr"
  | "ai_analysis"
  | "medicine_extraction"
  | "reminder_generation"
  | "completed";

// Raw (untrusted) output of the AI extraction step.
export interface ExtractedMedicine {
  medicine_name?: unknown;
  generic_name?: unknown;
  strength?: unknown;
  dosage?: unknown;
  frequency?: unknown;
  duration?: unknown;
  route?: unknown;
  quantity?: unknown;
  instructions?: unknown;
  confidence?: unknown;
}

export interface ExtractionResult {
  doctor_name?: unknown;
  hospital_name?: unknown;
  diagnosis?: unknown;
  food_instructions?: unknown;
  follow_up_instructions?: unknown;
  warnings?: unknown[];
  medicines?: ExtractedMedicine[];
}

// Columns of public.prescription_medicines written by this function.
export interface MedicineRow {
  medicine_name: string;
  generic_name: string | null;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number | null;
  confidence: number | null;
}

export interface ValidatedAnalysis {
  doctor_name: string | null;
  hospital_name: string | null;
  diagnosis: string | null;
  food_instructions: string | null;
  follow_up_instructions: string | null;
  warnings: string[];
  medicines: MedicineRow[];
}
