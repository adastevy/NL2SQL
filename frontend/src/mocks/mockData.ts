/**
 * Mock 预设数据：
 * - 3 条典型问答样例（销售 TOP10、月度趋势、流派占比）
 * - Chinook 核心表的 Schema 与样本
 * - 关键词 → 样例 的路由
 *
 * 所有数据仅用于 Phase 2 的纯前端演示，不与后端通信。
 */

import type {
  ChartPayload,
  QueryResult,
  SchemaTable,
  Session,
} from '../types'

// ============ Schema（Chinook 节选） ============

export const MOCK_SCHEMA: SchemaTable[] = [
  {
    name: 'Artist',
    comment: '艺人/乐队',
    columns: [
      { name: 'ArtistId', type: 'INTEGER', nullable: false, comment: '主键' },
      { name: 'Name', type: 'NVARCHAR(120)', nullable: true, comment: '名称' },
    ],
    sampleRows: [
      [1, 'AC/DC'],
      [2, 'Accept'],
      [3, 'Aerosmith'],
    ],
  },
  {
    name: 'Album',
    comment: '专辑',
    columns: [
      { name: 'AlbumId', type: 'INTEGER', nullable: false },
      { name: 'Title', type: 'NVARCHAR(160)', nullable: false },
      { name: 'ArtistId', type: 'INTEGER', nullable: false, comment: '艺人外键' },
    ],
    sampleRows: [
      [1, 'For Those About To Rock We Salute You', 1],
      [2, 'Balls to the Wall', 2],
      [3, 'Restless and Wild', 2],
    ],
  },
  {
    name: 'Track',
    comment: '曲目',
    columns: [
      { name: 'TrackId', type: 'INTEGER', nullable: false },
      { name: 'Name', type: 'NVARCHAR(200)', nullable: false },
      { name: 'AlbumId', type: 'INTEGER', nullable: true },
      { name: 'GenreId', type: 'INTEGER', nullable: true, comment: '流派外键' },
      { name: 'UnitPrice', type: 'NUMERIC(10,2)', nullable: false },
    ],
    sampleRows: [
      [1, 'For Those About To Rock (We Salute You)', 1, 1, 0.99],
      [2, 'Balls to the Wall', 2, 1, 0.99],
      [3, 'Fast As a Shark', 3, 1, 0.99],
    ],
  },
  {
    name: 'Genre',
    comment: '流派',
    columns: [
      { name: 'GenreId', type: 'INTEGER', nullable: false },
      { name: 'Name', type: 'NVARCHAR(120)', nullable: true },
    ],
    sampleRows: [
      [1, 'Rock'],
      [2, 'Jazz'],
      [3, 'Metal'],
    ],
  },
  {
    name: 'Invoice',
    comment: '销售订单',
    columns: [
      { name: 'InvoiceId', type: 'INTEGER', nullable: false },
      { name: 'CustomerId', type: 'INTEGER', nullable: false },
      { name: 'InvoiceDate', type: 'DATETIME', nullable: false },
      { name: 'Total', type: 'NUMERIC(10,2)', nullable: false, comment: '订单总额' },
    ],
    sampleRows: [
      [1, 2, '2023-01-01 00:00:00', 1.98],
      [2, 4, '2023-01-02 00:00:00', 3.96],
      [3, 8, '2023-01-03 00:00:00', 5.94],
    ],
  },
  {
    name: 'InvoiceLine',
    comment: '订单明细',
    columns: [
      { name: 'InvoiceLineId', type: 'INTEGER', nullable: false },
      { name: 'InvoiceId', type: 'INTEGER', nullable: false },
      { name: 'TrackId', type: 'INTEGER', nullable: false },
      { name: 'UnitPrice', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'Quantity', type: 'INTEGER', nullable: false },
    ],
    sampleRows: [
      [1, 1, 2, 0.99, 1],
      [2, 1, 4, 0.99, 1],
      [3, 2, 6, 0.99, 1],
    ],
  },
]

// ============ 预设样例 ============

export interface MockSample {
  id: string
  /** 命中关键词，任意一个匹配即返回该样例 */
  keywords: string[]
  thoughtSteps: string[]
  sql: string
  data: QueryResult
  chart: ChartPayload
  final: string
}

