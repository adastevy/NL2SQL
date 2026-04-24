/**
 * ECharts 渲染器：自适应容器尺寸，空态占位。
 */
import { useEffect, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty, Typography } from 'antd'
import { PieChartOutlined } from '@ant-design/icons'

import type { ChartPayload } from '../../types'

const { Text } = Typography

interface Props {
  chart: ChartPayload | null
  fallbackHint?: string
}

export function ChartRenderer({ chart, fallbackHint = '发送第一条问题后，图表会出现在这里' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ReactECharts | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
      chartRef.current?.getEchartsInstance().resize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 320,
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        position: 'relative',
      }}
    >
      {chart ? (
        <ReactECharts
          ref={(inst) => {
            chartRef.current = inst
          }}
          option={chart.echartsOption}
          notMerge
          lazyUpdate
          style={{ width: '100%', height: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty
            image={<PieChartOutlined style={{ fontSize: 42, color: '#d9d9d9' }} />}
            styles={{ image: { height: 48 } }}
            description={<Text type="secondary">{fallbackHint}</Text>}
          />
        </div>
      )}

      {import.meta.env.DEV && chart && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            bottom: 6,
            fontSize: 11,
            color: '#bfbfbf',
          }}
        >
          {size.width}×{size.height}
        </div>
      )}
    </div>
  )
}
