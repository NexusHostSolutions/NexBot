FROM golang:1.21-alpine AS builder

WORKDIR /app

# Instala Git (necessário para baixar dependências)
RUN apk add --no-cache git

# 1. Copia TUDO primeiro (main.go e go.mod)
COPY . .

# 2. Gera o arquivo go.sum que estava faltando e baixa as bibliotecas
RUN go mod tidy

# 3. Compila o projeto
RUN CGO_ENABLED=0 GOOS=linux go build -o nexbot-api main.go

# --- Estágio Final (Imagem Leve) ---
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/nexbot-api .

EXPOSE 8080
CMD ["./nexbot-api"]
