/**
 * 数据字典抽屉：展示业务表结构与样本行。
 */
import { useEffect, useState } from 'react'
import {
  Alert,
  Collapse,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'

import type { SchemaTable } from '../../types'
import { fetchSchema } from '../../api'

const { Text } = Typography

interface Props {
  open: boolean
  onClose: () => void
}

export function SchemaDrawer({ open, onClose }: Props) {
  const [tables, setTables] = useState<SchemaTable[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (tables) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 抽屉打开时触发一次性拉取
    setLoading(true)
    fetchSchema()
      .then(setTables)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [open, tables])

  return (
    <Drawer
      title={
        <Space>
          <DatabaseOutlined />
          <span>数据字典</span>
          <Tag color="blue">Chinook</Tag>
        </Space>
      }
      width={520}
      open={open}
      onClose={onClose}
      destroyOnHidden={false}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {loading && !tables ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !tables || tables.length === 0 ? (
        <Empty description="暂无数据" />
      ) : (
        <Collapse
          accordion
          items={tables.map((t) => ({
            key: t.name,
            label: (
              <Space>
                <Text strong>{t.name}</Text>
                {t.comment && <Text type="secondary">{t.comment}</Text>}
                <Tag>{t.columns.length} 列</Tag>
              </Space>
            ),
            children: <SchemaTableBlock table={t} />,
          }))}
        />
      )}
    </Drawer>
  )
}

function SchemaTableBlock({ table }: { table: SchemaTable }) {
  const columns = [
    { title: '字段', dataIndex: 'name', key: 'name', width: 160 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
    {
      title: '说明',
      dataIndex: 'comment',
      key: 'comment',
      render: (v: string | undefined) => v ?? <Text type="secondary">-</Text>,
    },
  ]
  const sampleColumns = table.columns.map((c, idx) => ({
    title: c.name,
    dataIndex: String(idx),
    key: String(idx),
    ellipsis: true as const,
  }))
  const sampleRows = table.sampleRows.slice(0, 5).map((row, rIdx) => {
    const obj: Record<string, unknown> = { key: rIdx }
    row.forEach((cell, cIdx) => {
      obj[String(cIdx)] = cell
    })
    return obj
  })

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Table
        size="small"
        pagination={false}
        columns={columns}
        dataSource={table.columns.map((c, i) => ({ ...c, key: i }))}
      />
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          样本数据（前 {sampleRows.length} 行）
        </Text>
        <Table
          size="small"
          pagination={false}
          columns={sampleColumns}
          dataSource={sampleRows}
          scroll={{ x: true }}
          style={{ marginTop: 6 }}
          bordered
        />
      </div>
    </Space>
  )
}
