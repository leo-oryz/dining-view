import { makeCredentialsGet, makeCredentialsPut } from '@/lib/api/credentialsSettings'

export const GET = makeCredentialsGet('meta_ads', ['access_token'], ['account_id'])
export const PUT = makeCredentialsPut('meta_ads', ['access_token', 'account_id'])
