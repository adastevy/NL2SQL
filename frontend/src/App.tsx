import { useEffect, useState } from 'react'
import { Badge, Button, Layout, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import { USE_MOCK, ping, type PingResponse } from './api'
import { SessionList } from './components/SessionList'
import { ChatPanel } from './components/ChatPanel'
import { ChartPanel } from './components/ChartPanel'
import { useSessionStore } from './store/useSessionStore'
import { useChatStore } from './store/useChatStore'
import { useChartStore } from './store/useChartStore'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

type ConnStatus = 'pending' | 'ok' | 'fail'

export default function App() {
  const [status, setStatus] = useState<ConnStatus>('pending')
  const [pong, setPong] = useState<PingResponse | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const loadSessions = useSessionStore((s) => s.loadSessions)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const loadMessages = useChatStore((s) => s.loadMessages)
  const resetChart = useChartStore((s) => s.resetForSession)

  const checkBackend = async () => {
    setStatus('pending')
    setErrorMsg('')
    try {
      const res = await ping()
      setPong(res)
      setStatus(res.pong ? 'ok' : 'fail')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setStatus('fail')
    } finally {
      setLastCheckedAt(dayjs().format('HH:mm:ss'))
    }
  }

  // 首次挂载：拉会话 + ping
  useEffect(() => {
    void loadSessions()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始化时同步 setStatus('pending') 可接受
    void checkBackend()
  }, [loadSessions])

  // 切换当前会话时：拉消息 + 重置图表状态
  useEffect(() => {
    if (!currentSessionId) return
    void loadMessages(currentSessionId)
    resetChart(currentSessionId)
  }, [currentSessionId, loadMessages, resetChart])

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          boxShadow: '0 1px 4px rgba(0, 21, 41, 0.04)',
        }}
      >
        <Space size={12}>
          <DatabaseOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            NL2SQL 智能数据分析助理
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {USE_MOCK ? 'Phase 2 · Mock 驱动' : 'Phase 4 · 真实后端（Qwen3 + LangChain）'}
          </Text>
          <Tooltip
            title={
              USE_MOCK
                ? '当前为纯前端演示：所有数据来自 mocks/，不经过后端 LLM/SQL。'
                : '当前已连接真实后端：问答走 /api/chat SSE 流式，由 LangChain SQL Agent + Qwen3 生成。'
            }
          >
            <Tag icon={<ExperimentOutlined />} color={USE_MOCK ? 'gold' : 'geekblue'}>
              {USE_MOCK ? 'Mock 模式' : '真实模式'}
            </Tag>
          </Tooltip>
        </Space>

        <Space size={12}>
          <ConnectionBadge status={status} pong={pong} errorMsg={errorMsg} />
          <Tooltip title={lastCheckedAt ? `最后检测：${lastCheckedAt}` : '点击重新检测后端'}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={checkBackend}
              loading={status === 'pending'}
            >
              重新检测
            </Button>
          </Tooltip>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={280}
          theme="light"
          style={{
            borderRight: '1px solid #f0f0f0',
            padding: 12,
            display: 'flex',
          }}
        >
          <SessionList />
        </Sider>

        <Content
          style={{
            padding: 16,
            background: '#f5f6fa',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <ChatPanel />
        </Content>

        <Sider
          width={520}
          theme="light"
          style={{
            borderLeft: '1px solid #f0f0f0',
            padding: 14,
            display: 'flex',
          }}
        >
          <ChartPanel />
        </Sider>
      </Layout>
    </Layout>
  )
}

interface BadgeProps {
  status: ConnStatus
  pong: PingResponse | null
  errorMsg: string
}

function ConnectionBadge({ status, pong, errorMsg }: BadgeProps) {
  if (status === 'pending') {
    return (
      <Badge
        status="processing"
        text={
          <Text type="secondary">
            <SyncOutlined spin /> 检测中…
          </Text>
        }
      />
    )
  }

  if (status === 'ok') {
    return (
      <Tooltip
        title={
          pong
            ? `service: ${pong.service} · version: ${pong.version} · server time: ${pong.time}`
            : '已连接'
        }
      >
        <Space size={4}>
          <CheckCircleFilled style={{ color: '#52c41a' }} />
          <Text style={{ color: '#389e0d', fontWeight: 500 }}>后端已连接</Text>
        </Space>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={errorMsg || '后端未启动或不可达，Phase 2 不影响本地 Mock 体验'}>
      <Space size={4}>
        <CloseCircleFilled style={{ color: '#ff4d4f' }} />
        <Text style={{ color: '#cf1322', fontWeight: 500 }}>后端未连接</Text>
      </Space>
    </Tooltip>
  )
}
