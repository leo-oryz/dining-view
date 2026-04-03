import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  subtitle: { fontSize: 11, color: '#64748b', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  cell: { flex: 1, fontSize: 9 },
  cellRight: { flex: 1, fontSize: 9, textAlign: 'right' },
  cellHeader: { flex: 1, fontSize: 9, fontWeight: 'bold', color: '#475569' },
  cellHeaderRight: { flex: 1, fontSize: 9, fontWeight: 'bold', color: '#475569', textAlign: 'right' },
  kpiRow: { flexDirection: 'row', marginBottom: 6 },
  kpiLabel: { width: 140, fontSize: 10, color: '#64748b' },
  kpiValue: { fontSize: 10, fontWeight: 'bold', color: '#1e293b' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#94a3b8' },
})

interface MonthlyRevenue {
  month: string
  revenue: number
}

interface MemberGrowth {
  month: string
  total_members: number
}

interface TopProduct {
  product_name: string
  total_revenue: number
  total_quantity: number
}

interface ReviewTrend {
  month: string
  avg_rating: number | null
}

interface BrandReputation {
  current_rating: number | null
  rating_trend: ReviewTrend[]
  negative_rate: number | null // 0-1
}

interface ReportData {
  store_name: string
  report_month: string
  monthly_revenue: MonthlyRevenue[]
  member_growth: MemberGrowth[]
  top_products: TopProduct[]
  gross_margin: number | null
  kpis: {
    avg_spend: number
    turnover_rate: number
    new_member_rate: number
  }
  brand_reputation?: BrandReputation | null
}

export function InvestorReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FnB Pulse — Investor Report</Text>
          <Text style={styles.subtitle}>{data.store_name} | {data.report_month}</Text>
        </View>

        {/* Section 1: Monthly Revenue Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Monthly Revenue (Last 12 Months)</Text>
          <View style={styles.row}>
            <Text style={styles.cellHeader}>Month</Text>
            <Text style={styles.cellHeaderRight}>Revenue (NT$)</Text>
          </View>
          {data.monthly_revenue.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cell}>{r.month}</Text>
              <Text style={styles.cellRight}>{Math.round(r.revenue).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Section 2: Member Growth */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Member Growth</Text>
          <View style={styles.row}>
            <Text style={styles.cellHeader}>Month</Text>
            <Text style={styles.cellHeaderRight}>Total Members</Text>
          </View>
          {data.member_growth.map((m, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cell}>{m.month}</Text>
              <Text style={styles.cellRight}>{m.total_members.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Section 3: Top 10 Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Top 10 Products by Revenue</Text>
          <View style={styles.row}>
            <Text style={{ ...styles.cellHeader, flex: 2 }}>Product</Text>
            <Text style={styles.cellHeaderRight}>Quantity</Text>
            <Text style={styles.cellHeaderRight}>Revenue (NT$)</Text>
          </View>
          {data.top_products.slice(0, 10).map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={{ ...styles.cell, flex: 2 }}>{p.product_name}</Text>
              <Text style={styles.cellRight}>{p.total_quantity.toLocaleString()}</Text>
              <Text style={styles.cellRight}>{Math.round(p.total_revenue).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Section 4: Gross Margin */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Gross Margin Summary</Text>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Overall Gross Margin:</Text>
            <Text style={styles.kpiValue}>
              {data.gross_margin != null ? `${(data.gross_margin * 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Section 5: Key KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Key Performance Indicators</Text>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Average Spend per Guest:</Text>
            <Text style={styles.kpiValue}>NT${data.kpis.avg_spend.toFixed(0)}</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Table Turnover Rate:</Text>
            <Text style={styles.kpiValue}>{data.kpis.turnover_rate.toFixed(2)}</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>New Member Rate:</Text>
            <Text style={styles.kpiValue}>{(data.kpis.new_member_rate * 100).toFixed(1)}%</Text>
          </View>
        </View>

        {/* Section 6: Brand Reputation (Google Reviews) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Brand Reputation (Google Reviews)</Text>
          {data.brand_reputation ? (
            <>
              <View style={styles.kpiRow}>
                <Text style={styles.kpiLabel}>Current Google Rating:</Text>
                <Text style={styles.kpiValue}>
                  {data.brand_reputation.current_rating != null
                    ? `${data.brand_reputation.current_rating.toFixed(2)} / 5.0`
                    : 'N/A'}
                </Text>
              </View>
              <View style={styles.kpiRow}>
                <Text style={styles.kpiLabel}>Negative Review Rate:</Text>
                <Text style={styles.kpiValue}>
                  {data.brand_reputation.negative_rate != null
                    ? `${(data.brand_reputation.negative_rate * 100).toFixed(1)}%`
                    : 'N/A'}
                </Text>
              </View>
              {data.brand_reputation.rating_trend.length > 0 && (
                <>
                  <Text style={{ fontSize: 10, color: '#475569', marginTop: 8, marginBottom: 4 }}>
                    Rating Trend (Last 12 Months):
                  </Text>
                  <View style={styles.row}>
                    <Text style={styles.cellHeader}>Month</Text>
                    <Text style={styles.cellHeaderRight}>Avg Rating</Text>
                  </View>
                  {data.brand_reputation.rating_trend.map((r, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.cell}>{r.month}</Text>
                      <Text style={styles.cellRight}>
                        {r.avg_rating != null ? r.avg_rating.toFixed(2) : 'N/A'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>
              尚未設定 Google 評論同步
            </Text>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by FnB Pulse | {new Date().toISOString().split('T')[0]}
        </Text>
      </Page>
    </Document>
  )
}

export type { ReportData }
