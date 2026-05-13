import { makeCredentialsGet, makeCredentialsPut } from '@/lib/api/credentialsSettings'

export const GET = makeCredentialsGet('ga4', [], ['property_id'])
export const PUT = makeCredentialsPut('ga4', ['property_id'])
