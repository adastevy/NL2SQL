/**
 * 左侧会话列表：
 * - 搜索 / 新建
 * - 激活高亮
 * - 悬停显示「重命名 / 删除」
 */
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Button,
  Dropdown,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Tooltip,
  Typography,
  App as AntdApp,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { useSessionStore } from '../../store/useSessionStore'
import { useChatStore } from '../../store/useChatStore'
import { useChartStore } from '../../store/useChartStore'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Text } = Typography

const ROW_STYLE_BASE: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.15s ease',
}

export function SessionList() {
  const { message, modal } = AntdApp.useApp()
  const sessions = useSessionStore((s) => s.sessions)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const loading = useSessionStore((s) => s.loading)
  const selectSession = useSessionStore((s) => s.selectSession)
  const createSession = useSessionStore((s) => s.createSession)
  const renameSession = useSessionStore((s) => s.renameSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)

  const loadMessages = useChatStore((s) => s.loadMessages)
  const clearForSession = useChatStore((s) => s.clearForSession)
  const resetChart = useChartStore((s) => s.resetForSession)

  const [keyword, setKeyword] = useState('')
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return sessions
    return sessions.filter(
      (s) => s.title.toLowerCase().includes(k) || s.preview?.toLowerCase().includes(k),
    )
  }, [sessions, keyword])

  const handleSelect = async (id: string) => {
    if (id === currentSessionId) return
    selectSession(id)
    await loadMessages(id)
    resetChart(id)
  }

  const handleCreate = async () => {
    const s = await createSession()
    await loadMessages(s.id)
    resetChart(s.id)
    message.success('已创建新会话')
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const title = renameValue.trim()
    if (!title) {
      message.warning('标题不能为空')
      return
    }
    await renameSession(renameTarget, title)
    setRenameTarget(null)
    setRenameValue('')
    message.success('已重命名')
  }

  const handleDelete = (id: string, title: string) => {
    modal.confirm({
      title: '删除会话',
      content: (
        <span>
          确定要删除会话 <Text strong>{title}</Text> 吗？该操作不可恢复。
        </span>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteSession(id)
        clearForSession(id)
        message.success('已删除')
      },
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <Space.Compact style={{ width: '100%' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} block>
          新建会话
        </Button>
      </Space.Compact>

      <Input
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索会话标题"
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
      />

      <div style={{ flex: 1, overflowY: 'auto', marginLeft: -4, marginRight: -4 }}>
        {filtered.length === 0 ? (
          <Empty
            description={keyword ? '没有匹配的会话' : '还没有会话，点击上方新建'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        ) : (
          <List
            loading={loading}
            dataSource={filtered}
            split={false}
            renderItem={(item) => {
              const active = item.id === currentSessionId
              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelect(item.id)
                  }}
                  style={{
                    ...ROW_STYLE_BASE,
                    background: active ? '#e6f4ff' : 'transparent',
                    border: active ? '1px solid #91caff' : '1px solid transparent',
                    margin: '2px 4px',
                  }}
                >
                  <Space style={{ width: '100%' }} align="start">
                    <MessageOutlined
                      style={{
                        color: active ? '#1677ff' : '#8c8c8c',
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Text
                          strong={active}
                          ellipsis={{ tooltip: item.title }}
                          style={{ flex: 1, color: active ? '#1677ff' : undefined }}
                        >
                          {item.title}
                        </Text>
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              {
                                key: 'rename',
                                icon: <EditOutlined />,
                                label: '重命名',
                                onClick: ({ domEvent }) => {
                                  domEvent.stopPropagation()
                                  setRenameTarget(item.id)
                                  setRenameValue(item.title)
                                },
                              },
                              {
                                key: 'delete',
                                icon: <DeleteOutlined />,
                                label: '删除',
                                danger: true,
                                onClick: ({ domEvent }) => {
                                  domEvent.stopPropagation()
                                  handleDelete(item.id, item.title)
                                },
                              },
                            ],
                          }}
                        >
                          <Tooltip title="更多">
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Tooltip>
                        </Dropdown>
                      </div>
                      <Text
                        type="secondary"
                        ellipsis
                        style={{ fontSize: 12, display: 'block' }}
                      >
                        {dayjs(item.updatedAt).fromNow()}
                        {item.preview ? ` · ${item.preview}` : ''}
                      </Text>
                    </div>
                  </Space>
                </div>
              )
            }}
          />
        )}
      </div>

      <Modal
        title="重命名会话"
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={handleRename}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          autoFocus
          value={renameValue}
          maxLength={60}
          showCount
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          placeholder="输入新的会话标题"
        />
      </Modal>
    </div>
  )
}
