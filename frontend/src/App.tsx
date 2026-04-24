import { useEffect, useState } from 'react'
import { Badge, Button, Empty, Layout, Space, Tooltip, Typography } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import { ping, type PingResponse } from './api/client'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

type ConnStatus = 'pending' | 'ok' | 'fail'

export default function App() {
  const [status, setStatus] = useState<ConnStatus>('pending')
  const [pong, setPong] = useState<PingResponse | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

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

  useEffect(() => {
    checkBackend()
  }, [])

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
            Phase 1 · 基础框架
          </Text>
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
          width={260}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0', padding: 16 }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Title level={5} style={{ margin: 0 }}>
              会话列表
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              阶段 2 将在此实现新建 / 重命名 / 删除。
            </Text>
            <Empty
              description="暂无会话"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 40 }}
            />
          </Space>
        </Sider>

        <Content
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#f5f6fa',
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            问答区
          </Title>
          <Text type="secondary">
            阶段 2 将在此实现 SSE 流式气泡（思考过程 / SQL / 数据预览 / 最终回答）。
          </Text>

          <div
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Empty description="等待提问" />
          </div>
        </Content>

        <Sider
          width={480}
          theme="light"
          style={{ borderLeft: '1px solid #f0f0f0', padding: 16 }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Title level={5} style={{ margin: 0 }}>
              图表展示
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              阶段 2 将在此实现 ECharts 图表 / 数据表 / SQL 三 Tab。
            </Text>
            <div
              style={{
                marginTop: 24,
                height: 320,
                background: '#fafafa',
                border: '1px dashed #d9d9d9',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Empty description="图表占位" />
            </div>
          </Space>
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
    <Tooltip title={errorMsg || '无法连接到后端，请确认 uvicorn 是否已启动在 8000 端口'}>
      <Space size={4}>
        <CloseCircleFilled style={{ color: '#ff4d4f' }} />
        <Text style={{ color: '#cf1322', fontWeight: 500 }}>后端未连接</Text>
      </Space>
    </Tooltip>
  )
}
