/**
 * 真实后端 · 数据字典接入层。
 *
 * 后端 `GET /api/schema` 返回 `{tables: SchemaTable[]}`（SchemaOut 包装对象），
 * 前端旧 mock 直接返回 `SchemaTable[]`。这里统一解包为数组，对外签名与
 * `mocks/mockApi.fetchSchema` 完全一致。
 */
import type { SchemaTable } from '../types'
import { apiClient } from './client'

interface BackendSchemaOut {
  tables: SchemaTable[]
}

export async function fetchSchema(): Promise<SchemaTable[]> {
  const { data } = await apiClient.get<BackendSchemaOut>('/schema')
  return data.tables ?? []
}
