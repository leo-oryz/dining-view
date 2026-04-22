import * as XLSX from 'xlsx'

interface ParseError {
  row: number
  field: string
  message: string
}

export interface ShiftDefinition {
  code: string
  name: string | null
  start_time: string | null // HH:MM
  end_time: string | null
  break_start: string | null
  break_end: string | null
  scheduled_hours: number | null
}

export interface StaffRecord {
  employee_id: string
  name: string
  name_en: string | null
}

export interface StaffShiftRecord {
  employee_id: string
  date: string // YYYY-MM-DD
  shift_code: string | null
  scheduled_hours: number | null
  actual_hours: number | null
  is_day_off: boolean
  is_absent: boolean
}

interface ParseResult {
  shifts: ShiftDefinition[]
  staff: StaffRecord[]
  staffShifts: StaffShiftRecord[]
  errors: ParseError[]
}

const DAY_OFF_CODES = new Set([
  '休息日', '例假日', '國定假日', '國定',
  '缺', '休息缺', '例假缺', '國定缺', '休假日',
])

/**
 * Parse "H:MM" or "HH:MM" time-as-hours format to decimal hours.
 * e.g. "8:00" → 8, "10:34" → 10.5667
 */
function parseHoursMinutes(val: unknown): number | null {
  if (val == null) return null
  const str = String(val).trim()
  if (!str || str === '0' || str === '0:00') return 0

  const match = str.match(/^(\d+):(\d{2})$/)
  if (match) {
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 60
  }

  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

/**
 * Parse "8 小時 0 分鐘" → decimal hours
 */
function parseChineseHours(val: unknown): number | null {
  if (val == null) return null
  const str = String(val).trim()
  const match = str.match(/(\d+)\s*小時\s*(\d+)\s*分鐘/)
  if (match) {
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 60
  }
  return null
}

/**
 * Parse time string "HH:MM" from various formats
 */
function parseTimeStr(val: unknown): string | null {
  if (val == null) return null
  const str = String(val).trim()
  if (!str) return null

  // Handle Excel serial time (0-1 range)
  const num = parseFloat(str)
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Already HH:MM format
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    return `${String(parseInt(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`
  }

  return null
}

/**
 * Parse break time range like "12:00~13:00" or "12:00-13:00"
 */
function parseBreakRange(val: unknown): { start: string | null; end: string | null } {
  if (val == null) return { start: null, end: null }
  const str = String(val).trim()
  const match = str.match(/(\d{1,2}:\d{2})\s*[~\-～]\s*(\d{1,2}:\d{2})/)
  if (match) {
    return {
      start: parseTimeStr(match[1]),
      end: parseTimeStr(match[2]),
    }
  }
  return { start: null, end: null }
}

/**
 * Parse the 班別明細 (Shift Details) sheet
 */
function parseShiftDefinitions(workbook: XLSX.WorkBook): { shifts: ShiftDefinition[]; errors: ParseError[] } {
  const sheetName = workbook.SheetNames.find(n => n.includes('班別明細'))
  if (!sheetName) {
    return { shifts: [], errors: [] }
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][]

  const shifts: ShiftDefinition[] = []
  const errors: ParseError[] = []

  // Find header row (look for "代碼" or "班別名稱")
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i]
    if (row && row.some(cell => String(cell ?? '').includes('代碼') || String(cell ?? '').includes('班別'))) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    // Try starting from row 0
    headerIdx = 0
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue

    const code = String(row[0]).trim()
    if (!code) continue

    const name = row[1] ? String(row[1]).trim() : null
    const startTime = parseTimeStr(row[2])
    const breakRange = parseBreakRange(row[3])
    const scheduledHours = parseChineseHours(row[4]) ?? parseHoursMinutes(row[4])

    // Derive end_time from start_time + scheduled_hours + break duration
    let endTime: string | null = null
    if (startTime && scheduledHours != null) {
      const [sh, sm] = startTime.split(':').map(Number)
      let breakMinutes = 0
      if (breakRange.start && breakRange.end) {
        const [bsh, bsm] = breakRange.start.split(':').map(Number)
        const [beh, bem] = breakRange.end.split(':').map(Number)
        breakMinutes = (beh * 60 + bem) - (bsh * 60 + bsm)
      }
      const totalMinutes = sh * 60 + sm + scheduledHours * 60 + breakMinutes
      const eh = Math.floor(totalMinutes / 60) % 24
      const em = Math.round(totalMinutes % 60)
      endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
    }

    shifts.push({
      code,
      name,
      start_time: startTime,
      end_time: endTime,
      break_start: breakRange.start,
      break_end: breakRange.end,
      scheduled_hours: scheduledHours,
    })
  }

  return { shifts, errors }
}

/**
 * Read startDate from the metadata sheet. Falls back to null.
 * Used to recover the year for rows that only have "M/D" (no year).
 */
function readMetadataStart(workbook: XLSX.WorkBook): { year: number; month: number } | null {
  const sheetName = workbook.SheetNames.find(n => n === 'metadata' || n.toLowerCase() === 'metadata')
  if (!sheetName) return null
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1 }) as unknown as unknown[][]
  for (const row of rows) {
    if (!row || row[0] !== 'startDate') continue
    const val = String(row[1] ?? '').trim()
    const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
  }
  return null
}

/**
 * Parse the 班表+工時(直式) sheet
 */
