@echo off
echo 正在启动AI对话系统...
echo.

:: 启动后端服务器
echo 启动后端服务器...
start cmd /k "cd api && node server.cjs"
timeout /t 3 /nobreak > nul

:: 启动前端服务器
echo 启动前端服务器...
start cmd /k "npm run dev:frontend"
timeout /t 5 /nobreak > nul

echo.
echo AI对话系统已启动！
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:3001
echo.
echo 按任意键关闭所有服务...
pause > nul

:: 关闭所有node进程
taskkill /F /IM node.exe > nul 2>&1
echo 服务已关闭！