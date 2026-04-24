/**
 * 图表状态：当前会话正在展示的 ChartPayload + 历史图表（备用）。
 */
import { create } from 'zustand'

import type { ChartPayload, QueryResult } from '../types'

interface ChartState {
  current: ChartPayload | null
  currentData: QueryResult | null
  currentSql: string | null
  historyBySession: Record<string, ChartPayload[]>

  setChart: (sessionId: string, chart: ChartPayload) => void
  setData: (data: QueryResult | null) => void
  setSql: (sql: string | null) => void
  resetForSession: (sessionId: string) => void
}

export const useChartStore = create<ChartState>((set) => ({
  current: null,
  currentData: null,
  currentSql: null,
  historyBySession: {},

  setChart(sessionId, chart) {
    set((s) => ({
      current: chart,
      historyBySession: {
        ...s.historyBySession,
        [sessionId]: [...(s.historyBySession[sessionId] ?? []), chart],
      },
    }))
  },

  setData(data) {
    set({ currentData: data })
  },

  setSql(sql) {
    set({ currentSql: sql })
  },

  resetForSession(sessionId) {
    set((s) => {
      const history = s.historyBySession[sessionId] ?? []
      const last = history.at(-1) ?? null
      return {
        current: last,
        currentData: null,
        currentSql: null,
      }
    })
  },
}))
