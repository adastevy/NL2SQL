/**
 * 中间问答面板：消息列表 + 输入框。
 */
import { useMemo, useRef } from 'react'
import { Empty, Typography } from 'antd'

import { useChatStore } from '../../store/useChatStore'
import { useSessionStore } from '../../store/useSessionStore'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { ChatInputHandle } from './ChatInput'

const { Text } = Typography

export function ChatPanel() {
  const inputRef = useRef<ChatInputHandle | null>(null)

  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const touchSession = useSessionStore((s) => s.touchSession)

  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const streaming = useChatStore((s) => s.streaming)
  const streamingSessionId = useChatStore((s) => s.streamingSessionId)
  const sendQuestion = useChatStore((s) => s.sendQuestion)
  const abort = useChatStore((s) => s.abort)

  const messages = useMemo(
    () => (currentSessionId ? messagesBySession[currentSessionId] ?? [] : []),
    [currentSessionId, messagesBySession],
  )

  // 只有当前会话正在流式时才禁用/显示停止按钮，防止多会话互相干扰
  const currentSessionStreaming = streaming && streamingSessionId === currentSessionId

  if (!currentSessionId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">先在左侧新建或选择一个会话</Text>}
        />
      </div>
    )
  }

  const handleSend = (q: string) => {
    if (!currentSessionId) return
    touchSession(currentSessionId, q.slice(0, 30))
    void sendQuestion(currentSessionId, q)
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <MessageList
          messages={messages}
          streaming={currentSessionStreaming}
          onUseSuggestion={(q) => inputRef.current?.setValue(q)}
        />
      </div>
      <ChatInput
        externalRef={inputRef}
        streaming={currentSessionStreaming}
        onSend={handleSend}
        onStop={abort}
      />
    </div>
  )
}
