import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface OcardRecruitData {
  total_members: number | null
  new_members: number | null
  conversion_rate: number | null
  male_count: number | null
  female_count: number | null
  unknown_gender_count: number | null
  age_0_18: number | null
  age_19_22: number | null
  age_23_29: number | null
  age_30_39: number | null
  age_40_49: number | null
  age_50_59: number | null
  age_60_plus: number | null
  age_unknown: number | null
  channel_direct: number | null
  channel_app: number | null
  channel_coupon: number | null
  channel_other: number | null
  period_start: string | null
  period_end: string | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '').replace(/%/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}


export function parseOcardRecruit(csvText: string): { data: OcardRecruitData; errors: ParseError[] } {
  const errors: ParseError[] = []
  const result: OcardRecruitData = {
    total_members: null, new_members: null, conversion_rate: null,
    male_count: null, female_count: null, unknown_gender_count: null,
    age_0_18: null, age_19_22: null, age_23_29: null, age_30_39: null,
    age_40_49: null, age_50_59: null, age_60_plus: null, age_unknown: null,
    channel_direct: null, channel_app: null, channel_coupon: null, channel_other: null,
    period_start: null, period_end: null,
  }

  try {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true })
    const rows = parsed.data as string[][]

    // Section-aware parsing: track current section to disambiguate duplicate keys like "未知"
    let currentSection = 'header'
    const sectionData = new Map<string, Map<string, string>>()
    const globalKv = new Map<string, string>()

    for (const row of rows) {
      const col0 = String(row[0] || '').trim()
      const col1 = String(row[1] || '').trim()

      // Detect section headers (single-column rows ending with 分析/趨勢)
      if (row.length < 2 || col1 === '' || col1.startsWith('----')) {
        if (col0.includes('性別')) currentSection = 'gender'
        else if (col0.includes('年齡')) currentSection = 'age'
        else if (col0.includes('管道') || col0.includes('招募管道')) currentSection = 'channel'
        else if (col0.includes('趨勢')) currentSection = 'trend'
        else if (col0.includes('邀請轉換')) currentSection = 'invite'
        else if (col0.includes('分店')) currentSection = 'store'
        continue
      }

      // Skip table headers (e.g. "性別","人數")
      if (col1 === '人數' || col1 === '-------------------- #') continue

      // Store in section map
      if (!sectionData.has(currentSection)) sectionData.set(currentSection, new Map())
      sectionData.get(currentSection)!.set(col0, col1)
      globalKv.set(col0, col1)
    }

    const getVal = (section: string, key: string) => sectionData.get(section)?.get(key) ?? null
    const getGlobal = (key: string) => globalKv.get(key) ?? null

    // Period from 取樣開始日期/取樣結束日期
    const startRaw = getGlobal('取樣開始日期')
    const endRaw = getGlobal('取樣結束日期')
    if (startRaw && endRaw) {
      const fmt = (d: string) => {
        const parts = d.split('/')
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
      result.period_start = fmt(startRaw)
      result.period_end = fmt(endRaw)
    }

    result.total_members = parseNum(getGlobal('總會員數'))
    result.new_members = parseNum(getGlobal('期間新會員數'))
    result.conversion_rate = parseNum(getGlobal('會員招募轉換率'))

    // Gender — section-aware to handle "未知"
    result.male_count = parseNum(getVal('gender', '男性'))
    result.female_count = parseNum(getVal('gender', '女性'))
    result.unknown_gender_count = parseNum(getVal('gender', '未知'))

    // Age distribution — section-aware to handle "未知"
    result.age_0_18 = parseNum(getVal('age', '0歲 - 18歲'))
    result.age_19_22 = parseNum(getVal('age', '19歲 - 22歲'))
    result.age_23_29 = parseNum(getVal('age', '23歲 - 29歲'))
    result.age_30_39 = parseNum(getVal('age', '30歲 - 39歲'))
    result.age_40_49 = parseNum(getVal('age', '40歲 - 49歲'))
    result.age_50_59 = parseNum(getVal('age', '50歲 - 59歲'))
    result.age_60_plus = parseNum(getVal('age', '60歲以上'))
    result.age_unknown = parseNum(getVal('age', '未知'))

    // Channels
    result.channel_direct = parseNum(getVal('channel', '直接加入'))
    const appRecruit = parseNum(getVal('channel', 'Ocard App 招募')) || 0
    const appScan = parseNum(getVal('channel', 'Ocard App 掃碼')) || 0
    result.channel_app = appRecruit + appScan || null
    result.channel_coupon = parseNum(getVal('channel', '線上領券'))
    const channelOther = parseNum(getVal('channel', '其他')) || 0
    const channelLink = parseNum(getVal('channel', '會員招募連結')) || 0
    const channelShare = parseNum(getVal('channel', '好友分享邀請')) || 0
    const channelPoints = parseNum(getVal('channel', '點數累積')) || 0
    const channelGift = parseNum(getVal('channel', '轉贈禮物券')) || 0
    const channelLottery = parseNum(getVal('channel', '抽獎活動')) || 0
    result.channel_other = (channelOther + channelLink + channelShare + channelPoints + channelGift + channelLottery) || null
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse recruit CSV: ${(e as Error).message}` })
  }

  return { data: result, errors }
}