function parseScheduleSheet(
  workbook: XLSX.WorkBook,
  shiftMap: Map<string, ShiftDefinition>,
  fallbackStart: { year: number; month: number } | null
): { staff: StaffRecord[]; staffShifts: StaffShiftRecord[]; errors: ParseError[] } {
  const sheetName = workbook.SheetNames.find(n => n.includes('班表') && n.includes('直式'))
    || workbook.SheetNames.find(n => n.includes('班表'))
  if (!sheetName) {
    return {
      staff: [],
      staffShifts: [],
      errors: [{ row: 0, field: 'sheet', message: '找不到「班表+工時(直式)」工作表' }],
    }
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][]

  const staff: StaffRecord[] = []
  const staffShifts: StaffShiftRecord[] = []
  const errors: ParseError[] = []

  if (rows.length < 3) {
    return { staff, staffShifts, errors: [{ row: 0, field: 'sheet', message: '工作表資料不足' }] }
  }

  // Row 0: employee headers — every 4 columns starting from col 2
  // Format: '13006 馬郭宇桐 Kiri Ma Guo'
  const headerRow = rows[0]
  const employees: { colStart: number; employeeId: string; name: string; nameEn: string | null }[] = []

  for (let col = 2; col < (headerRow?.length || 0); col += 4) {
    const cell = headerRow[col]
    if (!cell) continue
    const raw = String(cell).trim()
    if (!raw) continue

    // Parse: "13006 馬郭宇桐 Kiri Ma Guo" or "13006 馬郭宇桐"
    const match = raw.match(/^(\d+)\s+(\S+)\s*(.*)$/)
    if (match) {
      employees.push({
        colStart: col,
        employeeId: match[1],
        name: match[2],
        nameEn: match[3]?.trim() || null,
      })
    } else {
      errors.push({ row: 1, field: `col${col}`, message: `無法解析員工資訊: ${raw}` })
    }
  }

  // Build staff records
  for (const emp of employees) {
    staff.push({
      employee_id: emp.employeeId,
      name: emp.name,
      name_en: emp.nameEn,
    })
  }

  // Row 2+ (skip row 1 which is column labels): daily data
  // Each row: date | weekday | (shift_code | location | scheduled_hours | actual_hours) × N employees
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue

    // Parse date from column 0
    let dateStr: string | null = null
    const dateVal = row[0]
    if (typeof dateVal === 'number') {
      // Excel serial date
      const parsed = XLSX.SSF.parse_date_code(dateVal)
      if (parsed) {
        dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      }
    } else {
      const s = String(dateVal).trim()
      // Try YYYY/MM/DD or YYYY-MM-DD
      const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
      if (m) {
        dateStr = `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`
      } else if (fallbackStart) {
        // nuEIP 直式 sheet uses "M/D" without year — derive year from metadata's startDate.
        // Roll year forward if the row's month precedes startMonth (file spans year boundary).
        const md = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
        if (md) {
          const mm = parseInt(md[1], 10)
          const dd = parseInt(md[2], 10)
          const yy = mm < fallbackStart.month ? fallbackStart.year + 1 : fallbackStart.year
          dateStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
        }
      }
    }

    if (!dateStr) continue

    // Parse each employee's data
    for (const emp of employees) {
      const shiftCode = row[emp.colStart] ? String(row[emp.colStart]).trim() : null
      // col+1 = location (skip)
      const scheduledRaw = row[emp.colStart + 2]
      const actualRaw = row[emp.colStart + 3]

      const isDayOff = shiftCode ? DAY_OFF_CODES.has(shiftCode) : false
      const isAbsent = shiftCode ? shiftCode.includes('缺') : false

      let scheduledHours: number | null = null
      let actualHours: number | null = null

      if (isDayOff) {
        scheduledHours = 0
        actualHours = 0
      } else {
        scheduledHours = parseHoursMinutes(scheduledRaw)
        actualHours = parseHoursMinutes(actualRaw)

        // If shift code not in shift map and not a day off, check for BE烘焙早班
        if (shiftCode && !shiftMap.has(shiftCode) && !isDayOff) {
          if (shiftCode.includes('BE烘焙早班') || shiftCode.includes('烘焙早班')) {
            // Special case: not in shift definitions, use scheduled_hours from cell
            if (!shiftMap.has(shiftCode)) {
              shiftMap.set(shiftCode, {
                code: shiftCode,
                name: 'BE烘焙早班',
                start_time: '06:00',
                end_time: '14:00',
                break_start: null,
                break_end: null,
                scheduled_hours: scheduledHours,
              })
            }
          }
        }
      }

      staffShifts.push({
        employee_id: emp.employeeId,
        date: dateStr,
        shift_code: isDayOff ? null : shiftCode,
        scheduled_hours: scheduledHours,
        actual_hours: actualHours,
        is_day_off: isDayOff,
        is_absent: isAbsent,
      })
    }
  }

  return { staff, staffShifts, errors }
}

/**
 * Main parser entry point for NUEIP schedule Excel files.
 */
export function parseNuEIPSchedule(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Step 1: Parse shift definitions
  const { shifts, errors: shiftErrors } = parseShiftDefinitions(workbook)
  const shiftMap = new Map(shifts.map(s => [s.code, s]))

  // Step 2: Parse schedule + hours
  const fallbackStart = readMetadataStart(workbook)
  const { staff, staffShifts, errors: scheduleErrors } = parseScheduleSheet(workbook, shiftMap, fallbackStart)

  // Include any dynamically discovered shifts (e.g. BE烘焙早班)
  const finalShifts = Array.from(shiftMap.values())

  return {
    shifts: finalShifts,
    staff,
    staffShifts,
    errors: [...shiftErrors, ...scheduleErrors],
  }
}
