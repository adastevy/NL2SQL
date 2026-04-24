# NL2SQL Agent - Frontend

基于 Vite + React 18 + TypeScript + Ant Design 5 的单页前端，Phase 1 只包含三栏 Layout 骨架 + `/api/ping` 连通性展示。

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

## 目录结构（Phase 1）

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts        # axios 实例 + ping()
│   ├── App.tsx              # AntD 三栏 Layout + Header 状态
│   ├── App.css              # 占位（样式由 AntD 接管）
│   ├── index.css            # 全局重置
│   └── main.tsx             # AntD ConfigProvider + 中文 locale
├── index.html
├── vite.config.ts           # /api 代理
├── tsconfig.*.json
└── package.json
```

## 后续阶段

- 阶段 2：Zustand 状态 + Mock SSE + 三栏 UI 全部交互
- 阶段 3：后端接口联调（移除 Mock）
- 阶段 4：端到端验收
