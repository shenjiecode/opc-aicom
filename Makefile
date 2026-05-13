BINARY_NAME=opc-aicom
BACKEND_DIR=backend
FRONTEND_DIR=frontend

.PHONY: dev build test clean backend frontend

dev:
	docker-compose up -d

build:
	cd $(BACKEND_DIR) && go build -o $(BINARY_NAME) ./cmd/server/main.go
	cd $(FRONTEND_DIR) && npm run build

test:
	cd $(BACKEND_DIR) && go test ./...

backend:
	cd $(BACKEND_DIR) && go run cmd/server/main.go

frontend:
	cd $(FRONTEND_DIR) && npm run dev

clean:
	rm -f $(BACKEND_DIR)/$(BINARY_NAME)
	rm -rf $(FRONTEND_DIR)/dist
