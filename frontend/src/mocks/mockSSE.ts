/**
 * Mock SSE：按节奏向调用方逐段发射 thought/sql/data/chart/final 事件，
 * 模拟 Phase 3 `/api/chat` 的真实流式响应，支持 AbortSignal 中止。
 */

import type { ChatEvent, ChatEventHandler } from '../types'
import { pickMockSample } from './mockData'

/** 每段思考文字的逐字速度（毫秒/字） */
const THOUGHT_CHAR_INTERVAL_MS = 18
/** 各大阶段之间的间隔 */
const STAGE_GAP_MS = 220
/** 思考段落之间的间隔 */
const PARAGRAPH_GAP_MS = 140

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function emitThoughtStream(
  text: string,
  emit: ChatEventHandler,
  signal: AbortSignal | undefined,
  intervalMs: number,
): Promise<void> {
  // 以 2~3 个字符为一个 chunk，更接近真实 LLM 流式节奏
  const chunkSize = 2
  for (let i = 0; i < text.length; i += chunkSize) {
    const delta = text.slice(i, i + chunkSize)
    emit({ type: 'thought', delta })
    await wait(intervalMs, signal)
  }
}

export interface RunMockChatOptions {
  question: string
  onEvent: ChatEventHandler
  signal?: AbortSignal
  /** 当问题无法命中关键词时，用该索引兜底选样例 */
  fallbackIndex?: number
}

/**
 * 启动一轮 Mock 问答。返回 Promise，正常结束则 resolve；被中止则以 AbortError 结束；
 * 内部异常也会通过 onEvent({type:'error'}) 通知调用方后再抛出。
 */
export async function runMockChat(options: RunMockChatOptions): Promise<void> {
  const { question, onEvent, signal, fallbackIndex = 0 } = options
  const sample = pickMockSample(question, fallbackIndex)

  try {
    await wait(STAGE_GAP_MS, signal)

    // 1) thought：逐段流式（增量累加）
    for (const para of sample.thoughtSteps) {
      await emitThoughtStream(para + '\n', onEvent, signal, THOUGHT_CHAR_INTERVAL_MS)
      await wait(PARAGRAPH_GAP_MS, signal)
    }
    await wait(STAGE_GAP_MS, signal)

    onEvent({ type: 'sql', sql: sample.sql })
    await wait(STAGE_GAP_MS, signal)

    onEvent({ type: 'data', data: sample.data })
    await wait(STAGE_GAP_MS, signal)

    onEvent({ type: 'chart', chart: sample.chart })
    await wait(STAGE_GAP_MS, signal)

    // 2) final：与真实后端 §3.4.6 对齐，Agent 结束后一次性推送完整文本
    onEvent({ type: 'final', delta: sample.final })
    onEvent({ type: 'done' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    onEvent({ type: 'error', message })
    throw err
  }
}

/** 便于测试：导出常量供 UI 展示文案使用 */
export const MOCK_SSE_TIMING = {
  THOUGHT_CHAR_INTERVAL_MS,
  STAGE_GAP_MS,
  PARAGRAPH_GAP_MS,
}

export type { ChatEvent }
