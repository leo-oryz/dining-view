import { makeCredentialsGet, makeCredentialsPut } from '@/lib/api/credentialsSettings'

export const GET = makeCredentialsGet('gsc', [], ['site_url'])
export const PUT = makeCredentialsPut('gsc', ['site_url'])
