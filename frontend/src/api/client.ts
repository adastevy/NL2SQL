import axios, { AxiosError } from 'axios'

/**
 * 统一 axios 实例：
 * - 开发环境：走 Vite 代理 `/api` → http://localhost:8000
 * - 生产环境：同源部署时同样走 `/api`
 */
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response) {
      console.error('[api] error', err.response.status, err.response.data)
    } else if (err.request) {
      console.error('[api] no response from server', err.message)
    } else {
      console.error('[api] setup error', err.message)
    }
    return Promise.reject(err)
  },
)

export interface PingResponse {
  pong: boolean
  time: string
  service: string
  version: string
}

export async function ping(): Promise<PingResponse> {
  const { data } = await apiClient.get<PingResponse>('/ping')
  return data
}
