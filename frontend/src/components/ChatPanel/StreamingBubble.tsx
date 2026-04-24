/**
 * 助手气泡：以时间线方式展示 思考 / SQL / 数据预览 / 最终回答 四段信息。
 * 每一段按事件到达顺序逐步显现；流式中显示打字光标。
 */
import { useMemo } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Collapse,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  App as AntdApp,
} from 'antd'
import {
  BulbOutlined,
  CheckCircleTwoTone,
  CodeOutlined,
  CopyOutlined,
  LineChartOutlined,
  LoadingOutlined,
  RobotOutlined,
  StopOutlined,
  TableOutlined,
} from '@ant-design/icons'

import type { AssistantMessage, QueryResult } from '../../types'

const { Text, Paragraph } = Typography

interface Props {
  message: AssistantMessage
}

export function StreamingBubble({ message }: Props) {
  const { meta } = message
  const { message: toast } = AntdApp.useApp()

  const statusTag = useMemo(() => {
    switch (meta.status) {
      case 'streaming':
        return (
          <Tag color="processing" icon={<LoadingOutlined />}>
            生成中
          </Tag>
        )
      case 'done':
        return (
          <Tag color="success" icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}>
            已完成
          </Tag>
        )
      case 'aborted':
        return (
          <Tag color="warning" icon={<StopOutlined />}>
            已停止
          </Tag>
        )
      case 'error':
        return <Tag color="error">出错了</Tag>
    }
  }, [meta.status])

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} 已复制`)
    } catch {
      toast.error('复制失败，请手动选择')
    }
  }

  return (
    <Space align="start" size={10} style={{ width: '100%' }}>
      <Avatar
        size={36}
        icon={<RobotOutlined />}
        style={{ backgroundColor: '#1677ff', flexShrink: 0 }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          padding: '12px 14px',
        }}
      >
        <Space size={6} style={{ marginBottom: 6 }}>
          <Text strong>助手</Text>
          {statusTag}
        </Space>

        {meta.error && (
          <Alert type="error" showIcon message={meta.error} style={{ marginBottom: 8 }} />
        )}

        {/* 思考过程 */}
        {meta.thought && (
          <Collapse
            size="small"
            ghost
            style={{ marginBottom: 8 }}
            items={[
              {
                key: 'thought',
                label: (
                  <Space size={4}>
                    <BulbOutlined style={{ color: '#fa8c16' }} />
                    <Text type="secondary">思考过程</Text>
                    {meta.status === 'streaming' && !meta.sql && (
                      <LoadingOutlined style={{ color: '#fa8c16' }} />
                    )}
                  </Space>
                ),
                children: (
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: '#8c8c8c',
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: 6,
                      padding: 10,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
                    }}
                  >
                    {meta.thought}
                  </pre>
                ),
              },
            ]}
          />
        )}

        {/* SQL */}
        {meta.sql && (
          <SectionCard
            icon={<CodeOutlined style={{ color: '#722ed1' }} />}
            title="生成的 SQL"
            extra={
              <Tooltip title="复制 SQL">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copy(meta.sql ?? '', 'SQL')}
                />
              </Tooltip>
            }
          >
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                color: '#d4d4d4',
                background: '#1e1e1e',
                borderRadius: 6,
                padding: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
              }}
            >
              {meta.sql}
            </pre>
          </SectionCard>
        )}

        {/* 数据预览 */}
        {meta.data && (
          <SectionCard
            icon={<TableOutlined style={{ color: '#13c2c2' }} />}
            title={`数据预览（共 ${meta.data.rowCount} 行${meta.data.truncated ? '，已截断' : ''}，展示前 ${Math.min(
              meta.data.rowCount,
              10,
            )} 行）`}
          >
            <DataPreviewTable data={meta.data} />
          </SectionCard>
        )}

        {/* 图表提示 */}
        {meta.chart && (
          <SectionCard
            icon={<LineChartOutlined style={{ color: '#1677ff' }} />}
            title={`已生成图表：${chartTypeLabel(meta.chart.chartType)}`}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {meta.chart.insight ?? '结果已渲染到右侧图表面板。'}
            </Text>
          </SectionCard>
        )}

        {/* 最终回答 */}
        {(meta.final || meta.status === 'streaming') && (
          <div style={{ marginTop: 4 }}>
            <Paragraph
              style={{
                marginBottom: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.7,
              }}
            >
              {meta.final ?? ''}
              {meta.status === 'streaming' && (
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 16,
                    marginLeft: 2,
                    verticalAlign: '-3px',
                    background: '#1677ff',
                    animation: 'nl2sql-cursor 1s steps(1) infinite',
                  }}
                />
              )}
            </Paragraph>
          </div>
        )}
      </div>
    </Space>
  )
}

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
}

function SectionCard({ icon, title, extra, children }: SectionCardProps) {
  return (
    <div
      style={{
        background: '#fafbfc',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Space size={6}>
          {icon}
          <Text strong style={{ fontSize: 13 }}>
            {title}
          </Text>
        </Space>
        {extra}
      </div>
      {children}
    </div>
  )
}

interface DataPreviewTableProps {
  data: QueryResult
}

function DataPreviewTable({ data }: DataPreviewTableProps) {
  const columns = data.columns.map((c, idx) => ({
    title: c,
    dataIndex: String(idx),
    key: String(idx),
    ellipsis: true as const,
  }))
  const rows = data.rows.slice(0, 10).map((row, rIdx) => {
    const obj: Record<string, unknown> = { key: rIdx }
    row.forEach((cell, cIdx) => {
      obj[String(cIdx)] = cell
    })
    return obj
  })
  return (
    <Table
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: true }}
      bordered
    />
  )
}

function chartTypeLabel(t: string): string {
  switch (t) {
    case 'bar':
      return '柱状图'
    case 'line':
      return '折线图'
    case 'pie':
      return '饼图'
    case 'table':
      return '数据表'
    default:
      return t
  }
}
