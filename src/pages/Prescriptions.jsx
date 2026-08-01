import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/LanguageContext'
import { FileText, Upload, Loader2, CheckCircle, Trash2, X, AlertCircle, Clock, Image } from 'lucide-react'
import { format } from 'date-fns'

const STAGES = ['upload', 'quality_check', 'ocr', 'ai_analysis', 'reminders', 'completed']

const STAGE_LABELS = {
  upload: 'Uploaded',
  quality_check: 'Quality Check',
  ocr: 'Reading Text',
  ai_analysis: 'AI Analysis',
  reminders: 'Creating Reminders',
  completed: 'Completed',
}

function ProgressBar({ stage, status }) {
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 rounded-xl">
        <AlertCircle size={16} className="text-red-500 shrink-0" />
        <p className="text-xs text-red-600">Processing failed. Please try uploading again.</p>
      </div>
    )
  }

  const currentIndex = STAGES.indexOf(stage)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              i < currentIndex ? 'bg-primary' :
              i === currentIndex ? 'bg-primary animate-pulse' :
              'bg-border'
            }`} />
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-0.5 ${i < currentIndex ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {status === 'completed' ? '✓ All done' : `Processing: ${STAGE_LABELS[stage] ?? stage}`}
      </p>
    </div>
  )
}

function ImagePreview({ storagePath }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!storagePath) return
    supabase.storage.from('prescriptions').createSignedUrl(storagePath, 60).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl)
    })
  }, [storagePath])

  if (!url) return (
    <div className="w-full h-40 bg-muted rounded-xl flex items-center justify-center">
      <Image size={24} className="text-muted-foreground" />
    </div>
  )

  return (
    <img
      src={url}
      alt="Prescription"
      className="w-full rounded-xl object-contain max-h-64 bg-muted"
      onError={() => setUrl(null)}
    />
  )
}

function DetailModal({ prescription, onClose, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Prescription Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {prescription.mime_type?.startsWith('image/') && (
            <ImagePreview storagePath={prescription.storage_path} />
          )}

          <div className="space-y-3">
            {[
              { label: 'File', value: prescription.original_filename },
              { label: 'Type', value: prescription.mime_type },
              { label: 'Size', value: `${(prescription.file_size / 1024).toFixed(1)} KB` },
              { label: 'Uploaded', value: format(new Date(prescription.created_at), 'dd MMM yyyy HH:mm') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
              </div>
            ))}

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                prescription.status === 'completed' ? 'bg-green-100 text-green-700' :
                prescription.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {prescription.status}
              </span>
            </div>
          </div>

          <ProgressBar stage={prescription.processing_stage} status={prescription.status} />

          {prescription.ai_summary && (
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">AI Summary</p>
              <p className="text-sm">{prescription.ai_summary}</p>
            </div>
          )}

          {prescription.medicines && prescription.medicines.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Medicines</p>
              <div className="space-y-2">
                {prescription.medicines.map((m, i) => (
                  <div key={i} className="bg-muted/50 rounded-xl p-3">
                    <p className="font-medium text-sm">{m.name}</p>
                    {m.dosage && <p className="text-xs text-muted-foreground">Dosage: {m.dosage}</p>}
                    {m.frequency && <p className="text-xs text-muted-foreground">Frequency: {m.frequency}</p>}
                    {m.duration && <p className="text-xs text-muted-foreground">Duration: {m.duration}</p>}
                    {m.timing && <p className="text-xs text-muted-foreground">Timing: {m.timing}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prescription.food_reminders && prescription.food_reminders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Food Instructions</p>
              <ul className="space-y-1">
                {prescription.food_reminders.map((f, i) => (
                  <li key={i} className="text-sm flex gap-2"><span>•</span>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => onDelete(prescription.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={16} />
            Delete Prescription
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Prescriptions() {
  const { tr } = useLanguage()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (title, description, variant = 'default') => {
    setToast({ title, description, variant })
    setTimeout(() => setToast(null), 4000)
  }

  const { data: prescriptions = [], refetch } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      const processing = items.some(p => p.status !== 'completed' && p.status !== 'failed')
      return processing ? 3000 : false
    },
  })

  // Keep selected in sync with live data
  const selectedId = selected?.id
  useEffect(() => {
    if (selectedId) {
      const updated = prescriptions.find(p => p.id === selectedId)
      if (updated) setSelected(updated)
    }
  }, [prescriptions, selectedId])

  const { mutate: deletePrescription } = useMutation({
    mutationFn: async (id) => {
      const prescription = prescriptions.find(p => p.id === id)
      if (prescription?.storage_path) {
        await supabase.storage.from('prescriptions').remove([prescription.storage_path])
      }
      const { error } = await supabase.from('prescriptions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] })
      setSelected(null)
      showToast('Deleted', 'Prescription removed successfully.')
    },
    onError: (e) => showToast('Delete failed', e.message, 'destructive'),
  })

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      showToast('File too large', 'Maximum file size is 5MB.', 'destructive')
      e.target.value = ''
      return
    }

    try {
      setUploading(true)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('User not authenticated.')

      const extension = file.name.split('.').pop()
      const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage.from('prescriptions').upload(storagePath, file)
      if (uploadError) throw uploadError

      const { data: prescription, error: insertError } = await supabase
        .from('prescriptions')
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          page_count: 1,
          status: 'uploaded',
          processing_stage: 'upload',
        })
        .select()
        .single()

      if (insertError) throw insertError

      const { data: { session } } = await supabase.auth.getSession()

      const { error: functionError } = await supabase.functions.invoke('analyze-prescription', {
        body: { prescriptionId: prescription.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })

      if (functionError) throw functionError

      const { data: refreshed } = await refetch()
      setSelected(refreshed?.find(p => p.id === prescription.id) ?? prescription)

      showToast('Prescription uploaded', 'Analysis has started. This may take a few moments.')
    } catch (err) {
      showToast('Upload failed', err.message ?? 'Unable to upload prescription.', 'destructive')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const processing = prescriptions.some(p => p.status !== 'completed' && p.status !== 'failed')

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl p-4 shadow-lg max-w-sm ${toast.variant === 'destructive' ? 'bg-red-50 border border-red-200' : 'bg-white border border-border'}`}>
          <p className="font-medium text-sm">{toast.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{toast.description}</p>
        </div>
      )}

      {selected && (
        <DetailModal
          prescription={selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => deletePrescription(id)}
        />
      )}

      <div>
        <h1 className="font-poppins font-bold text-2xl text-foreground">{tr('prescriptions')}</h1>
        <p className="text-muted-foreground text-sm">Upload a prescription to extract medicines and create reminders.</p>
      </div>

      {processing && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700">A prescription is being processed. This page updates automatically.</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-8">
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading prescription...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload size={40} className="mx-auto mb-4 text-primary" />
            <p className="font-semibold text-center">Upload Prescription</p>
            <p className="text-sm text-center text-muted-foreground mt-2 mb-5">JPG, PNG and PDF supported · Max 5MB</p>
            <label className="cursor-pointer">
              <span className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                {tr('uploadPrescription')}
              </span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} />
          <h2 className="font-semibold">Prescription History</h2>
          <span className="ml-auto text-xs text-muted-foreground">{prescriptions.length} total</span>
        </div>

        {prescriptions.length === 0 ? (
          <div className="text-center py-10">
            <FileText size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">No prescriptions uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className="border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1 min-w-0 mr-3">
                    <h4 className="font-medium text-sm truncate">{p.original_filename}</h4>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status !== 'completed' && p.status !== 'failed' && (
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                    )}
                    {p.status === 'failed' && <AlertCircle size={14} className="text-red-500" />}
                    {p.status === 'completed' && <CheckCircle size={14} className="text-green-500" />}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' :
                      p.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>

                <ProgressBar stage={p.processing_stage} status={p.status} />

                <div className="mt-2 flex flex-wrap gap-2">
                  {p.mime_type && <span className="text-xs border border-border rounded-full px-2.5 py-1">{p.mime_type}</span>}
                  {p.file_size && <span className="text-xs border border-border rounded-full px-2.5 py-1">{(p.file_size / 1024).toFixed(1)} KB</span>}
                  {p.medicines?.length > 0 && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">{p.medicines.length} medicines</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
