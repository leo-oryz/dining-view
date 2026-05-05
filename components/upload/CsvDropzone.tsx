'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface UploadResult {
  success: boolean
  data?: { imported: number; errors: Array<{ row: number; field: string; message: string }> }
  error?: string
}

const FILE_TYPE_MAP: Record<string, { endpoint: string; label: string; accept: string }> = {
  'nueip-schedule': { endpoint: '/api/labor/upload', label: 'NUEIP Schedule', accept: '.xlsx' },
  'payroll': { endpoint: '/api/upload/payroll', label: 'Monthly Payroll', accept: '.xls,.xlsx' },
}

export function CsvDropzone() {
  const [selectedType, setSelectedType] = useState('nueip-schedule')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setResult(null)

    const config = FILE_TYPE_MAP[selectedType]
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      setResult(json)
    } catch {
      setResult({ success: false, error: 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }, [selectedType])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }, [uploadFile])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Report Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setResult(null) }}
          className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="Labor">
            <option value="nueip-schedule">NUEIP Schedule (.xlsx)</option>
            <option value="payroll">Monthly Payroll (.xls)</option>
          </optgroup>
        </select>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400',
          uploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept={FILE_TYPE_MAP[selectedType].accept}
          onChange={handleFileInput}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
            <p className="text-sm text-slate-500">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={32} className="text-slate-400" />
            <p className="text-sm text-slate-600">
              Drag a file here or <span className="text-blue-600 font-medium">click to select</span>
            </p>
            <p className="text-xs text-slate-400">
              {FILE_TYPE_MAP[selectedType].label} ({FILE_TYPE_MAP[selectedType].accept})
            </p>
          </div>
        )}
      </div>

      {result && (
        <div
          className={clsx(
            'rounded-lg p-4',
            result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          )}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle size={18} className="text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-red-500 mt-0.5" />
            )}
            <div>
              {result.success ? (
                <>
                  <p className="text-sm font-medium text-emerald-800">
                    Imported {result.data?.imported} records
                  </p>
                  {result.data?.errors && result.data.errors.length > 0 && (
                    <div className="mt-2 text-xs text-amber-700">
                      <p className="font-medium">{result.data.errors.length} warnings:</p>
                      <ul className="mt-1 space-y-0.5">
                        {result.data.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>Row {err.row}: {err.message}</li>
                        ))}
                        {result.data.errors.length > 5 && (
                          <li>... {result.data.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium text-red-800">{result.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
