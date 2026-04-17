import * as Papa from 'papaparse'
import * as fs from 'fs'
import type { TransactionRow } from './google-sheets'

/**
 * Parse the eat365 Transaction Report CSV export into rows
 * matching the Google Sheet "Order" format for Meta Offline Conversion.
 *
 * CSV headers from eat365 export (28 columns):
 *   Order Number, External Order Number, External Reference ID, Order Type,
 *   Table, Check Name, Time, Server, Scheduled Time, Delivery/Pickup Time,
 *   Status, Serial Number, E-Tax Invoice Number, Tender, No. of guest,
 *   Sub-total, Tax, Service Charge, Delivery Fee, Order Surcharge,
 *   Payment Surcharge, Tips, Discount, Order Total, Source,
 *   Customer Name, Customer Phone, Order Remarks
 */
export function parseTransactionCsv(csvText: string): TransactionRow[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  const rows: TransactionRow[] = []

  for (const raw of result.data as Record<string, string>[]) {
    const serialNumber = (raw['Serial Number'] || '').trim()
    if (!serialNumber || serialNumber === 'N/A') continue

    rows.push({
      orderNumber: (raw['Order Number'] || '').trim(),
      externalOrderNumber: (raw['External Order Number'] || '').trim(),
      externalReferenceId: (raw['External Reference ID'] || '').trim(),
      orderType: (raw['Order Type'] || '').trim(),
      table: (raw['Table'] || '').trim(),
      checkName: (raw['Check Name'] || '').trim(),
      time: (raw['Time'] || '').trim(),
      server: (raw['Server'] || '').trim(),
      scheduledTime: (raw['Scheduled Time'] || '').trim(),
      deliveryPickupTime: (raw['Delivery/Pickup Time'] || '').trim(),
      status: (raw['Status'] || '').trim(),
      serialNumber,
      eTaxInvoiceNumber: (raw['E-Tax Invoice Number'] || '').trim(),
      tender: (raw['Tender'] || raw['Payment Type'] || '').trim(),
      noOfGuest: parseNum(raw['No. of guest'] || raw['No. of Guest']),
      subTotal: parseNum(raw['Sub-total']),
      tax: parseNum(raw['Tax']),
      serviceCharge: parseNum(raw['Service Charge']),
      deliveryFee: parseNum(raw['Delivery Fee']),
      orderSurcharge: parseNum(raw['Order Surcharge']),
      paymentSurcharge: parseNum(raw['Payment Surcharge']),
      tips: parseNum(raw['Tips']),
      discount: parseNum(raw['Discount']),
      orderTotal: parseNum(raw['Order Total']),
      source: (raw['Source'] || '').trim(),
      customerName: (raw['Customer Name'] || '').trim(),
      customerPhone: (raw['Customer Phone'] || '').trim(),
      orderRemarks: (raw['Order Remarks'] || '').trim(),
    })
  }

  return rows
}

/**
 * Parse a JSON response from the eat365 Transaction Report API into rows.
 */
export function parseTransactionJson(json: unknown): TransactionRow[] {
  const rows: TransactionRow[] = []

  let items: any[] = []
  if (Array.isArray(json)) {
    items = json
  } else if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    if (Array.isArray(obj.data)) items = obj.data
    else if (Array.isArray(obj.result)) items = obj.result
    else if (Array.isArray(obj.list)) items = obj.list
    else if (Array.isArray(obj.transactions)) items = obj.transactions
    else if (Array.isArray(obj.rows)) items = obj.rows
  }

  for (const item of items) {
    const serialNumber = String(
      item.serialNumber || item.serial_number || item.serialNo || ''
    ).trim()
    if (!serialNumber) continue

    rows.push({
      orderNumber: String(item.orderNumber || item.order_number || item.orderNo || '').trim(),
      externalOrderNumber: String(item.externalOrderNumber || item.external_order_number || '').trim(),
      externalReferenceId: String(item.externalReferenceId || item.external_reference_id || '').trim(),
      orderType: String(item.orderType || item.order_type || '').trim(),
      table: String(item.table || item.tableNo || '').trim(),
      checkName: String(item.checkName || item.check_name || '').trim(),
      time: String(item.time || item.orderTime || item.createdAt || '').trim(),
      server: String(item.server || item.serverName || '').trim(),
      scheduledTime: String(item.scheduledTime || item.scheduled_time || '').trim(),
      deliveryPickupTime: String(item.deliveryPickupTime || item.delivery_pickup_time || '').trim(),
      status: String(item.status || '').trim(),
      serialNumber,
      eTaxInvoiceNumber: String(item.eTaxInvoiceNumber || item.e_tax_invoice_number || item.invoiceNo || '').trim(),
      tender: String(item.tender || item.paymentType || item.payment_type || '').trim(),
      noOfGuest: item.noOfGuest ?? item.no_of_guest ?? item.guestCount ?? '',
      subTotal: item.subTotal ?? item.sub_total ?? item.subtotal ?? '',
      tax: item.tax ?? '',
      serviceCharge: item.serviceCharge ?? item.service_charge ?? '',
      deliveryFee: item.deliveryFee ?? item.delivery_fee ?? '',
      orderSurcharge: item.orderSurcharge ?? item.order_surcharge ?? '',
      paymentSurcharge: item.paymentSurcharge ?? item.payment_surcharge ?? '',
      tips: item.tips ?? '',
      discount: item.discount ?? '',
      orderTotal: item.orderTotal ?? item.order_total ?? item.total ?? '',
      source: String(item.source || '').trim(),
      customerName: String(item.customerName || item.customer_name || '').trim(),
      customerPhone: String(item.customerPhone || item.customer_phone || item.phone || '').trim(),
      orderRemarks: String(item.orderRemarks || item.order_remarks || item.remarks || '').trim(),
    })
  }

  return rows
}

function parseNum(val: unknown): number | string {
  if (val === null || val === undefined || val === '' || val === '-' || val === '–') return ''
  const str = String(val).replace(/,/g, '').replace(/NT\$/g, '')
  const num = Number(str)
  return isNaN(num) ? '' : num
}

/**
 * Read and parse a transaction report file (CSV or JSON).
 */
export function parseTransactionFile(filePath: string): TransactionRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')

  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(content)
    return parseTransactionJson(parsed.json || parsed)
  }

  return parseTransactionCsv(content)
}
