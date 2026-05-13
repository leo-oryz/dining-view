import { makeCredentialsGet, makeCredentialsPut } from '@/lib/api/credentialsSettings'

export const GET = makeCredentialsGet('line', ['channel_access_token', 'channel_secret'])
export const PUT = makeCredentialsPut('line', ['channel_access_token', 'channel_secret'])
