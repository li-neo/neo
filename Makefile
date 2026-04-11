.PHONY: dev dev-local dev-server dev-web \
       start stop restart \
       start-server stop-server restart-server \
       start-web stop-web restart-web \
       build up down docker-restart logs \
       db-migrate db-upgrade db-downgrade seed \
       status clean install

# ============================================================
#  Neo Project — CLI Commands
# ============================================================
#  make start          全部启动（后端 + 前端）
#  make stop           全部停止
#  make restart        全部重启
#  make start-server   仅启动后端
#  make stop-server    仅停止后端
#  make restart-server 仅重启后端
#  make start-web      仅启动前端
#  make stop-web       仅停止前端
#  make restart-web    仅重启前端
#  make status         查看运行状态
#  make install        安装全部依赖
# ============================================================

ROOT_DIR   := $(shell pwd)
PID_DIR    := $(ROOT_DIR)/.pids
SERVER_PID  = $(PID_DIR)/server.pid
WEB_PID     = $(PID_DIR)/web.pid
SERVER_LOG  = $(PID_DIR)/server.log
WEB_LOG     = $(PID_DIR)/web.log

# ---------- Install ----------
install:
	@echo "📦 Installing server dependencies..."
	cd server && uv sync
	@echo "📦 Installing web dependencies..."
	cd apps/web && pnpm install
	@echo "✅ All dependencies installed"

# ============================================================
#  Local Dev (foreground, both in one terminal)
# ============================================================
dev-local:
	@echo "Starting local dev (SQLite)..."
	$(MAKE) dev-server & $(MAKE) dev-web

dev:
	@echo "Starting dev environment..."
	docker compose up -d mysql
	@sleep 3
	$(MAKE) dev-server & $(MAKE) dev-web

dev-server:
	cd server && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && pnpm dev

# ============================================================
#  Background Process Management
# ============================================================

# --- Start ---
start: start-server start-web
	@echo ""
	@echo "🚀 Neo 全部启动完成"
	@$(MAKE) status --no-print-directory

start-server:
	@mkdir -p $(PID_DIR)
	@if [ -f $(SERVER_PID) ] && kill -0 $$(cat $(SERVER_PID)) 2>/dev/null; then \
		echo "⚠️  后端已在运行 (PID $$(cat $(SERVER_PID)))"; \
	else \
		echo "🔧 启动后端 (port 8000)..."; \
		cd server && nohup uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
			> $(SERVER_LOG) 2>&1 & echo $$! > $(SERVER_PID); \
		sleep 1; \
		if kill -0 $$(cat $(SERVER_PID)) 2>/dev/null; then \
			echo "✅ 后端已启动 (PID $$(cat $(SERVER_PID)))"; \
		else \
			echo "❌ 后端启动失败，查看日志: cat $(SERVER_LOG)"; \
		fi; \
	fi

start-web:
	@mkdir -p $(PID_DIR)
	@if [ -f $(WEB_PID) ] && kill -0 $$(cat $(WEB_PID)) 2>/dev/null; then \
		echo "⚠️  前端已在运行 (PID $$(cat $(WEB_PID)))"; \
	else \
		echo "🌐 启动前端 (port 3000)..."; \
		cd apps/web && nohup pnpm dev \
			> $(WEB_LOG) 2>&1 & echo $$! > $(WEB_PID); \
		sleep 2; \
		if kill -0 $$(cat $(WEB_PID)) 2>/dev/null; then \
			echo "✅ 前端已启动 (PID $$(cat $(WEB_PID)))"; \
		else \
			echo "❌ 前端启动失败，查看日志: cat $(WEB_LOG)"; \
		fi; \
	fi

# --- Stop ---
stop: stop-server stop-web
	@echo ""
	@echo "🛑 Neo 全部已停止"

