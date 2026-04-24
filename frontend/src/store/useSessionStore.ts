/**
 * 会话列表状态：sessions、currentSessionId、CRUD。
 * 数据源当前走 mocks/mockApi；Phase 4 替换为 api/sessions.ts 即可。
 */
import { create } from 'zustand'

import type { Session } from '../types'
import * as api from '../mocks/mockApi'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  loading: boolean
  error: string | null

  loadSessions: () => Promise<void>
  selectSession: (id: string | null) => void
  createSession: (title?: string) => Promise<Session>
  renameSession: (id: string, title: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  touchSession: (id: string, preview?: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,
  error: null,

  async loadSessions() {
    set({ loading: true, error: null })
    try {
      const list = await api.listSessions()
      set((s) => ({
        sessions: list,
        loading: false,
        currentSessionId: s.currentSessionId ?? list[0]?.id ?? null,
      }))
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  selectSession(id) {
    set({ currentSessionId: id })
  },

  async createSession(title) {
    const created = await api.createSession(title)
    set((s) => ({
      sessions: [created, ...s.sessions],
      currentSessionId: created.id,
    }))
    return created
  },

  async renameSession(id, title) {
    const updated = await api.renameSession(id, title)
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? updated : x)),
    }))
  },

  async deleteSession(id) {
    await api.deleteSession(id)
    const { sessions, currentSessionId } = get()
    const next = sessions.filter((s) => s.id !== id)
    set({
      sessions: next,
      currentSessionId: currentSessionId === id ? (next[0]?.id ?? null) : currentSessionId,
    })
  },

  touchSession(id, preview) {
    api.touchSession(id, preview)
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id
          ? {
              ...x,
              updatedAt: new Date().toISOString(),
              preview: preview ?? x.preview,
            }
          : x,
      ),
    }))
  },
}))
