import { net } from 'electron'

// 走 defaultSession 跟随系统代理：开显示节点出口，关显示真实网络
export async function proxyGet(
  url: string,
  options: { timeout?: number } = {}
): Promise<{ data: string; status: number }> {
  const { timeout = 10000 } = options

  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url, redirect: 'follow' })
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
