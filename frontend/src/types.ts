/**
 * 全局类型定义：前端三栏 UI + Mock + 未来真实 API 共用。
 */

// ============ 会话 ============

export interface Session {
  id: string
  title: string
  createdAt: string // ISO
  updatedAt: string // ISO
  preview?: string
}

// ============ 查询结果 & 图表 ============

export type Primitive = string | number | boolean | null

export interface QueryResult {
  columns: string[]
  rows: Primitive[][]
  rowCount: number
  truncated?: boolean
}

export type ChartType = 'bar' | 'line' | 'pie' | 'table'

/** ECharts option 结构极其灵活，不在编译期强约束，后端透传。 */
export type EChartsOption = Record<string, unknown>

export interface ChartPayload {
  chartType: ChartType
  echartsOption: EChartsOption
  insight?: string
}

// ============ 聊天消息 ============

export type MessageRole = 'user' | 'assistant'

export type AssistantStatus = 'streaming' | 'done' | 'error' | 'aborted'

export interface AssistantMeta {
  thought?: string
  sql?: string
  data?: QueryResult
  chart?: ChartPayload
  final?: string
  status: AssistantStatus
  error?: string
  startedAt: string
  finishedAt?: string
}

export interface UserMessage {
  id: string
  role: 'user'
  sessionId: string
  content: string
  createdAt: string
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  sessionId: string
  createdAt: string
  meta: AssistantMeta
}

export type ChatMessage = UserMessage | AssistantMessage

// ============ SSE 事件协议 ============

export type ChatEvent =
  | { type: 'thought'; delta: string }
  | { type: 'sql'; sql: string }
  | { type: 'data'; data: QueryResult }
  | { type: 'chart'; chart: ChartPayload }
  | { type: 'final'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export type ChatEventHandler = (event: ChatEvent) => void

// ============ 业务表结构（数据字典） ============

export interface SchemaColumn {
  name: string
  type: string
  nullable?: boolean
  comment?: string
}

export interface SchemaTable {
  name: string
  comment?: string
  columns: SchemaColumn[]
  sampleRows: Primitive[][]
}
