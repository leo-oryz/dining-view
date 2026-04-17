import { google } from 'googleapis'

const SPREADSHEET_ID = '1CglLzqEtc6D5EjTFjwa0hRwctgdIHb51-SXIhhMR1j4'
const SHEET_NAME = 'Order'

/**
 * Google Sheet "Order" column layout (A–AB):
 *   A: Order Number         N: Tender
 *   B: External Order No    O: No. of guest
 *   C: External Ref ID      P: Sub-total
 *   D: Order Type            Q: Tax
 *   E: Table                 R: Service Charge
 *   F: Check Name            S: Delivery Fee
 *   G: Time                  T: Order Surcharge
 *   H: Server                U: Payment Surcharge
 *   I: Scheduled Time        V: Tips
 *   J: Delivery/Pickup Time  W: Discount
 *   K: Status                X: Order Total
 *   L: Serial Number         Y: Source
 *   M: E-Tax Invoice Number  Z: Customer Name
 *                            AA: Customer Phone
 *                            AB: Order Remarks
 */

export type TransactionRow = {
  orderNumber: string
  externalOrderNumber: string
  externalReferenceId: string
  orderType: string
  table: string
  checkName: string
  time: string
  server: string
  scheduledTime: string
  deliveryPickupTime: string
  status: string
  serialNumber: string
  eTaxInvoiceNumber: string
  tender: string
  noOfGuest: number | string
  subTotal: number | string
  tax: number | string
  serviceCharge: number | string
  deliveryFee: number | string
  orderSurcharge: number | string
  paymentSurcharge: number | string
  tips: number | string
  discount: number | string
  orderTotal: number | string
  source: string
  customerName: string
  customerPhone: string
  orderRemarks: string
}

function getAuth() {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

  if (!privateKey || !clientEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

/**
 * Get existing Serial Numbers (column L) from the Sheet to avoid duplicates.
 */
async function getExistingSerialNumbers(sheets: any): Promise<Set<string>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!L:L`,
  })
  const values = res.data.values || []
  const serials = new Set<string>()
  // Skip header row
  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[0]) {
      serials.add(String(values[i][0]).trim())
    }
  }
  return serials
}

/**
 * Append transaction rows to the Google Sheet, skipping duplicates by Serial Number.
 */
export async function syncTransactionsToSheet(rows: TransactionRow[]): Promise<{
  appended: number
  skipped: number
}> {
  if (rows.length === 0) {
    console.log('[sheets] No rows to sync')
    return { appended: 0, skipped: 0 }
  }

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // Get existing serial numbers for dedup
  console.log('[sheets] Checking existing rows for dedup...')
  const existing = await getExistingSerialNumbers(sheets)
  console.log(`[sheets] Found ${existing.size} existing rows`)

  // Filter out duplicates
  const newRows = rows.filter((r) => !existing.has(String(r.serialNumber).trim()))
  const skipped = rows.length - newRows.length

  if (newRows.length === 0) {
    console.log(`[sheets] All ${rows.length} rows already exist, nothing to append`)
    return { appended: 0, skipped }
  }

  // Convert to sheet values matching column order A–AB
  const values = newRows.map((r) => [
    r.orderNumber,
    r.externalOrderNumber,
    r.externalReferenceId,
    r.orderType,
    r.table,
    r.checkName,
    r.time,
    r.server,
    r.scheduledTime,
    r.deliveryPickupTime,
    r.status,
    r.serialNumber,
    r.eTaxInvoiceNumber,
    r.tender,
    r.noOfGuest,
    r.subTotal,
    r.tax,
    r.serviceCharge,
    r.deliveryFee,
    r.orderSurcharge,
    r.paymentSurcharge,
    r.tips,
    r.discount,
    r.orderTotal,
    r.source,
    r.customerName,
    r.customerPhone,
    r.orderRemarks,
  ])

  // Append rows
  console.log(`[sheets] Appending ${newRows.length} new rows (skipping ${skipped} duplicates)...`)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:AB`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })

  console.log(`[sheets] Successfully appended ${newRows.length} rows`)
  return { appended: newRows.length, skipped }
}
