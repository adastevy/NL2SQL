/**
 * 右侧图表面板：Tabs[图表/数据表/SQL] + 顶部「数据字典」入口。
 */
import { useMemo, useState } from 'react'
import { App as AntdApp, Button, Empty, Space, Table, Tabs, Tooltip, Typography } from 'antd'
import {
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  TableOutlined,
} from '@ant-design/icons'

import { ChartRenderer } from './ChartRenderer'
import { SchemaDrawer } from './SchemaDrawer'
import { useChartStore } from '../../store/useChartStore'

const { Text } = Typography

type TabKey = 'chart' | 'data' | 'sql'

export function ChartPanel() {
  const current = useChartStore((s) => s.current)
  const currentSql = useChartStore((s) => s.currentSql)

  const [schemaOpen, setSchemaOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('chart')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          结果展示
        </Typography.Title>
        <Button
          icon={<DatabaseOutlined />}
          onClick={() => setSchemaOpen(true)}
          size="small"
        >
          数据字典
        </Button>
      </div>

      {current?.insight && (
        <div
          style={{
            background: '#f0f7ff',
            border: '1px solid #bae0ff',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#0958d9',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <Text style={{ color: '#0958d9' }}>💡 {current.insight}</Text>
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        size="small"
        style={{ marginBottom: -4 }}
        items={[
          {
            key: 'chart',
            label: (
              <Space size={4}>
                <LineChartOutlined />
                <span>图表</span>
              </Space>
            ),
          },
          {
            key: 'data',
            label: (
              <Space size={4}>
                <TableOutlined />
                <span>数据表</span>
              </Space>
            ),
          },
          {
            key: 'sql',
            label: (
              <Space size={4}>
                <CodeOutlined />
                <span>SQL</span>
              </Space>
            ),
          },
        ]}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {activeTab === 'chart' && <ChartRenderer chart={current} />}
        {activeTab === 'data' && <DataTablePane />}
        {activeTab === 'sql' && <SqlPane sql={currentSql} />}
      </div>

      <SchemaDrawer open={schemaOpen} onClose={() => setSchemaOpen(false)} />
    </div>
  )
}

function DataTablePane() {
  const currentData = useChartStore((s) => s.currentData)

  const { columns, rows } = useMemo(() => {
    if (!currentData) return { columns: [], rows: [] as Record<string, unknown>[] }
    const cols = currentData.columns.map((c, idx) => ({
      title: c,
      dataIndex: String(idx),
      key: String(idx),
      ellipsis: true as const,
    }))
    const rs = currentData.rows.map((row, rIdx) => {
      const obj: Record<string, unknown> = { key: rIdx }
      row.forEach((cell, cIdx) => {
        obj[String(cIdx)] = cell
      })
      return obj
    })
    return { columns: cols, rows: rs }
  }, [currentData])

  if (!currentData) {
    return (
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
        <Empty description="暂无查询结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: 10,
        overflow: 'auto',
      }}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        共 {currentData.rowCount} 行{currentData.truncated ? '（已截断）' : ''}
      </Text>
      <Table
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: true }}
        style={{ marginTop: 8 }}
        bordered
      />
    </div>
  )
}

function SqlPane({ sql }: { sql: string | null }) {
  const { message: toast } = AntdApp.useApp()
  const copy = async () => {
    if (!sql) return
    try {
      await navigator.clipboard.writeText(sql)
      toast.success('SQL 已复制')
    } catch {
      toast.error('复制失败，请手动选择')
    }
  }
  if (!sql) {
    return (
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
        <Empty description="暂无 SQL" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }
  return (
    <div
      style={{
        flex: 1,
        background: '#1e1e1e',
        border: '1px solid #141414',
        borderRadius: 8,
        padding: 12,
        position: 'relative',
        overflow: 'auto',
      }}
    >
      <Tooltip title="复制">
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined style={{ color: '#fff' }} />}
          onClick={copy}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            color: '#fff',
          }}
        />
      </Tooltip>
      <pre
        style={{
          margin: 0,
          color: '#d4d4d4',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        {sql}
      </pre>
    </div>
  )
}
