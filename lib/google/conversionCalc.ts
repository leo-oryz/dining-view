import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recalculate member_conversion_daily for given dates.
 * Joins GA4 join_member_click events with new_members from daily_sales.
 */
export async function recalculateConversion(
  supabase: SupabaseClient,
  storeId: string,
  dates: string[]
) {
  const eventName = process.env.GA4_JOIN_MEMBER_EVENT_NAME || 'join_member_click'

  for (const date of dates) {
    const { data: ga4Data } = await supabase
      .from('ga4_events')
      .select('event_count')
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('event_name', eventName)

    const ga4Clicks = ga4Data?.reduce((sum, row) => sum + (row.event_count || 0), 0) || 0

    const { data: salesData } = await supabase
      .from('daily_sales')
      .select('new_members')
      .eq('store_id', storeId)
      .eq('date', date)
      .single()

    const newMembers = salesData?.new_members || 0

    const conversionRate = ga4Clicks > 0
      ? newMembers / ga4Clicks
      : 0

    await supabase
      .from('member_conversion_daily')
      .upsert(
        {
          store_id: storeId,
          date,
          ga4_clicks: ga4Clicks,
          new_members: newMembers,
          conversion_rate: conversionRate,
        },
        { onConflict: 'store_id,date' }
      )
  }
}