const SAMPLE_TOP_ARTISTS: MockSample = {
  id: 'top-artists',
  keywords: ['top', 'TOP', '艺人', '销售额', '排行', '畅销'],
  thoughtSteps: [
    '用户询问销售额最高的艺人排行，需要按艺人聚合销售额。',
    '探查数据库结构：Artist / Album / Track / InvoiceLine 四张表通过外键关联。',
    '构造 SQL：以 InvoiceLine 为事实表，关联 Track→Album→Artist，按 Artist.Name 分组求和。',
    '取前 10 条，按销售额降序排列。',
  ],
  sql: `SELECT
  ar.Name AS artist,
  ROUND(SUM(il.UnitPrice * il.Quantity), 2) AS revenue
FROM InvoiceLine il
JOIN Track   t  ON il.TrackId   = t.TrackId
JOIN Album   al ON t.AlbumId    = al.AlbumId
JOIN Artist  ar ON al.ArtistId  = ar.ArtistId
GROUP BY ar.Name
ORDER BY revenue DESC
LIMIT 10;`,
  data: {
    columns: ['artist', 'revenue'],
    rows: [
      ['Iron Maiden', 138.6],
      ['U2', 105.93],
      ['Metallica', 90.09],
      ['Led Zeppelin', 86.13],
      ['Os Paralamas Do Sucesso', 64.35],
      ['Deep Purple', 57.42],
      ['Faith No More', 52.47],
      ['Lost', 51.48],
      ['Eric Clapton', 47.52],
      ['R.E.M.', 47.52],
    ],
    rowCount: 10,
  },
  chart: {
    chartType: 'bar',
    insight: 'Iron Maiden 以 138.6 稳居榜首，前五名合计占 TOP10 总销售额约 56%。',
    echartsOption: {
      title: { text: '销售额 TOP10 艺人', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 24, top: 48, bottom: 32 },
      xAxis: { type: 'value', name: '销售额' },
      yAxis: {
        type: 'category',
        inverse: true,
        data: [
          'Iron Maiden',
          'U2',
          'Metallica',
          'Led Zeppelin',
          'Os Paralamas Do Sucesso',
          'Deep Purple',
          'Faith No More',
          'Lost',
          'Eric Clapton',
          'R.E.M.',
        ],
      },
      series: [
        {
          type: 'bar',
          name: '销售额',
          data: [138.6, 105.93, 90.09, 86.13, 64.35, 57.42, 52.47, 51.48, 47.52, 47.52],
          itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', formatter: '{c}' },
        },
      ],
    },
  },
  final:
    '销售额最高的 10 位艺人中，Iron Maiden（138.6）与 U2（105.93）显著领先，建议重点维护这两位艺人的专辑上架与促销资源。',
}

const SAMPLE_MONTHLY_TREND: MockSample = {
  id: 'monthly-trend',
  keywords: ['月度', '月份', '趋势', '折线', '按月'],
  thoughtSteps: [
    '用户希望看到销售额的月度变化趋势，适合用折线图呈现。',
    '从 Invoice 表按 strftime(\'%Y-%m\', InvoiceDate) 分组聚合 Total。',
    '按月份升序排列，保留 12 个月的结果。',
  ],
  sql: `SELECT
  strftime('%Y-%m', InvoiceDate) AS month,
  ROUND(SUM(Total), 2) AS revenue
FROM Invoice
WHERE InvoiceDate >= date('now', '-12 months')
GROUP BY month
ORDER BY month ASC;`,
  data: {
    columns: ['month', 'revenue'],
    rows: [
      ['2025-05', 41.58],
      ['2025-06', 43.56],
      ['2025-07', 47.52],
      ['2025-08', 45.54],
      ['2025-09', 52.47],
      ['2025-10', 55.44],
      ['2025-11', 61.38],
      ['2025-12', 72.27],
      ['2026-01', 58.41],
      ['2026-02', 49.5],
      ['2026-03', 53.46],
      ['2026-04', 60.39],
    ],
    rowCount: 12,
  },
  chart: {
    chartType: 'line',
    insight: '2025 年 12 月达到年度峰值（72.27），随后 1-2 月回落，3-4 月重新反弹，存在季节性。',
    echartsOption: {
      title: { text: '月度销售额趋势', left: 'center' },
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 48, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: [
          '2025-05',
          '2025-06',
          '2025-07',
          '2025-08',
          '2025-09',
          '2025-10',
          '2025-11',
          '2025-12',
          '2026-01',
          '2026-02',
          '2026-03',
          '2026-04',
        ],
      },
      yAxis: { type: 'value', name: '销售额' },
      series: [
        {
          type: 'line',
          smooth: true,
          name: '销售额',
          data: [41.58, 43.56, 47.52, 45.54, 52.47, 55.44, 61.38, 72.27, 58.41, 49.5, 53.46, 60.39],
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: '#52c41a' },
          lineStyle: { width: 3 },
        },
      ],
    },
  },
  final:
    '最近 12 个月销售额呈现上升趋势，12 月是年度峰值（72.27），Q1 略有回落，4 月已恢复到 60.39，建议结合节假日营销节奏进一步放大 12 月的高峰效应。',
}

