/**
 * 真实后端 · Session / Message REST 接入层。
 *
 * 签名与 `frontend/src/mocks/mockApi.ts` 完全一致，Phase 4 切换只需把
 * `import * as api from '../mocks/mockApi'` 改为 `import * as api from '../api'`。
 *
 * 字段契约完全遵循后端 `backend/app/schemas.py`（Pydantic v2，alias_generator=to_camel）。
 */
import type {
  AssistantMeta,
  AssistantMessage,
  AssistantStatus,
  ChartPayload,
  ChatMessage,
  QueryResult,
  Session,
  UserMessage,
} from '../types'
import { apiClient } from './client'

// ============ 后端响应 DTO（镜像 schemas.py 的 JSON 形态） ============

interface BackendSessionOut {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  preview: string | null
}

interface BackendAssistantMeta {
  thought: string | null
  sql: string | null
  data: QueryResult | null
  chart: ChartPayload | null
  final: string | null
  status: AssistantStatus
  error: string | null
  startedAt: string
  finishedAt: string | null
}

interface BackendMessageOut {
  id: string
  role: 'user' | 'assistant'
  sessionId: string
  createdAt: string
  content: string | null
  meta: BackendAssistantMeta | null
}

// ============ Session CRUD ============

export async function listSessions(): Promise<Session[]> {
  const { data } = await apiClient.get<BackendSessionOut[]>('/sessions')
  return data.map(adaptSession)
}

export async function createSession(title?: string): Promise<Session> {
  const body: { title?: string } = title ? { title } : {}
  const { data } = await apiClient.post<BackendSessionOut>('/sessions', body)
  return adaptSession(data)
}

export async function renameSession(id: string, title: string): Promise<Session> {
  const { data } = await apiClient.patch<BackendSessionOut>(
    `/sessions/${encodeURIComponent(id)}`,
    { title },
  )
  return adaptSession(data)
}

export async function deleteSession(id: string): Promise<void> {
  await apiClient.delete(`/sessions/${encodeURIComponent(id)}`)
}

/**
 * Mock 专用：单端状态更新；真实后端在 /api/chat 流式结束时由 chat_service 自动写库，
 * 前端只需本地乐观更新 session 列表即可，这里保留为 no-op 以保持签名兼容。
 */
export function touchSession(_id: string, _preview?: string): void {
  // 真实后端下：preview/updatedAt 由 chat_service.update_preview_and_title 维护；
  // 如需立即反映，应调用 listSessions() 重拉列表。
  void _id
  void _preview
}

// ============ Message ============

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<BackendMessageOut[]>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
  )
  return data.map(adaptMessage)
}

/**
 * Mock 专用：把内存消息数组落盘；真实后端下每条消息已由 chat_service 落库，
 * 本函数为 no-op。
 */
export function persistMessages(_sessionId: string, _messages: ChatMessage[]): void {
  void _sessionId
  void _messages
}

// ============ 适配器 ============

function adaptSession(x: BackendSessionOut): Session {
  return {
    id: x.id,
    title: x.title,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    preview: x.preview,
  }
}

function adaptMessage(x: BackendMessageOut): ChatMessage {
  if (x.role === 'user') {
    const m: UserMessage = {
      id: x.id,
      role: 'user',
      sessionId: x.sessionId,
      content: x.content ?? '',
      createdAt: x.createdAt,
    }
    return m
  }
  // assistant
  const meta: AssistantMeta = x.meta
    ? {
        thought: x.meta.thought,
        sql: x.meta.sql,
        data: x.meta.data,
        chart: x.meta.chart,
        final: x.meta.final ?? x.content ?? null,
        status: x.meta.status,
        error: x.meta.error,
        startedAt: x.meta.startedAt,
        finishedAt: x.meta.finishedAt,
      }
    : {
        status: 'done',
        final: x.content ?? null,
        startedAt: x.createdAt,
      }
  const m: AssistantMessage = {
    id: x.id,
    role: 'assistant',
    sessionId: x.sessionId,
    createdAt: x.createdAt,
    meta,
  }
  return m
}
