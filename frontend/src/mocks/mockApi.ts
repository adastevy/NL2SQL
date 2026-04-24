/**
 * Mock 版 REST API：模拟 300ms 延时，对外 API 签名与未来真实 api/* 保持一致，
 * Phase 4 联调时替换实现即可，调用方无感知。
 */

import type { ChatMessage, Session, SchemaTable } from '../types'
import { MOCK_INITIAL_SESSIONS, MOCK_SCHEMA } from './mockData'

const LATENCY_MS = 300

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

function nowIso(): string {
  return new Date().toISOString()
}

// ============ 内存态（模块级单例） ============

let _sessions: Session[] = [...MOCK_INITIAL_SESSIONS]
const _messagesBySession: Record<string, ChatMessage[]> = {}

// ============ Session API ============

export async function listSessions(): Promise<Session[]> {
  return delay([..._sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
}

export async function createSession(title?: string): Promise<Session> {
  const now = nowIso()
  const sess: Session = {
    id: `sess-${Math.random().toString(36).slice(2, 10)}`,
    title: title?.trim() || '新会话',
    createdAt: now,
    updatedAt: now,
  }
  _sessions = [sess, ..._sessions]
  _messagesBySession[sess.id] = []
  return delay(sess)
}

export async function renameSession(id: string, title: string): Promise<Session> {
  const idx = _sessions.findIndex((s) => s.id === id)
  if (idx < 0) throw new Error(`会话不存在: ${id}`)
  const updated: Session = {
    ..._sessions[idx],
    title: title.trim() || _sessions[idx].title,
    updatedAt: nowIso(),
  }
  _sessions = [..._sessions.slice(0, idx), updated, ..._sessions.slice(idx + 1)]
  return delay(updated)
}

export async function deleteSession(id: string): Promise<void> {
  _sessions = _sessions.filter((s) => s.id !== id)
  delete _messagesBySession[id]
  return delay(undefined)
}

export async function touchSession(id: string, preview?: string): Promise<void> {
  const idx = _sessions.findIndex((s) => s.id === id)
  if (idx < 0) return
  _sessions[idx] = {
    ..._sessions[idx],
    updatedAt: nowIso(),
    preview: preview ?? _sessions[idx].preview,
  }
}

// ============ Message API ============

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  return delay([...(_messagesBySession[sessionId] ?? [])])
}

export function persistMessages(sessionId: string, messages: ChatMessage[]): void {
  _messagesBySession[sessionId] = [...messages]
}

// ============ Schema API ============

export async function fetchSchema(): Promise<SchemaTable[]> {
  return delay(MOCK_SCHEMA)
}
