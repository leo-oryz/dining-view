const TS = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

export const log = {
  info: (msg: string, ...rest: unknown[]) => console.log(`[${TS()}] ${msg}`, ...rest),
  warn: (msg: string, ...rest: unknown[]) => console.warn(`[${TS()}] WARN ${msg}`, ...rest),
  err:  (msg: string, ...rest: unknown[]) => console.error(`[${TS()}] ERR  ${msg}`, ...rest),
  step: (msg: string) => console.log(`[${TS()}] ▸ ${msg}`),
}
