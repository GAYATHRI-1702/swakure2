export async function getCurrentUser(supabase: any) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("User not authenticated.");
  return data.user;
}

export async function getPrescriptionById(supabase: any, prescriptionId: string, userId: string) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("id", prescriptionId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Prescription not found.");
  return data;
}

export async function updatePrescriptionStatus(supabase: any, prescriptionId: string, status: string, stage: string) {
  const { error } = await supabase
    .from("prescriptions")
    .update({ status, processing_stage: stage, processing_started_at: new Date().toISOString() })
    .eq("id", prescriptionId);
  if (error) throw error;
}
