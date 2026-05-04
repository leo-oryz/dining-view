// Legacy entry point. The actual implementation now lives in `aiReport.ts`,
// driven by configurable schedules (`report_schedules` table). This file
// kept so existing imports continue to work.
export { sendWeeklyAiReport, sendAiReport } from './aiReport'
export type { ReportType, ReportDepth, PeriodType, ReportScheduleInput } from './aiReport'
