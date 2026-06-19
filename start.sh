#!/bin/bash

echo "========================================"
echo "  智能招聘与候选人追踪系统 - 启动脚本"
echo "========================================"
echo ""

echo "[1/5] 启动基础设施 (PostgreSQL + MinIO)..."
docker-compose up -d

echo ""
echo "[2/5] 等待基础设施就绪..."
sleep 10

echo ""
echo "[3/5] 启动后端主服务 (端口 8080)..."
cd backend
./mvnw spring-boot:run &
BACKEND_PID=$!
cd ..

echo ""
echo "[4/5] 启动简历解析微服务 (端口 3092)..."
cd parser-service
npm run start:dev &
PARSER_PID=$!
cd ..

echo ""
echo "[5/5] 启动前端应用 (端口 59090)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  所有服务启动中..."
echo "========================================"
echo "  前端:     http://localhost:59090"
echo "  后端API:  http://localhost:8080"
echo "  解析服务: http://localhost:3092"
echo "  MinIO:    http://localhost:9001"
echo "========================================"
echo ""
echo "进程ID: "
echo "  后端: $BACKEND_PID"
echo "  解析: $PARSER_PID"
echo "  前端: $FRONTEND_PID"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $PARSER_PID $FRONTEND_PID; docker-compose down; exit" INT

wait
