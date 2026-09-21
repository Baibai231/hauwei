const API = import.meta.env.VITE_API_URL || ''

type Envelope<T> = { ok: boolean; data: T; error?: { message: string } }

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API}${path}`, { ...init, headers })
  let payload: Envelope<T>
  try { payload = await response.json() as Envelope<T> }
  catch { throw new Error(`服务返回了无法解析的响应 (${response.status})`) }
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || `请求失败 (${response.status})`)
  return payload.data
}

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
