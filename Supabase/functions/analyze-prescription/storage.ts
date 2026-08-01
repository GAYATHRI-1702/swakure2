export async function downloadPrescriptionFile(supabase: any, storagePath: string) {
  const { data, error } = await supabase.storage.from("prescriptions").download(storagePath);
  if (error) throw error;
  if (!data) throw new Error("Prescription file not found.");
  return data;
}
