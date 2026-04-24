/**
 * 真实后端 · /api/chat SSE 流式问答客户端。
 *
 * 使用 `@microsoft/fetch-event-source`（fetch-based SSE，支持 POST + 自定义 header）
 * 而非原生 `EventSource`（只支持 GET）。协议严格遵循后端 §3.4.6：
 *
 *   data: {"type":"thought","delta":"..."}
 *   data: {"type":"sql","sql":"..."}
 *   data: {"type":"data","data":{columns,rows,rowCount,truncated}}
 *   data: {"type":"chart","chart":{chartType,echartsOption,insight}}
 *   data: {"type":"final","delta":"..."}  ← 整段完整答案，一次性
 *   data: {"type":"done"}
 *   data: {"type":"error","message":"..."}
 *
 * 对外签名与 `mocks/mockSSE.runMockChat` 对齐：`runChat({sessionId, question, onEvent, signal})`。
 */
import { fetchEventSource } from '@microsoft/fetch-event-source'

import type { ChatEvent, ChatEventHandler } from '../types'

export interface RunChatOptions {
  sessionId: string
  question: string
  onEvent: ChatEventHandler
  signal?: AbortSignal
}

/** 本地错误类：HTTP 建连阶段失败时抛出，保留 status 方便上层处理。 */
class ChatStreamError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ChatStreamError'
    this.status = status
  }
}

/** 后端 CORS/代理挂掉时也能给出可读原因。 */
function isRetriableNetworkError(err: unknown): boolean {
  return err instanceof TypeError
}

export async function runChat(options: RunChatOptions): Promise<void> {
  const { sessionId, question, onEvent, signal } = options

  let terminated = false
  const handleEvent = (ev: ChatEvent) => {
    onEvent(ev)
    if (ev.type === 'done' || ev.type === 'error') {
      terminated = true
    }
  }

  try {
    await fetchEventSource('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ sessionId, question }),
      signal,
      // 浏览器切到后台时仍保持流（问答过程不能因为切 tab 而断）
      openWhenHidden: true,

      async onopen(response) {
        if (!response.ok) {
          let detail = ''
          try {
            detail = await response.text()
          } catch {
            /* ignore */
          }
          throw new ChatStreamError(
            `/api/chat 建连失败：HTTP ${response.status}${detail ? ` - ${detail.slice(0, 200)}` : ''}`,
            response.status,
          )
        }
        const ct = response.headers.get('content-type') ?? ''
        if (!ct.includes('text/event-stream')) {
          throw new ChatStreamError(
            `/api/chat 返回非 SSE 内容：Content-Type=${ct}`,
            response.status,
          )
        }
      },

      onmessage(msg) {
        if (!msg.data) return
        let payload: ChatEvent
        try {
          payload = JSON.parse(msg.data) as ChatEvent
        } catch (err) {
          console.warn('[api/chat] 丢弃无法解析的 SSE 帧:', msg.data, err)
          return
        }
        handleEvent(payload)
      },

      onclose() {
        // 服务端主动 close：
        // - 若已收到 done/error 事件，认为正常结束
        // - 否则通知上层一次合成 error，避免 UI 永远停在 streaming 态
        if (!terminated) {
          handleEvent({
            type: 'error',
            message: '/api/chat 连接被服务端关闭，但未收到 done/error 事件',
          })
          handleEvent({ type: 'done' })
        }
      },

      onerror(err) {
        // 抛出 → fetch-event-source 不会自动重试；由外层 catch 感知
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err
        }
        if (err instanceof ChatStreamError) {
          throw err
        }
        if (isRetriableNetworkError(err)) {
          throw new ChatStreamError(
            '/api/chat 网络异常：请检查后端是否在 8000 端口运行、Vite 代理是否生效',
          )
        }
        throw err
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    // 统一向 UI 推一次 error + done，并继续向上抛给 store
    if (!terminated) {
      onEvent({ type: 'error', message })
      onEvent({ type: 'done' })
    }
    throw err
  }
}
