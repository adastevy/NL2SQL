/**
 * 消息列表：
 * - 用户气泡（靠右，蓝底白字）
 * - 助手气泡（靠左，StreamingBubble）
 * - 新消息到达/流式更新时自动贴底滚动
 */
import { useEffect, useRef } from 'react'
import { Avatar, Button, Empty, Space, Typography } from 'antd'
import { SendOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import type { ChatMessage } from '../../types'
import { StreamingBubble } from './StreamingBubble'
import { SUGGESTED_QUESTIONS } from '../../mocks/mockData'

const { Text } = Typography

interface Props {
  messages: ChatMessage[]
  streaming: boolean
  onUseSuggestion?: (q: string) => void
}

export function MessageList({ messages, streaming, onUseSuggestion }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // 流式时每 300ms 或消息数变化时贴底
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (!streaming) return
    const el = scrollRef.current
    if (!el) return
    const id = window.setInterval(() => {
      el.scrollTo({ top: el.scrollHeight })
    }, 300)
    return () => window.clearInterval(id)
  }, [streaming])

  if (messages.length === 0) {
    return (
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">
                试试下面这些问题，感受一下整个问答流程
              </Text>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Button
                    key={q}
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => onUseSuggestion?.(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 4px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <Space
              key={m.id}
              align="start"
              size={10}
              style={{ width: '100%', justifyContent: 'flex-end' }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  background: '#1677ff',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '10px 14px',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  boxShadow: '0 1px 2px rgba(22,119,255,0.2)',
                }}
              >
                <div>{m.content}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.72)',
                    marginTop: 4,
                    textAlign: 'right',
                  }}
                >
                  {dayjs(m.createdAt).format('HH:mm:ss')}
                </div>
              </div>
              <Avatar
                size={36}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#595959', flexShrink: 0 }}
              />
            </Space>
          )
        }
        return <StreamingBubble key={m.id} message={m} />
      })}
    </div>
  )
}
