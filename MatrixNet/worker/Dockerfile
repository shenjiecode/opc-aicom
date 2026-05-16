FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o worker .

FROM alpine:latest
WORKDIR /app

# Create config directory for persistent storage
RUN mkdir -p /app/config

COPY --from=builder /app/worker .

CMD ["./worker"]