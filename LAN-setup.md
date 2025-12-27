# 局域网共享启动指南（IP：10.219.55.170）

## 前提条件
- 所有设备在同一局域网内，且可以访问 `10.219.55.170`
- 已在项目根目录执行过依赖安装：
  ```powershell
  npm install
  ```
- 已配置后端所需环境变量（至少 `OPENAI_API_KEY`）。

## 启动方式一：分别启动前后端（推荐）
- 启动后端（端口 `3001`）
  ```powershell
  # 可先设置环境变量（示例）
  $env:OPENAI_API_KEY="你的API Key"
  $env:OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
  $env:OPENAI_MODEL="qwen3-max"

  # 启动后端
  node api/server-openai.js
  ```
- 启动前端（端口 `5173`，监听局域网）
  ```powershell
  npx vite --port 5173 --host 10.219.55.170
  # 或
  npx vite --port 5173 --host 0.0.0.0
  ```
- 访问地址
  - 前端：`http://10.219.55.170:5173`
  - 后端健康检查：`http://10.219.55.170:3001/api/health`

## 启动方式二：使用 npm 脚本
- 同时启动（前后端并行）：
  ```powershell
  # 前端脚本默认是 vite；通过 -- 传递 host 参数
  npm run dev:frontend -- --host 10.219.55.170 --port 5173

  # 另开一个终端启动后端
  npm run dev:backend
  ```
- 或直接使用：
  ```powershell
  # 后端
  npm run dev:backend
  # 前端（传参以监听局域网）
  npm run dev:frontend -- --host 0.0.0.0 --port 5173
  ```

## 使用 start.bat（说明）
- 当前 `start.bat` 默认运行：
  - 后端：`node api/server-openai.js`
  - 前端：`npm run dev:frontend`（不带 `--host` 参数时默认仅本机）
- 若希望通过脚本直接局域网共享，建议前端改为：
  ```cmd
  vite --port 5173 --host 0.0.0.0
  ```
  或：
  ```cmd
  vite --port 5173 --host 10.219.55.170
  ```

## Windows 防火墙放行（如无法局域网访问）
- 允许端口 `5173` 与 `3001` 入站访问：
  ```powershell
  netsh advfirewall firewall add rule name="AI Chat Frontend" dir=in action=allow protocol=TCP localport=5173
  netsh advfirewall firewall add rule name="AI Chat Backend" dir=in action=allow protocol=TCP localport=3001
  ```

## 验证步骤
- 在其他局域网设备浏览器访问：
  - `http://10.219.55.170:5173`
  - `http://10.219.55.170:3001/api/health`
- 如访问失败：
  - 确认设备与 `10.219.55.170` 同网段，并能 `ping 10.219.55.170`
  - 检查端口是否被占用，必要时更换端口：
    ```powershell
    npx vite --port 5174 --host 10.219.55.170
    ```
  - 检查 Windows 防火墙入站规则是否已放行上述端口

## 常见问题
- 前端页面能打开但无法回复：
  - 确认后端已启动且日志无错误
  - 检查 `OPENAI_API_KEY` 是否有效
- 局域网设备无法访问：
  - 优先使用 `--host 0.0.0.0` 或明确绑定本机 IP
  - 确认没有代理/VPN影响本地网络路由

## 快速回顾
- 启动后端：`node api/server-openai.js`
- 启动前端（局域网）：`npx vite --port 5173 --host 10.219.55.170`
- 访问：`http://10.219.55.170:5173` 与 `http://10.219.55.170:3001`