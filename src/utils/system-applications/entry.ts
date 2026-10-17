import {
  applicationRequest,
  applicationHomePath,
  cancelApplicationRequests,
  createEntryProof,
  loadApplicationEntryInformation,
  setApplicationName,
  takeEntryProof,
  withHashQuery
} from './client'

async function getPortalUrl() {
  const entry = await loadApplicationEntryInformation()
  if (!entry.portalUrl) throw new Error('请先在系统入口配置中登记控制台地址')
  return entry.portalUrl
}

export async function startSystemBLogin() {
  const portalUrl = await getPortalUrl()
  const proof = createEntryProof('B')
  location.assign(
    withHashQuery(portalUrl, { app: 'B', state: proof.state, challenge: proof.challenge })
  )
}

export async function goToApplicationPortal() {
  location.assign(await getPortalUrl())
}

export async function redeemSystemBEntry(ticket: string, state: string) {
  const verifier = takeEntryProof('B', state)
  history.replaceState(null, '', `${location.pathname}${location.search}#/auth/entry`)
  const result = await applicationRequest<{
    token: string
    displayName: string
    homePath: string
  }>('/api/system-applications/redeem', { appCode: 'B', ticket, state, codeVerifier: verifier }, '')
  cancelApplicationRequests()
  setApplicationName(result.displayName)
  applicationHomePath.value = result.homePath || '/workbench'
  return result
}
