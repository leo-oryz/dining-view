import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
const VERIFICATION_SENDER = 'no-reply@accounts.eats365pos.com'
const VERIFICATION_SUBJECT = 'Verification Code'
const CODE_REGEX = /Verification Code[^0-9]*(\d{6})/

/**
 * Read the latest eat365 verification code from Gmail
 * Uses Google Service Account with domain-wide delegation
 */
export async function readEat365VerificationCode(options?: {
  /** Max seconds to wait for the email (default 60) */
  timeoutSeconds?: number
  /** Poll interval in ms (default 3000) */
  pollIntervalMs?: number
}): Promise<string> {
  const timeout = (options?.timeoutSeconds ?? 60) * 1000
  const pollInterval = options?.pollIntervalMs ?? 3000

  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const userEmail = process.env.GMAIL_USER_EMAIL || 'leo@staymeander.com'

  if (!privateKey || !clientEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
    subject: userEmail, // impersonate the workspace user
  })

  const gmail = google.gmail({ version: 'v1', auth })

  const startTime = Date.now()
  // Only look for emails from the last 5 minutes
  const afterEpoch = Math.floor(startTime / 1000) - 300

  console.log('[gmail] Waiting for eat365 verification email...')

  while (Date.now() - startTime < timeout) {
    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: `from:${VERIFICATION_SENDER} subject:${VERIFICATION_SUBJECT} after:${afterEpoch}`,
        maxResults: 1,
      })

      const messages = res.data.messages
      if (messages && messages.length > 0) {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: messages[0].id!,
          format: 'full',
        })

        // Extract code from snippet or body
        const snippet = msg.data.snippet || ''
        const match = snippet.match(CODE_REGEX)
        if (match) {
          console.log(`[gmail] Found verification code: ${match[1]}`)
          return match[1]
        }

        // Try body if snippet didn't work
        const body = getMessageBody(msg.data)
        const bodyMatch = body.match(CODE_REGEX)
        if (bodyMatch) {
          console.log(`[gmail] Found verification code from body: ${bodyMatch[1]}`)
          return bodyMatch[1]
        }
      }
    } catch (err: any) {
      console.warn(`[gmail] Poll error: ${err.message}`)
    }

    await sleep(pollInterval)
  }

  throw new Error(`[gmail] Timed out waiting for verification email (${timeout / 1000}s)`)
}

function getMessageBody(message: any): string {
  const payload = message.payload
  if (!payload) return ''

  // Simple text body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  // Multipart — find text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }
  }

  return ''
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
