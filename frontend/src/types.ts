/**
 * 全局类型定义：前端三栏 UI + Mock + 真实 API 共用。
 *
 * 所有可空字段使用 `string | null | undefined` 以同时兼容：
 * - 后端 Pydantic 对可选字段序列化为 `null`
 * - Mock 数据里用 `undefined` 表示「未提供」
 */

// ============ 会话 ============

export interface Session {
  id: string
  title: string
  createdAt: string // ISO
  updatedAt: string // ISO
  /** 后端在无最近问题时返回 null；前端 mock 可能不提供 */
  preview?: string | null
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
  /** 后端图表生成失败或未生成洞察时为 null */
  insight?: string | null
}

// ============ 聊天消息 ============

export type MessageRole = 'user' | 'assistant'

export type AssistantStatus = 'streaming' | 'done' | 'error' | 'aborted'

export interface AssistantMeta {
  thought?: string | null
  sql?: string | null
  data?: QueryResult | null
  chart?: ChartPayload | null
  /** 最终答案：后端 SSE 在 Agent 结束后仅推送一次完整内容 */
  final?: string | null
  status: AssistantStatus
  error?: string | null
  startedAt: string
  finishedAt?: string | null
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
//
// 注：后端 §3.4.6 规定：
//   - `thought` 流式推送（增量累加）
//   - `sql` / `data` / `chart` 覆盖式一次性推送
//   - `final` **仅在 Agent 全部结束后推送一次完整文本**（非增量）
//   - `done` / `error` 为终结事件

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
  nullable?: boolean | null
  comment?: string | null
}

export interface SchemaTable {
  name: string
  comment?: string | null
  columns: SchemaColumn[]
  sampleRows: Primitive[][]
}
