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
