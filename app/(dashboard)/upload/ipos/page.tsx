'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Upload, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { formatCurrency } from '@/lib/constants/currency'

type Step = 'select' | 'preview' | 'success'

interface Store {
  id: string
  name: string
}

interface PreviewPayload {
  storeId: string
  detectedDateRange: { start: string; end: string }
  counts: {
    daily: number
    hourly: number
    payments: number
    products: number
    source: number
  }
  sampleDaily: Array<{
    date: string
    net_revenue: number
    invoice_count: number
    cover_count: number
    gross_revenue?: number
    discount_amount?: number
  }>
  sampleHourly: Array<{ date: string; hour: number; net_revenue: number; invoice_count: number; cover_count: number }>
  sampleProducts: Array<{ date: string; sku_id: string; sku_name: string; quantity_sold: number; net_revenue: number }>
  paymentTotalByDate: Array<{ date: string; total: number }>
  errors: string[]
  warnings: string[]
}

interface FileSlot {
  key: 'sale_summary' | 'payment_methods' | 'items' | 'source'
  title: string
  vietnamese: string
  description: string
  required: boolean
}

const FILE_SLOTS: FileSlot[] = [
  {
    key: 'sale_summary',
    title: 'sale_summary_report.xlsx',
    vietnamese: 'Doanh thu theo ngày & giờ',
    description: 'Daily and hourly revenue, invoice count, cover count.',
    required: true,
  },
  {
    key: 'payment_methods',
    title: 'payment_methods_report.xlsx',
    vietnamese: 'Phương thức thanh toán',
    description: 'VISA / TRANSFER / DEPOSIT / Tiền mặt breakdown per day.',
    required: true,
  },
  {
    key: 'items',
    title: 'items_report.xlsx',
    vietnamese: 'Báo cáo món',
    description: 'SKU-level sales (wide format → one row per SKU per date).',
    required: true,
  },
  {
    key: 'source',
    title: 'source_report.xlsx',
    vietnamese: 'Nguồn TẠI CHỖ',
    description: 'Optional. Adds gross revenue and discounts to daily rows.',
    required: false,
  },
]

export default function IposUploadPage() {
  const [step, setStep] = useState<Step>('select')
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [files, setFiles] = useState<Record<FileSlot['key'], File | null>>({
    sale_summary: null,
    payment_methods: null,
    items: null,
    source: null,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [writeResult, setWriteResult] = useState<{
    written: { daily: number; hourly: number; products: number }
    detectedDateRange: { start: string; end: string }
  } | null>(null)

  useEffect(() => {
    fetch('/api/stores')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const list = (json.data || []) as Store[]
          setStores(list)
          if (list.length > 0) setStoreId(list[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const requiredReady = useMemo(
    () => Boolean(files.sale_summary && files.payment_methods && files.items && storeId),
    [files, storeId],
  )

  function buildFormData(): FormData {
    const fd = new FormData()
    fd.append('store_id', storeId)
    if (files.sale_summary)    fd.append('sale_summary', files.sale_summary)
    if (files.payment_methods) fd.append('payment_methods', files.payment_methods)
    if (files.items)           fd.append('items', files.items)
    if (files.source)          fd.append('source', files.source)
    return fd
  }

  async function handlePreview() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/upload/ipos', { method: 'POST', body: buildFormData() })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Preview failed')
        return
      }
      setPreview(json.data as PreviewPayload)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/upload/ipos/confirm', { method: 'POST', body: buildFormData() })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Confirm failed')
        return
      }
      setWriteResult(json.data)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep('select')
    setFiles({ sale_summary: null, payment_methods: null, items: null, source: null })
    setPreview(null)
    setWriteResult(null)
    setError(null)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">iPOS Upload</h1>
        <StepIndicator step={step} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-700 whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {step === 'select' && (
        <SelectStep
          stores={stores}
          storeId={storeId}
          setStoreId={setStoreId}
          files={files}
          setFiles={setFiles}
          requiredReady={requiredReady}
          busy={busy}
          onPreview={handlePreview}
        />
      )}

      {step === 'preview' && preview && (
        <PreviewStep
          preview={preview}
          busy={busy}
          onBack={() => setStep('select')}
          onConfirm={handleConfirm}
        />
      )}

      {step === 'success' && writeResult && (
        <SuccessStep result={writeResult} onUploadAnother={reset} />
      )}
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'select', label: '1. Select files' },
    { key: 'preview', label: '2. Preview' },
    { key: 'success', label: '3. Done' },
  ]
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const active = s.key === step
        const passed =
          (step === 'preview' && s.key === 'select') ||
          (step === 'success' && (s.key === 'select' || s.key === 'preview'))
        return (
          <span
            key={s.key}
            className={
              active
                ? 'px-2 py-1 rounded bg-blue-600 text-white'
                : passed
                ? 'px-2 py-1 rounded bg-emerald-100 text-emerald-700'
                : 'px-2 py-1 rounded bg-slate-100 text-slate-500'
            }
          >
            {s.label}
            {i < steps.length - 1 && <span className="ml-2 text-slate-300">›</span>}
          </span>
        )
      })}
    </div>
  )
}

