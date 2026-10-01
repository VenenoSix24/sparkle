const STORAGE_KEY = 'proxyGroupOpenState'

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === 'boolean')
}

export function loadProxyGroupOpenState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return isBooleanRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function saveProxyGroupOpenState(state: Record<string, boolean>): void {
  try {
    if (Object.keys(state).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
