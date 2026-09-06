import { net, session } from 'electron'

// 基于 Chromium 网络栈的 GET 请求。IP/延迟检测需要显式走 mihomo：
// Node 的 http 栈不走系统代理，axios 的 proxy 选项对 HTTPS 目标也不可靠
let proxySession: Electron.Session | null = null
let proxySessionUrl: string | null = null

async function getProxySession(proxyUrl: string): Promise<Electron.Session> {
  if (!proxySession) {
    proxySession = session.fromPartition('proxy-request', { cache: false })
  }
  if (proxySessionUrl !== proxyUrl) {
    await proxySession.setProxy({ proxyRules: proxyUrl })
    proxySessionUrl = proxyUrl
  }
  return proxySession
}

export async function proxyGet(
  url: string,
  options: { timeout?: number; proxyPort?: number } = {}
): Promise<{ data: string; status: number }> {
  const { timeout = 10000, proxyPort } = options
  const sessionToUse = proxyPort
    ? await getProxySession(`http://127.0.0.1:${proxyPort}`)
    : session.defaultSession

  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url, session: sessionToUse, redirect: 'follow' })
    let timeoutId: NodeJS.Timeout | undefined
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        req.abort()
        reject(new Error(`Request timeout after ${timeout}ms`))
      }, timeout)
    }

    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({ data: Buffer.concat(chunks).toString('utf-8'), status: res.statusCode ?? 0 })
      })
      res.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)
        reject(error)
      })
    })
    req.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId)
      reject(error)
    })
    req.end()
  })
}
