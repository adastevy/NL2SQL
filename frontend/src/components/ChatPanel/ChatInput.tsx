/**
 * 问答输入框：
 * - 多行，Enter 发送，Shift+Enter 换行
 * - 生成中禁用输入，按钮切换为「停止生成」
 */
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import { Button, Input, Space, Tooltip, Typography } from 'antd'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import type { TextAreaRef } from 'antd/es/input/TextArea'

const { Text } = Typography

interface Props {
  streaming: boolean
  disabled?: boolean
  onSend: (value: string) => void
  onStop: () => void
  placeholder?: string
  externalRef?: Ref<ChatInputHandle>
}

export interface ChatInputHandle {
  setValue: (v: string) => void
  focus: () => void
}

export function ChatInput({
  streaming,
  disabled,
  onSend,
  onStop,
  placeholder = '输入你的数据问题，Enter 发送 · Shift+Enter 换行',
  externalRef,
}: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<TextAreaRef | null>(null)

  useImperativeHandle(
    externalRef,
    () => ({
      setValue: (v: string) => {
        setValue(v)
        requestAnimationFrame(() => textareaRef.current?.focus())
      },
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  )

  useEffect(() => {
    if (!streaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [streaming, disabled])

  const canSend = value.trim().length > 0 && !streaming && !disabled

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e4e6eb',
        padding: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
      }}
    >
      <Input.TextArea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? '请先选择或创建一个会话' : placeholder}
        autoSize={{ minRows: 2, maxRows: 6 }}
        disabled={disabled || streaming}
        variant="borderless"
        style={{ resize: 'none', padding: 0 }}
      />
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {streaming ? '助手正在思考中…' : 'Enter 发送 · Shift+Enter 换行'}
        </Text>
        <Space>
          {streaming ? (
            <Tooltip title="停止本次生成">
              <Button danger icon={<StopOutlined />} onClick={onStop}>
                停止生成
              </Button>
            </Tooltip>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!canSend}
            >
              发送
            </Button>
          )}
        </Space>
      </div>
    </div>
  )
}