const SAMPLE_GENRE_SHARE: MockSample = {
  id: 'genre-share',
  keywords: ['流派', '占比', '饼图', 'genre', '分布'],
  thoughtSteps: [
    '用户询问销售额按流派的占比分布，适合饼图。',
    '通过 InvoiceLine→Track→Genre 关联，按 Genre.Name 聚合。',
    '保留前 6 个流派，其余合并为「其他」。',
  ],
  sql: `SELECT
  g.Name AS genre,
  ROUND(SUM(il.UnitPrice * il.Quantity), 2) AS revenue
FROM InvoiceLine il
JOIN Track t  ON il.TrackId = t.TrackId
JOIN Genre g  ON t.GenreId  = g.GenreId
GROUP BY g.Name
ORDER BY revenue DESC
LIMIT 6;`,
  data: {
    columns: ['genre', 'revenue'],
    rows: [
      ['Rock', 826.65],
      ['Latin', 382.14],
      ['Metal', 261.36],
      ['Alternative & Punk', 241.56],
      ['Jazz', 79.2],
      ['Blues', 60.39],
    ],
    rowCount: 6,
  },
  chart: {
    chartType: 'pie',
    insight: 'Rock 一家独大，占比约 45%，Latin 与 Metal 分列二三。',
    echartsOption: {
      title: { text: '销售额按流派分布', left: 'center' },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: 32 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          label: { show: true, formatter: '{b}\n{d}%' },
          data: [
            { value: 826.65, name: 'Rock' },
            { value: 382.14, name: 'Latin' },
            { value: 261.36, name: 'Metal' },
            { value: 241.56, name: 'Alternative & Punk' },
            { value: 79.2, name: 'Jazz' },
            { value: 60.39, name: 'Blues' },
          ],
        },
      ],
    },
  },
  final:
    'Rock 贡献了约 45% 的销售额，是绝对主力；如果希望提升 Jazz / Blues 这类长尾流派，可以考虑定向推荐或专题策划。',
}

export const MOCK_SAMPLES: MockSample[] = [
  SAMPLE_TOP_ARTISTS,
  SAMPLE_MONTHLY_TREND,
  SAMPLE_GENRE_SHARE,
]

/**
 * 根据问题文本匹配样例，命中任一关键词返回；都不命中则轮询回退。
 */
export function pickMockSample(question: string, fallbackIndex = 0): MockSample {
  const q = question.trim()
  if (!q) return MOCK_SAMPLES[fallbackIndex % MOCK_SAMPLES.length]
  const hit = MOCK_SAMPLES.find((s) =>
    s.keywords.some((k) => q.toLowerCase().includes(k.toLowerCase())),
  )
  return hit ?? MOCK_SAMPLES[fallbackIndex % MOCK_SAMPLES.length]
}

// ============ 预设会话 ============

export const MOCK_INITIAL_SESSIONS: Session[] = [
  {
    id: 'sess-demo-1',
    title: '销售额 TOP10 艺人',
    createdAt: '2026-04-20T09:12:00.000Z',
    updatedAt: '2026-04-20T09:15:23.000Z',
    preview: '想看看哪些艺人最畅销',
  },
  {
    id: 'sess-demo-2',
    title: '月度销售趋势分析',
    createdAt: '2026-04-22T14:03:00.000Z',
    updatedAt: '2026-04-22T14:05:10.000Z',
    preview: '按月看销售额变化',
  },
]

// ============ 预设建议问法 ============

export const SUGGESTED_QUESTIONS: string[] = [
  '销售额 TOP10 的艺人是谁？',
  '帮我画一个最近 12 个月的销售折线图',
  '各流派销售额占比如何？用饼图展示',
]
