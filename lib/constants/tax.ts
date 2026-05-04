export const VAT_RATE = 0.10
export const SERVICE_CHARGE_RATE = 0.05
export const TAX_DIVISOR = 1.15 // gross / TAX_DIVISOR = net

export function grossToNet(gross: number): number {
  return gross / TAX_DIVISOR
}
