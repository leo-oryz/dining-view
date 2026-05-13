import { makeCredentialsGet, makeCredentialsPut } from '@/lib/api/credentialsSettings'

export const GET = makeCredentialsGet('tablecheck', ['api_key'])
export const PUT = makeCredentialsPut('tablecheck', ['api_key'])
