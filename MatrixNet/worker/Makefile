# Makefile for OPC Matrix Worker

BINARY := worker
MAIN := main.go
INSTALL_DIR := /opt/opc/MatrixNet/worker

.PHONY: all build clean install test run

all: build

build:
	go build -o $(BINARY) $(MAIN)
	@echo "✅ Build complete: $(BINARY)"

clean:
	rm -f $(BINARY)
	@echo "✅ Clean complete"

install: build
	sudo mkdir -p $(INSTALL_DIR)
	sudo cp $(BINARY) $(INSTALL_DIR)/
	sudo chmod +x $(INSTALL_DIR)/$(BINARY)
	@echo "✅ Installed to $(INSTALL_DIR)"

test:
	go test -v ./...

run: build
	./$(BINARY) -worker-id worker-001

# Quick local run
dev:
	go run . -worker-id worker-001 -health-port 8081

# Systemd management
enable:
	sudo cp deploy/opc-worker@.service /etc/systemd/system/
	sudo systemctl daemon-reload

start-worker:
	sudo systemctl start opc-worker@worker-001

stop-worker:
	sudo systemctl stop opc-worker@worker-001

logs:
	journalctl -u opc-worker@worker-001 -f
