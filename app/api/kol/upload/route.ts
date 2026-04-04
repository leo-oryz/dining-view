import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { parseKolCsv, KolCsvRow } from '@/lib/parsers/kolCsvParser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID

    if (!file) {
      return apiError('No file uploaded', 400)
    }

    const text = await file.text()
    const { data: rows, errors: parseErrors } = parseKolCsv(text)

    if (rows.length === 0) {
      return apiError(
        parseErrors.length > 0
          ? `解析失敗: ${parseErrors[0].message}`
          : '檔案中沒有有效的資料列',
        400
      )
    }

    const supabase = createServiceClient()
    let inserted = 0
    const rowErrors: { row: number; message: string }[] = []

    for (const row of rows) {
      try {
        // Upsert collaboration record
        const collabData = buildCollabRecord(row, storeId)

        const { data: collab, error: collabError } = await supabase
          .from('kol_collaborations')
          .upsert(collabData, {
            onConflict: 'store_id,kol_name,collaboration_date',
          })
          .select('id')
          .single()

        if (collabError) {
          rowErrors.push({ row: row.no || 0, message: collabError.message })
          continue
        }

        // If row has engagement data, upsert a post record too
        if (hasEngagementData(row) && collab) {
          const postPlatform = mapToPostPlatform(row.platform)
          if (postPlatform) {
            const postUrl = row.content_url && row.content_url !== 'Link'
              ? row.content_url
              : `https://placeholder.local/${row.platform}/${row.kol_name}/${row.collaboration_date}`

            await supabase
              .from('kol_posts')
              .upsert(
                {
                  collaboration_id: collab.id,
                  store_id: storeId,
                  platform: postPlatform,
                  post_url: postUrl,
                  post_date: row.collaboration_date,
                  views: row.views,
                  likes: row.likes,
                  comments: row.comments,
                  shares: row.shares,
                  saves: row.saves,
                  reach: row.reach,
                  sync_status: 'synced',
                  last_synced_at: new Date().toISOString(),
                },
                { onConflict: 'collaboration_id,post_url' }
              )
          }
        }

        // Determine if this was insert or update (rough heuristic)
        inserted++
      } catch (err) {
        rowErrors.push({
          row: row.no || 0,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return apiSuccess({
      total: rows.length,
      processed: inserted,
      errors: rowErrors,
      parseErrors,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}

function buildCollabRecord(row: KolCsvRow, storeId: string) {
  return {
    store_id: storeId,
    kol_name: row.kol_name,
    kol_handle: row.kol_name, // Use name as handle since CSV doesn't have @handle
    collaboration_date: row.collaboration_date,
    collaboration_fee: row.collaboration_fee,
    fee_type: row.collaboration_fee ? 'cash' : null,
    status: row.payment_status === '完成' ? 'completed' : 'active',
    contract_number: row.contract_number,
    real_name: row.real_name,
    platform: row.platform,
    party_size: row.party_size,
    visit_time: row.visit_time,
    contact_info: row.contact_info,
    confirmation_status: row.confirmation_status,
    contract_sent: row.contract_sent,
    visit_status: row.visit_status,
    content_status: row.content_status,
    content_type: row.content_type,
    invoice_status_1: row.invoice_status_1,
    invoice_status_2: row.invoice_status_2,
    payment_status: row.payment_status,
    content_url: row.content_url,
    engagement_rate: row.engagement_rate,
    notes: row.contact_info, // Store contact as notes too for visibility
  }
}

function hasEngagementData(row: KolCsvRow): boolean {
  return (row.views ?? row.likes ?? row.comments ?? row.shares ?? row.saves ?? row.reach) != null
}

/**
 * Map CSV platform names to kol_posts platform enum
 */
function mapToPostPlatform(platform: string | null): string | null {
  if (!platform) return null
  switch (platform) {
    case 'instagram': return 'instagram'
    case 'facebook': return 'facebook'
    case 'tiktok': return 'tiktok'
    case 'threads': return 'threads'
    case 'youtube': return 'youtube'
    default: return null // blogger etc. don't have social post scraping
  }
}
