FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./static/
RUN CGO_ENABLED=0 go build -o langy .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=backend /app/langy /usr/local/bin/langy
COPY backend/migrations/ /migrations/
ENTRYPOINT ["langy"]
CMD ["serve"]
