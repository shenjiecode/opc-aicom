#!/bin/bash
set -e

# ========================================
# E2E测试启动脚本
# ========================================

echo "========================================"
echo "  启动E2E测试环境"
echo "========================================"

# 检查配置文件
if [ ! -f "backend/.env.e2e" ]; then
    echo "❌ 错误: backend/.env.e2e 文件不存在"
    echo ""
    echo "请执行以下步骤："
    echo "  1. cp backend/.env.e2e.example backend/.env.e2e"
    echo "  2. 编辑 backend/.env.e2e，填入百度千帆API Key"
    echo ""
    echo "获取API Key: https://console.bce.baidu.com/qianfan/"
    exit 1
fi

# 加载环境变量
echo "📋 加载环境变量..."
set -a
source backend/.env.e2e
set +a

# 检查API Key
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-qianfan-api-key-here" ]; then
    echo "❌ 错误: OPENAI_API_KEY 未设置或仍为默认值"
    echo ""
    echo "请编辑 backend/.env.e2e，填入你的百度千帆API Key"
    echo "获取API Key: https://console.bce.baidu.com/qianfan/"
    exit 1
fi

echo "✅ API Key已配置: ${OPENAI_API_KEY:0:10}..."

# ----------------------------------------
# 启动后端服务
# ----------------------------------------
echo ""
echo "🚀 启动后端服务..."

# 检查端口是否被占用
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口8080已被占用，尝试停止..."
    kill $(lsof -Pi :8080 -sTCP:LISTEN -t) 2>/dev/null || true
    sleep 2
fi

cd backend
go run cmd/server/main.go &
BACKEND_PID=$!
cd ..

echo "   后端PID: $BACKEND_PID"

# ----------------------------------------
# 等待服务就绪
# ----------------------------------------
echo ""
echo "⏳ 等待后端服务启动..."

MAX_WAIT=30
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8080/api/home/stats -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
        echo "✅ 后端服务启动成功"
        break
    fi
    
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "   等待中... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    echo "❌ 后端服务启动超时"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# ----------------------------------------
# 检查前端服务
# ----------------------------------------
echo ""
echo "🔍 检查前端服务..."

if ! lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  前端服务未运行，请确保前端服务已启动:"
    echo "   cd frontend && npm run dev"
    echo ""
    read -p "按Enter继续（假设前端服务已手动启动）..."
else
    echo "✅ 前端服务已运行"
fi

# ----------------------------------------
# 运行E2E测试
# ----------------------------------------
echo ""
echo "========================================"
echo "  运行E2E测试"
echo "========================================"
echo ""

cd frontend

# 测试文件参数（可自定义）
TEST_FILE="${1:-party-a-requirement-flow.spec.ts}"
BROWSER="${2:-chromium}"

echo "测试文件: $TEST_FILE"
echo "浏览器: $BROWSER"
echo ""

npx playwright test "$TEST_FILE" --project="$BROWSER"

cd ..

# ----------------------------------------
# 清理
# ----------------------------------------
echo ""
echo "🧹 清理进程..."
kill $BACKEND_PID 2>/dev/null || true

echo ""
echo "========================================"
echo "  ✅ E2E测试完成"
echo "========================================"
