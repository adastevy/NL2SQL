/**
 * 前端 API 统一出口（mock ↔ real 分发层）。
 *
 * 通过 `VITE_USE_MOCK` 环境变量控制：
 *   - `VITE_USE_MOCK=true`（在 `.env` 或启动命令前缀）→ 使用 `frontend/src/mocks/*`，无需后端即可离线演示
 *   - 其他值（含未设置，**Phase 4 默认**）→ 使用真实后端 `/api/*`
 *
 * 所有导出函数的签名在 mock 与 real 两套实现中 **完全一致**，store / 组件只需
 * `import * as api from '../api'` 即可，无需关心底层来源。
 */

import * as mockApi from '../mocks/mockApi'
import { runMockChat } from '../mocks/mockSSE'

import { runChat as realRunChat } from './chat'
import { fetchSchema as realFetchSchema } from './schema'
import {
  createSession as realCreateSession,
  deleteSession as realDeleteSession,
  fetchMessages as realFetchMessages,
  listSessions as realListSessions,
  persistMessages as realPersistMessages,
  renameSession as realRenameSession,
  touchSession as realTouchSession,
} from './sessions'

import type { ChatEventHandler } from '../types'
import type { RunChatOptions } from './chat'

// ============ 开关 ============

/**
 * Vite 在构建时会把 `import.meta.env.VITE_USE_MOCK` 替换为字面量字符串；
 * 只有显式设为 `"true"` 时才启用 mock，其他值（含 undefined）一律走 real。
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

if (import.meta.env.DEV) {
  console.info(
    `[api] 运行模式: ${USE_MOCK ? 'MOCK（离线演示）' : 'REAL（连接后端 /api）'}`,
  )
}

// ============ 基础 ============

export { apiClient, ping } from './client'
export type { PingResponse } from './client'
export type { RunChatOptions } from './chat'

// ============ Session / Message ============

export const listSessions = USE_MOCK ? mockApi.listSessions : realListSessions
export const createSession = USE_MOCK ? mockApi.createSession : realCreateSession
export const renameSession = USE_MOCK ? mockApi.renameSession : realRenameSession
export const deleteSession = USE_MOCK ? mockApi.deleteSession : realDeleteSession
export const touchSession = USE_MOCK ? mockApi.touchSession : realTouchSession
export const fetchMessages = USE_MOCK ? mockApi.fetchMessages : realFetchMessages
export const persistMessages = USE_MOCK ? mockApi.persistMessages : realPersistMessages

// ============ Schema ============

export const fetchSchema = USE_MOCK ? mockApi.fetchSchema : realFetchSchema

// ============ Chat（SSE） ============
//
// `runMockChat` 的签名原本没有 `sessionId`（mock 端不需要），这里用一层轻包装统一成
// 与真实 `runChat` 相同的 `RunChatOptions`，避免调用方分支。

type RunChatFn = (options: RunChatOptions) => Promise<void>

const runMockChatAdapter: RunChatFn = ({ question, onEvent, signal }) =>
  runMockChat({ question, onEvent: onEvent as ChatEventHandler, signal })

export const runChat: RunChatFn = USE_MOCK ? runMockChatAdapter : realRunChat
