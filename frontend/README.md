# NL2SQL Agent - Frontend

基于 Vite + React 19 + TypeScript + Ant Design 5 + ECharts + Zustand 的单页前端。

- Phase 1：三栏 Layout 骨架 + `/api/ping` 连通性展示
- **Phase 2（当前）**：Mock 驱动的完整交互：三栏 UI + 流式气泡 + ECharts 渲染 + 数据字典

## 运行环境

- Node.js 18+（推荐 20+）
- npm 9+

## 首次安装

```powershell
cd frontend
npm install
```

## 启动

```powershell
npm run dev
```

浏览器打开 <http://localhost:5173>，Header 绿色「后端已连接 ✓」即表示与 FastAPI 联通正常。

> 开发态下 `/api/*` 请求会被 Vite 代理到 `http://localhost:8000`，见 `vite.config.ts`。

## 目录结构（Phase 2）

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts              # axios 实例 + ping()（后续接 sessions / schema / chat）
│   ├── components/
│   │   ├── SessionList/           # 左栏：搜索 / 新建 / 重命名 / 删除 / 激活高亮
│   │   ├── ChatPanel/             # 中栏：MessageList + StreamingBubble + ChatInput
│   │   └── ChartPanel/            # 右栏：Tabs[图表/数据表/SQL] + SchemaDrawer
│   ├── mocks/
│   │   ├── mockData.ts            # 3 条预设样例 + Chinook Schema + 建议问法
│   │   ├── mockApi.ts             # sessions CRUD / fetchMessages / fetchSchema（300ms 延时）
│   │   └── mockSSE.ts             # runMockChat：按节奏发射 thought/sql/data/chart/final
│   ├── store/
│   │   ├── useSessionStore.ts
│   │   ├── useChatStore.ts        # 负责编排 SSE 消费
│   │   └── useChartStore.ts
│   ├── types.ts                   # 全局类型（Session / ChatMessage / ChatEvent / Schema ...）
│   ├── App.tsx                    # 三栏 Layout + Header
│   ├── App.css
│   ├── index.css                  # 全局重置 + 流式光标动画
│   └── main.tsx                   # AntD ConfigProvider（zh_CN）+ AntdApp
├── index.html
├── vite.config.ts                 # /api 代理（含 SSE 禁缓冲）
├── tsconfig.*.json
└── package.json
```

## 契约先行策略

- `mocks/mockApi.ts` 与 `mocks/mockSSE.ts` 的对外函数签名 = 未来真实 `api/sessions.ts` + `api/chat.ts` 的签名，Phase 4 只需替换 import 源即可完成联调。
- `types.ts` 为前后端共用的数据结构（`ChatEvent` 判别联合、`QueryResult`、`ChartPayload`），后端 SSE payload 将严格对齐。

## 预设样例

在新会话中依次发送以下问题，可分别看到三种图表与 SSE 流：

1. `销售额 TOP10 的艺人是谁？` → 柱状图
2. `帮我画一个最近 12 个月的销售折线图` → 折线图
3. `各流派销售额占比如何？用饼图展示` → 环形饼图

关键词匹配失败时会按当前会话轮次兜底轮播三个样例。

## 后续阶段

- Phase 3：后端接口按契约落地（LangChain SQL Agent + Qwen3 + SSE）
- Phase 4：替换 `mocks/*` 为真实 API，完成端到端验收
