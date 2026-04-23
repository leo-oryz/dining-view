import * as XLSX from 'xlsx'

interface ParseError {
  row: number
  field: string
  message: string
}

export interface PayrollRecord {
  employee_id: string
  name: string
  department: string | null
  job_title: string | null
  total_payable: number
  actual_hours: number
  overtime_hours: number | null
  employment_type: 'part_time' | 'full_time'
}

export interface PayrollParseResult {
  year: number
  month: number
  records: PayrollRecord[]
  errors: ParseError[]
}

const HEADER_KEYS = {
  employee_id: '員工編號',
  department: '部門名稱',
  job_title: '職稱',
  name: '員工姓名',
  total_payable: '薪資總覽',      // matches "薪資總覽 - 應付合計"
  actual_hours: '實際天數/時數',
  overtime: '加班費',             // matches "加班費 (加班時數)"
}

/**
 * Extract year + month from the filename, e.g. "綠洲餐飲-2026-03薪資.xls" → {2026, 3}.
 */
export function inferPeriodFromFilename(fileName: string): { year: number; month: number } | null {
  const m = fileName.match(/(\d{4})[-_](\d{1,2})/)
  if (!m) return null
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  const cleaned = String(v).replace(/,/g, '').trim()
  if (!cleaned || cleaned === '-') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function parsePayrollXls(
  buffer: ArrayBuffer,
  fileName: string,
): PayrollParseResult {
  const errors: ParseError[] = []
  const records: PayrollRecord[] = []

  const period = inferPeriodFromFilename(fileName)
  if (!period) {
    errors.push({ row: 0, field: 'filename', message: `Cannot infer YYYY-MM from filename: ${fileName}` })
    return { year: 0, month: 0, records, errors }
  }

  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    errors.push({ row: 0, field: 'sheet', message: 'No sheet found' })
    return { ...period, records, errors }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown as unknown[][]
  if (rows.length < 2) {
    errors.push({ row: 0, field: 'rows', message: 'No data rows' })
    return { ...period, records, errors }
  }

  // Map header column indices
  const header = rows[0].map(c => String(c ?? '').trim())
  const idx: Record<keyof typeof HEADER_KEYS, number> = {
    employee_id: -1, department: -1, job_title: -1, name: -1,
    total_payable: -1, actual_hours: -1, overtime: -1,
  }
  for (const [key, match] of Object.entries(HEADER_KEYS) as [keyof typeof HEADER_KEYS, string][]) {
    const i = header.findIndex(h => h.includes(match))
    if (i === -1) {
      errors.push({ row: 0, field: key, message: `Header "${match}" not found` })
      return { ...period, records, errors }
    }
    idx[key] = i
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row[idx.employee_id]) continue

    const employeeIdRaw = row[idx.employee_id]
    const employeeId = String(employeeIdRaw).trim()
    if (!employeeId) continue

    const totalPayable = toNumber(row[idx.total_payable])
    const actualHours = toNumber(row[idx.actual_hours])
    if (totalPayable == null || actualHours == null) {
      errors.push({ row: r, field: 'total_payable/actual_hours', message: `Missing numbers for ${employeeId}` })
      continue
    }

    const jobTitleRaw = row[idx.job_title]
    const jobTitle = jobTitleRaw ? String(jobTitleRaw).trim() : null
    const employmentType: 'part_time' | 'full_time' =
      jobTitle && /part[\s_-]*time/i.test(jobTitle) ? 'part_time' : 'full_time'

    records.push({
      employee_id: employeeId,
      name: String(row[idx.name] ?? '').trim(),
      department: row[idx.department] ? String(row[idx.department]).trim() : null,
      job_title: jobTitle,
      total_payable: totalPayable,
      actual_hours: actualHours,
      overtime_hours: toNumber(row[idx.overtime]),
      employment_type: employmentType,
    })
  }

  return { ...period, records, errors }
}