stop-server:
	@if [ -f $(SERVER_PID) ]; then \
		PID=$$(cat $(SERVER_PID)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "🔧 停止后端 (PID $$PID)..."; \
			kill $$PID 2>/dev/null; \
			sleep 1; \
			kill -0 $$PID 2>/dev/null && kill -9 $$PID 2>/dev/null; \
			echo "✅ 后端已停止"; \
		else \
			echo "⚠️  后端未在运行"; \
		fi; \
		rm -f $(SERVER_PID); \
	else \
		echo "⚠️  后端未在运行（无 PID 文件）"; \
		pkill -f "uvicorn app.main:app" 2>/dev/null && echo "🧹 清理了残留进程" || true; \
	fi

stop-web:
	@if [ -f $(WEB_PID) ]; then \
		PID=$$(cat $(WEB_PID)); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "🌐 停止前端 (PID $$PID)..."; \
			kill $$PID 2>/dev/null; \
			sleep 1; \
			kill -0 $$PID 2>/dev/null && kill -9 $$PID 2>/dev/null; \
			echo "✅ 前端已停止"; \
		else \
			echo "⚠️  前端未在运行"; \
		fi; \
		rm -f $(WEB_PID); \
	else \
		echo "⚠️  前端未在运行（无 PID 文件）"; \
		pkill -f "next dev" 2>/dev/null && echo "🧹 清理了残留进程" || true; \
	fi

# --- Restart ---
restart: restart-server restart-web
	@echo ""
	@echo "🔄 Neo 全部重启完成"
	@$(MAKE) status --no-print-directory

restart-server:
	@echo "🔄 重启后端..."
	@$(MAKE) stop-server --no-print-directory
	@sleep 1
	@$(MAKE) start-server --no-print-directory

restart-web:
	@echo "🔄 重启前端..."
	@$(MAKE) stop-web --no-print-directory
	@sleep 1
	@$(MAKE) start-web --no-print-directory

# --- Status ---
status:
	@echo ""
	@echo "═══════════════════════════════════"
	@echo "  Neo 服务状态"
	@echo "═══════════════════════════════════"
	@if [ -f $(SERVER_PID) ] && kill -0 $$(cat $(SERVER_PID)) 2>/dev/null; then \
		echo "  🟢 后端  Running  (PID $$(cat $(SERVER_PID)))  http://localhost:8000"; \
	else \
		echo "  🔴 后端  Stopped"; \
	fi
	@if [ -f $(WEB_PID) ] && kill -0 $$(cat $(WEB_PID)) 2>/dev/null; then \
		echo "  🟢 前端  Running  (PID $$(cat $(WEB_PID)))  http://localhost:3000"; \
	else \
		echo "  🔴 前端  Stopped"; \
	fi
	@echo "═══════════════════════════════════"

# --- Logs ---
log-server:
	@if [ -f $(SERVER_LOG) ]; then tail -f $(SERVER_LOG); \
	else echo "无后端日志"; fi

log-web:
	@if [ -f $(WEB_LOG) ]; then tail -f $(WEB_LOG); \
	else echo "无前端日志"; fi

logs-all:
	@echo "=== 后端日志 (最后 20 行) ===" && tail -20 $(SERVER_LOG) 2>/dev/null || echo "(无)"
	@echo ""
	@echo "=== 前端日志 (最后 20 行) ===" && tail -20 $(WEB_LOG) 2>/dev/null || echo "(无)"

# ============================================================
#  Docker (Production)
# ============================================================
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

docker-restart:
	docker compose restart

logs:
	docker compose logs -f

# ============================================================
#  Database
# ============================================================
db-migrate:
	cd server && uv run alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	cd server && uv run alembic upgrade head

db-downgrade:
	cd server && uv run alembic downgrade -1

seed:
	cd server && uv run python -m scripts.seed

# ============================================================
#  Utility
# ============================================================
clean:
	@echo "🧹 清理构建产物..."
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
	rm -rf $(PID_DIR)
	@echo "✅ 清理完成"

help:
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════╗"
	@echo "║              Neo Project — 可用命令                      ║"
	@echo "╠═══════════════════════════════════════════════════════════╣"
	@echo "║                                                           ║"
	@echo "║  🚀 启动/停止/重启                                       ║"
	@echo "║    make start            全部启动（后端+前端）            ║"
	@echo "║    make stop             全部停止                         ║"
	@echo "║    make restart          全部重启                         ║"
	@echo "║    make start-server     仅启动后端                       ║"
	@echo "║    make stop-server      仅停止后端                       ║"
	@echo "║    make restart-server   仅重启后端                       ║"
	@echo "║    make start-web        仅启动前端                       ║"
	@echo "║    make stop-web         仅停止前端                       ║"
	@echo "║    make restart-web      仅重启前端                       ║"
	@echo "║                                                           ║"
	@echo "║  📊 状态/日志                                             ║"
	@echo "║    make status           查看服务运行状态                 ║"
	@echo "║    make log-server       查看后端实时日志                 ║"
	@echo "║    make log-web          查看前端实时日志                 ║"
	@echo "║    make logs-all         查看全部日志摘要                 ║"
	@echo "║                                                           ║"
	@echo "║  🔧 开发                                                  ║"
	@echo "║    make dev-local        前台启动（SQLite 本地开发）      ║"
	@echo "║    make install          安装全部依赖                     ║"
	@echo "║    make clean            清理构建产物                     ║"
	@echo "║                                                           ║"
	@echo "║  🗄️  数据库                                               ║"
	@echo "║    make db-migrate msg=  生成迁移脚本                     ║"
	@echo "║    make db-upgrade       执行迁移                         ║"
	@echo "║    make db-downgrade     回退一步                         ║"
	@echo "║    make seed             导入种子数据                     ║"
	@echo "║                                                           ║"
	@echo "║  🐳 Docker                                                ║"
	@echo "║    make build            构建 Docker 镜像                 ║"
	@echo "║    make up               启动 Docker 容器                 ║"
	@echo "║    make down             停止 Docker 容器                 ║"
	@echo "║    make docker-restart   重启 Docker 容器                 ║"
	@echo "║    make logs             查看 Docker 日志                 ║"
	@echo "║                                                           ║"
	@echo "╚═══════════════════════════════════════════════════════════╝"
