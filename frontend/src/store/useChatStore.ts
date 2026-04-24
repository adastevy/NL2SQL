/**
 * 聊天状态：按 sessionId 维护消息数组 + 当前流式状态，负责编排 SSE 消费。
 */
import { create } from 'zustand'

import type {
  AssistantMessage,
  ChatEvent,
  ChatMessage,
  UserMessage,
} from '../types'
import * as api from '../api'
import { useChartStore } from './useChartStore'

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>
  streaming: boolean
  streamingSessionId: string | null
  streamingMessageId: string | null
  abortController: AbortController | null
  error: string | null

  loadMessages: (sessionId: string) => Promise<void>
  clearForSession: (sessionId: string) => void
  sendQuestion: (sessionId: string, question: string) => Promise<void>
  abort: () => void
}

function uid(prefix = 'm'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function applyEvent(msg: AssistantMessage, event: ChatEvent): AssistantMessage {
  const { meta } = msg
  switch (event.type) {
    case 'thought':
      return { ...msg, meta: { ...meta, thought: (meta.thought ?? '') + event.delta } }
    case 'sql':
      return { ...msg, meta: { ...meta, sql: event.sql } }
    case 'data':
      return { ...msg, meta: { ...meta, data: event.data } }
    case 'chart':
      return { ...msg, meta: { ...meta, chart: event.chart } }
    case 'final':
      // 后端 §3.4.6：`final` 在 Agent 结束后一次性推送完整文本，覆盖任何中间态
      return { ...msg, meta: { ...meta, final: event.delta } }
    case 'done':
      return { ...msg, meta: { ...meta, status: 'done', finishedAt: nowIso() } }
    case 'error':
      return { ...msg, meta: { ...meta, status: 'error', error: event.message, finishedAt: nowIso() } }
    default:
      return msg
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesBySession: {},
  streaming: false,
  streamingSessionId: null,
  streamingMessageId: null,
  abortController: null,
  error: null,

  async loadMessages(sessionId) {
    const list = await api.fetchMessages(sessionId)
    set((s) => ({ messagesBySession: { ...s.messagesBySession, [sessionId]: list } }))
  },

  clearForSession(sessionId) {
    set((s) => {
      const next = { ...s.messagesBySession }
      delete next[sessionId]
      return { messagesBySession: next }
    })
  },

  async sendQuestion(sessionId, question) {
    const trimmed = question.trim()
    if (!trimmed) return
    if (get().streaming) return

    const controller = new AbortController()
    const userMsg: UserMessage = {
      id: uid('u'),
      role: 'user',
      sessionId,
      content: trimmed,
      createdAt: nowIso(),
    }
    const assistantMsg: AssistantMessage = {
      id: uid('a'),
      role: 'assistant',
      sessionId,
      createdAt: nowIso(),
      meta: {
        status: 'streaming',
        startedAt: nowIso(),
      },
    }

    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] ?? []), userMsg, assistantMsg],
      },
      streaming: true,
      streamingSessionId: sessionId,
      streamingMessageId: assistantMsg.id,
      abortController: controller,
      error: null,
    }))

    useChartStore.getState().setSql(null)
    useChartStore.getState().setData(null)

    const updateAssistant = (mutator: (m: AssistantMessage) => AssistantMessage) => {
      set((s) => {
        const list = s.messagesBySession[sessionId] ?? []
        const next = list.map((m) =>
          m.id === assistantMsg.id && m.role === 'assistant' ? mutator(m) : m,
        )
        return {
          messagesBySession: { ...s.messagesBySession, [sessionId]: next },
        }
      })
    }

    const onEvent = (event: ChatEvent) => {
      updateAssistant((m) => applyEvent(m, event))
      const chart = useChartStore.getState()
      switch (event.type) {
        case 'sql':
          chart.setSql(event.sql)
          break
        case 'data':
          chart.setData(event.data)
          break
        case 'chart':
          chart.setChart(sessionId, event.chart)
          break
        default:
          break
      }
    }

    try {
      await api.runChat({
        sessionId,
        question: trimmed,
        onEvent,
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateAssistant((m) => ({
          ...m,
          meta: { ...m.meta, status: 'aborted', finishedAt: nowIso() },
        }))
      } else {
        const message = err instanceof Error ? err.message : String(err)
        set({ error: message })
      }
    } finally {
      const { messagesBySession } = get()
      api.persistMessages(sessionId, messagesBySession[sessionId] ?? [])
      set({
        streaming: false,
        streamingSessionId: null,
        streamingMessageId: null,
        abortController: null,
      })
    }
  },

  abort() {
    get().abortController?.abort()
  },
}))
