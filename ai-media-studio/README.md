# AI Media Studio

> 在线版的 Cherry Studio —— 通过中转站 API 一站式接入文生图、文生视频、LLM 聊天与 Agent 对话能力。

基于 [CodeBuddy Agent SDK](https://www.codebuddy.ai/docs/zh/cli/sdk-typescript) 构建的全栈 AI 创作平台，使用 React + Express + TypeScript。

## ✨ 功能特性

| 模块 | 描述 |
| --- | --- |
| 🤖 **Agent 对话** | 基于 CodeBuddy Agent SDK 的智能体对话，支持多 Agent、工具调用、权限控制、SQLite 持久化会话 |
| 💬 **LLM Playground** | 通过中转站 API 直接进行 OpenAI 兼容协议的对话，自由切换 Provider 与模型，流式输出 |
| 🎨 **文生图工作台** | 调用任意支持 `images/generations` 的中转站，支持尺寸/质量/数量/风格控制，历史记录回看 |
| 🎬 **文生视频工作台** | 调用任意支持 `videos/generations` 的中转站，自动轮询任务状态、进度展示、视频下载 |
| 🔌 **中转站 API 管理** | 集中管理多个 OpenAI 兼容 Provider（OpenAI / OneAPI / NewAPI / DeepSeek / 通义 / GLM 等），支持能力标签、模型清单、连通性测试、一键导入 `/models` |
| 🌗 **明暗主题** | TDesign React 风格的主题切换，桌面端布局 |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 CodeBuddy API Key（仅 Agent 对话功能需要）

```bash
cp .env.example .env
# 编辑 .env 填入 CODEBUDDY_API_KEY
```

> 中转站的 API Key 在「中转站」页面动态填写，无需配置环境变量。

### 3. 启动开发服务

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3000

### 4. 配置中转站

打开侧边栏「中转站 API」 → 「新增 Provider」，填入：

- **名称**：自定义，如「我的 OneAPI」
- **Base URL**：例如 `https://api.openai.com/v1` 或自建中转站地址
- **API Key**：你的密钥
- **能力**：勾选 LLM 聊天 / 文生图 / 文生视频
- **模型清单**：手动输入或点击「测试连通性」自动从 `/models` 接口拉取

支持的预设：OpenAI / OneAPI / NewAPI / DeepSeek / 通义千问 / 智谱 GLM。

## 📦 项目结构

```
ai-media-studio/
├── server/
│   ├── index.ts         # Express 主入口（Agent SDK + 路由分发）
│   ├── db.ts            # SQLite 会话/消息表
│   ├── providers.ts     # 中转站 Provider CRUD + 生成历史
│   └── media.ts         # OpenAI 兼容协议封装（chat/image/video）
├── src/
│   ├── App.tsx          # 路由 + 整体布局
│   ├── components/
│   │   ├── Sidebar.tsx        # 多模块侧边栏
│   │   ├── Header.tsx
│   │   └── ...                # Agent 对话相关组件
│   ├── pages/
│   │   ├── ChatPage.tsx          # Agent 对话页
│   │   ├── ProviderChatPage.tsx  # 中转站 LLM Playground
│   │   ├── ImageStudioPage.tsx   # 文生图工作台
│   │   ├── VideoStudioPage.tsx   # 文生视频工作台
│   │   └── ProvidersPage.tsx     # 中转站管理
│   ├── hooks/
│   │   ├── useProviders.ts    # 中转站 CRUD
│   │   ├── useChat.ts         # Agent SDK 流式对话
│   │   └── ...
│   └── types/
│       └── provider.ts
└── data/                # SQLite 数据存储
```

## 🔌 中转站协议约定

所有中转站均按 OpenAI 兼容格式调用：

| 能力 | 端点 | 说明 |
| --- | --- | --- |
| 聊天 | `POST {baseUrl}/chat/completions` | SSE 流式 |
| 文生图 | `POST {baseUrl}/images/generations` | 入参兼容 OpenAI Images API（n、size、quality、style） |
| 文生视频 | `POST {baseUrl}/videos/generations` | 同步返回 `data[].url`，或返回任务 id 后由后端轮询 `GET {baseUrl}/videos/generations/{id}` |
| 模型列表 | `GET {baseUrl}/models` | 用于「测试连通性」与一键导入 |

只要你的中转站遵循 OpenAI 协议（One-API、New-API、绝大多数聚合站、DeepSeek 官方、阿里百炼 OpenAI 兼容模式、智谱 GLM 等），就能直接接入。

## 🛠️ 命令

```bash
npm run dev       # 同时启动前后端
npm run dev:server  # 仅后端
npm run dev:client  # 仅前端
npm run build       # 生产构建
```

## 📝 备注

- Agent 对话能力依赖 [`@tencent-ai/agent-sdk`](https://www.codebuddy.ai/docs/zh/cli/sdk-typescript)，需要登录 CodeBuddy 或配置 API Key。
- 中转站功能完全独立于 Agent SDK，即使没有 CodeBuddy Key，也能通过中转站使用 LLM/Image/Video 能力。
- 所有 API Key 均存储在本地 SQLite 数据库中（仅当前主机），不会上传到任何第三方。
- 如果某些中转站不支持视频生成或返回格式特殊，可在 `server/media.ts` 中扩展。
