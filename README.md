# AI对话系统

一个功能完整的大模型对话系统，支持前后端分离架构。

## 🚀 功能特点

- ✅ **前后端分离**：React + Express 架构
- ✅ **流式响应**：实时显示AI回复
- ✅ **上下文关联**：支持多轮对话
- ✅ **停止生成**：可中断正在生成的回复
- ✅ **清除历史**：一键清除对话记录
- ✅ **现代化UI**：美观的聊天界面

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS
- **后端**：Express.js + Node.js
- **图标**：Lucide React
- **构建工具**：Vite

## 📦 安装和运行

### 方法一：分别启动

1. **启动后端服务器**（端口3001）：
   ```cmd
   cd api
   node server.cjs
   ```

2. **启动前端服务器**（端口5173）：
   ```cmd
   npm run dev:frontend
   ```

### 方法二：一键启动

运行启动脚本：
```cmd
start.bat
```

## 🌐 访问地址

- **前端应用**：http://localhost:5173
- **后端API**：http://localhost:3001
- **健康检查**：http://localhost:3001/api/health

## 🔧 API接口

### 发送消息
- **POST** `/api/chat`
- **请求体**：
  ```json
  {
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "conversationId": "default"
  }
  ```

### 停止生成
- **POST** `/api/chat/stop`

### 健康检查
- **GET** `/api/health`

## 💡 使用说明

1. 在输入框中输入问题
2. 按Enter键或点击发送按钮
3. 等待AI回复（显示为流式文本）
4. 可随时点击"停止"中断回复
5. 点击"清除历史"清空对话记录

## ⚠️ 注意事项

- 当前版本使用模拟AI回复，实际使用时需要配置OpenAI API
- 确保后端服务先启动，前端服务才能正常访问API
- 如果遇到端口冲突，请修改相应的端口配置

## 🔗 配置OpenAI API

如需使用真实的OpenAI API，项目已集成 `api/server-openai.js`，并支持流式多轮对话。

### 实现说明（逐项）

1. 环境配置
   - 关键环境变量在 `.env`：
     - `PORT=3001`（后端端口） `.env:5`
     - `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`（外部模型配置）读取于 `api/server-openai.js:33-36`
     - 可选 `PUBLIC_BASE_URL`（用于拼接上传文件访问地址）在上传接口使用 `api/server-openai.js:53-60`
   - 前端代理：`vite.config.ts:6-13` 将 `/api` 转发到后端。
   - 启动脚本：`package.json` 中 `dev:frontend` 与 `dev:backend`，分别运行前后端；`dev` 并行启动。

2. 调用 API 进行多轮流式对话
   - 前端构造请求：
     - 将系统预设与历史消息拼接成 `messages` 数组 `src/App.tsx:124-131`，其中历史来自当前对话的消息列表 `src/App.tsx:110-114`。
     - 发送请求并读取浏览器原生流：`response.body.getReader()` 循环解析 SSE 行，增量更新助手消息 `src/App.tsx:160-195`。
   - 后端流式桥接：
     - 向外部模型以 SSE 请求，并将增量 `delta.content` 转为 `data: {content}` 写回客户端 `api/server-openai.js:200-213`。
     - 在响应头附带 `X-Stream-Id` 以支持停止生成 `api/server-openai.js:186-191`。

3. 清除历史功能
   - 状态层实现删除对话：`deleteConversation` 会移除指定对话并重置当前会话 `src/stores/conversationStore.ts:93-117`。
   - UI 触发删除：侧边栏的删除按钮调用 `handleDeleteConversation` `src/components/Sidebar.tsx:32-37` 与按钮事件 `src/components/Sidebar.tsx:213-226`。

4. 增加重试
   - 每条助手消息右侧提供“重试”按钮：
     - 回溯最近的用户消息作为重试内容，并调用 `sendMessage(retryPrompt, message.id)` `src/App.tsx:503-511`。
     - 这样会复用当前上下文，覆盖该助手消息的内容，实现相同语境下的再次生成。

5. 增加 system 预设指令功能
   - 在设置弹窗中填写并保存预设：`SettingsModal` 写入 `presetPrompt` `src/components/SettingsModal.tsx:39-47`。
   - 发送消息时自动在 `messages` 最前追加 `{ role: 'system', content: presetPrompt }` `src/App.tsx:124-129`，实现对话全局指令。

6. 增加停止生成功能
   - 前端：点击停止触发 `stopGeneration`，调用后端的停止接口并中止 `AbortController` `src/App.tsx:218-240`。
   - 后端：维护活跃流映射 `activeStreams`，收到 `/api/chat/stop` 时结束对应流 `api/server-openai.js:283-301`。

补充：多模态图片注入
   - 用户选择的图片会随消息一起发送到后端，后端将其转为 Base64 Data URL 并以内联多模态格式注入到最后一条用户消息中，供模型识别 `api/server-openai.js:94-147`；前端的用户气泡会展示 50×50 缩略图，点击可放大 `src/App.tsx:426-434`。