function SelectStep(props: {
  stores: Store[]
  storeId: string
  setStoreId: (id: string) => void
  files: Record<FileSlot['key'], File | null>
  setFiles: (f: Record<FileSlot['key'], File | null>) => void
  requiredReady: boolean
  busy: boolean
  onPreview: () => void
}) {
  const { stores, storeId, setStoreId, files, setFiles, requiredReady, busy, onPreview } = props
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Store</label>
        <select
          value={storeId}
          onChange={e => setStoreId(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {stores.length === 0 && <option value="">Loading…</option>}
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FILE_SLOTS.map(slot => (
          <DropzoneSlot
            key={slot.key}
            slot={slot}
            file={files[slot.key]}
            onSelect={file => setFiles({ ...files, [slot.key]: file })}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onPreview}
          disabled={!requiredReady || busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Preview Data
        </button>
      </div>
    </div>
  )
}

function DropzoneSlot({
  slot,
  file,
  onSelect,
}: {
  slot: FileSlot
  file: File | null
  onSelect: (file: File | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onSelect(f)
      }}
      className={
        'rounded-xl border-2 border-dashed p-5 transition-colors ' +
        (dragOver
          ? 'border-blue-500 bg-blue-50'
          : file
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-slate-300')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-slate-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 truncate">{slot.title}</span>
            {slot.required ? (
              <span className="text-[10px] uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Required</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Optional</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">{slot.vietnamese}</div>
          <div className="text-xs text-slate-400 mt-1">{slot.description}</div>
        </div>
      </div>

      <div className="mt-3">
        {file ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-700 flex items-center gap-1.5 min-w-0 truncate">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="truncate">{file.name}</span>
            </span>
            <button
              onClick={() => onSelect(null)}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-700">
            Drag & drop, or click to browse
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onSelect(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

function PreviewStep({
  preview,
  busy,
  onBack,
  onConfirm,
}: {
  preview: PreviewPayload
  busy: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const { detectedDateRange, counts, sampleDaily, sampleHourly, sampleProducts, errors, warnings } = preview
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm text-slate-500">Detected date range</div>
        <div className="text-2xl font-semibold text-slate-900 mt-1">
          {detectedDateRange.start && detectedDateRange.end
            ? `${detectedDateRange.start} → ${detectedDateRange.end}`
            : 'Could not detect a date range'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Daily" value={counts.daily} />
        <Stat label="Hourly" value={counts.hourly} />
        <Stat label="Payments" value={counts.payments} />
        <Stat label="Products" value={counts.products} />
        <Stat label="Source" value={counts.source} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="text-sm font-medium text-amber-800 flex items-center gap-2">
            <AlertTriangle size={16} /> Warnings
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="text-sm text-amber-700">• {w}</div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
          <div className="text-sm font-medium text-red-800 flex items-center gap-2">
            <AlertTriangle size={16} /> Parser errors
          </div>
          {errors.map((e, i) => (
            <div key={i} className="text-sm text-red-700">• {e}</div>
          ))}
        </div>
      )}

      <SampleTable
        title={`Sample daily rows (first ${sampleDaily.length})`}
        columns={['Ngày', 'Net revenue', 'Gross revenue', 'Discount', 'Hoá đơn', 'Khách']}
        rows={sampleDaily.map(r => [
          r.date,
          formatCurrency(r.net_revenue),
          r.gross_revenue != null ? formatCurrency(r.gross_revenue) : '—',
          r.discount_amount != null ? formatCurrency(r.discount_amount) : '—',
          String(r.invoice_count),
          String(r.cover_count),
        ])}
      />

      <SampleTable
        title={`Sample hourly rows (first ${sampleHourly.length})`}
        columns={['Date', 'Giờ', 'Net revenue', 'Hoá đơn', 'Khách']}
        rows={sampleHourly.map(r => [
          r.date,
          `${r.hour}h`,
          formatCurrency(r.net_revenue),
          String(r.invoice_count),
          String(r.cover_count),
        ])}
      />

      <SampleTable
        title={`Sample product rows (first ${sampleProducts.length})`}
        columns={['Date', 'Mã món', 'Tên món', 'Đã bán', 'Net revenue']}
        rows={sampleProducts.map(r => [
          r.date,
          r.sku_id,
          r.sku_name,
          String(r.quantity_sold),
          formatCurrency(r.net_revenue),
        ])}
      />

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || (counts.daily === 0 && counts.products === 0)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Confirm & Save
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900 mt-0.5">{value}</div>
    </div>
  )
}

function SampleTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  if (rows.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm font-medium text-slate-700 mb-3">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map(c => (
                <th key={c} className="text-left py-2 px-2 text-slate-500 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                {r.map((cell, j) => (
                  <td key={j} className="py-2 px-2 text-slate-800">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SuccessStep({
  result,
  onUploadAnother,
}: {
  result: { written: { daily: number; hourly: number; products: number }; detectedDateRange: { start: string; end: string } }
  onUploadAnother: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center space-y-4">
      <div className="flex justify-center">
        <CheckCircle2 size={48} className="text-emerald-500" />
      </div>
      <div className="text-lg font-semibold text-slate-900">Upload saved</div>
      <div className="text-sm text-slate-600">
        Saved {result.written.daily} daily rows, {result.written.hourly} hourly rows, and{' '}
        {result.written.products} product rows for{' '}
        <span className="font-medium">
          {result.detectedDateRange.start} → {result.detectedDateRange.end}
        </span>
        .
      </div>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          View dashboard
        </Link>
        <button
          onClick={onUploadAnother}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
        >
          Upload another
        </button>
      </div>
    </div>
  )
}
