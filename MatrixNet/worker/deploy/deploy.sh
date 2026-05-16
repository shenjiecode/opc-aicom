#!/bin/bash
#
# OPC Worker Management Script
# Usage: ./deploy.sh <command> [worker-id]
#
# Commands:
#   install     - Install systemd service
#   uninstall   - Remove systemd service
#   start       - Start worker service
#   stop        - Stop worker service
#   restart     - Restart worker service
#   status      - Show service status
#   logs        - Show logs (follow mode)
#   build       - Build worker binary
#   health      - Check worker health
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKER_DIR="$PROJECT_ROOT/MatrixNet/worker"
SERVICE_NAME="opc-worker"
INSTALL_DIR="/opt/opc/MatrixNet/worker"
SERVICE_FILE="$WORKER_DIR/deploy/${SERVICE_NAME}@.service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "OPC Worker Management Script"
    echo ""
    echo "Usage: $0 <command> [worker-id]"
    echo ""
    echo "Commands:"
    echo "  install <worker-id>    Install systemd service for worker"
    echo "  uninstall <worker-id>  Remove systemd service"
    echo "  start <worker-id>       Start worker service"
    echo "  stop <worker-id>        Stop worker service"
    echo "  restart <worker-id>     Restart worker service"
    echo "  status <worker-id>      Show service status"
    echo "  logs <worker-id>        Show logs (follow mode)"
    echo "  build                  Build worker binary"
    echo "  health <worker-id>      Check worker health endpoint"
    echo "  list                   List all worker services"
    echo ""
    echo "Examples:"
    echo "  $0 install worker-001"
    echo "  $0 start worker-001"
    echo "  $0 logs worker-001"
    echo "  $0 health worker-001"
    exit 1
}

require_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This command requires root privileges. Run with sudo."
        exit 1
    fi
}

get_health_port() {
    local worker_id="$1"
    # Calculate port: worker-001 -> 8081, worker-002 -> 8082
    local num=$(echo "$worker_id" | sed 's/worker-//')
    echo $((8080 + num))
}

cmd_build() {
    log_info "Building worker binary..."
    cd "$WORKER_DIR"
    go build -o worker main.go
    log_success "Build complete: $WORKER_DIR/worker"
}

cmd_install() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    require_root

    log_info "Installing worker service: $worker_id"

    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "/run/opc-worker"
    mkdir -p "/var/log/opc-worker"
    mkdir -p "/etc/opc"

    # Build if needed
    if [[ ! -f "$WORKER_DIR/worker" ]]; then
        cmd_build
    fi

    # Copy binary
    cp "$WORKER_DIR/worker" "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/worker"

    # Copy service file
    cp "$SERVICE_FILE" /etc/systemd/system/

    # Create env file
    cat > "/etc/opc/worker-${worker_id}.conf" << EOF
# Worker environment configuration
WORKER_ID=${worker_id}
HOMESERVER_URL=http://localhost:8008
LIGHT_AGENT_URL=http://localhost:3000/api/chat
EOF

    # Reload systemd
    systemctl daemon-reload

    # Enable service
    systemctl enable "${SERVICE_NAME}@${worker_id}"

    log_success "Service installed: ${SERVICE_NAME}@${worker_id}"
    log_info "Start with: $0 start $worker_id"
}

cmd_uninstall() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    require_root

    log_info "Uninstalling worker service: $worker_id"

    # Stop if running
    systemctl stop "${SERVICE_NAME}@${worker_id}" 2>/dev/null || true

    # Disable
    systemctl disable "${SERVICE_NAME}@${worker_id}" 2>/dev/null || true

    # Remove service file
    rm -f "/etc/systemd/system/${SERVICE_NAME}@${worker_id}.service"
    rm -f "/etc/opc/worker-${worker_id}.conf"

    # Reload
    systemctl daemon-reload

    log_success "Service uninstalled: ${SERVICE_NAME}@${worker_id}"
}

cmd_start() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    require_root

    log_info "Starting worker: $worker_id"
    systemctl start "${SERVICE_NAME}@${worker_id}"
    sleep 2
    cmd_status "$worker_id"
}

cmd_stop() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    require_root

    log_info "Stopping worker: $worker_id"
    systemctl stop "${SERVICE_NAME}@${worker_id}"
    log_success "Worker stopped: $worker_id"
}

cmd_restart() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    require_root

    log_info "Restarting worker: $worker_id"
    systemctl restart "${SERVICE_NAME}@${worker_id}"
    sleep 2
    cmd_status "$worker_id"
}

cmd_status() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    echo ""
    systemctl status "${SERVICE_NAME}@${worker_id}" --no-pager || true
    echo ""

    # Show PID file
    local pid_file="/run/opc-worker/${worker_id}.pid"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        log_info "PID file: $pid_file (PID: $pid)"
    fi
}

cmd_logs() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    journalctl -u "${SERVICE_NAME}@${worker_id}" -f
}

cmd_health() {
    local worker_id="$1"
    [[ -z "$worker_id" ]] && { log_error "Worker ID required"; usage; }

    local port=$(get_health_port "$worker_id")
    local url="http://localhost:${port}/health"

    log_info "Checking health: $url"

    if command -v curl &>/dev/null; then
        curl -s "$url" | python3 -m json.tool 2>/dev/null || curl -s "$url"
    else
        wget -qO- "$url"
    fi
    echo ""
}

cmd_list() {
    log_info "Installed worker services:"
    systemctl list-units --all "${SERVICE_NAME}@*" --no-pager 2>/dev/null || true
    echo ""

    log_info "PID files:"
    ls -la /run/opc-worker/*.pid 2>/dev/null || echo "No PID files found"
}

# Main
case "${1:-}" in
    install)    cmd_install "$2" ;;
    uninstall)  cmd_uninstall "$2" ;;
    start)      cmd_start "$2" ;;
    stop)       cmd_stop "$2" ;;
    restart)    cmd_restart "$2" ;;
    status)     cmd_status "$2" ;;
    logs)       cmd_logs "$2" ;;
    build)      cmd_build ;;
    health)     cmd_health "$2" ;;
    list)       cmd_list ;;
    *)          usage ;;
esac
