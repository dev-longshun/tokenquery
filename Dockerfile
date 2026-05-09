# 前端构建阶段
FROM oven/bun:1 AS web-builder
WORKDIR /src/web
COPY web/package.json web/bun.lock* web/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY web ./
# 构建到 web-builder 内的 /src/cmd/server/webdist（vite outDir 是 ../cmd/server/webdist）
RUN bun run build

# 后端构建阶段
FROM golang:1.25-alpine AS go-builder
ENV CGO_ENABLED=0
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /src/cmd/server/webdist ./cmd/server/webdist
RUN go build -trimpath -ldflags "-s -w" -o /out/tokenquery ./cmd/server

# 运行时镜像
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
COPY --from=go-builder /out/tokenquery /tokenquery
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["/tokenquery"]
