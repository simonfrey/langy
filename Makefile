
.PHONY: dev dev-backend dev-frontend migrate migrate-down test build docker-build sqlc codegen codegen-backend codegen-frontend

dev:
	docker compose up -d
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	cd backend && DATABASE_URL="postgres://langy:langy@localhost:5432/langy?sslmode=disable" JWT_SECRET=dev-secret go run . serve

dev-frontend:
	cd frontend && npm run dev

migrate:
	docker run --rm -v $(PWD)/backend/migrations:/migrations --network=host migrate/migrate -path=/migrations -database "postgres://langy:langy@localhost:5432/langy?sslmode=disable" up

migrate-down:
	docker run --rm -v $(PWD)/backend/migrations:/migrations --network=host migrate/migrate -path=/migrations -database "postgres://langy:langy@localhost:5432/langy?sslmode=disable" down 1

test:
	docker compose up -d
	cd backend && DATABASE_URL="postgres://langy:langy@localhost:5432/langy?sslmode=disable" go test ./...

build:
	docker build -t langy .

sqlc:
	cd backend && sqlc generate

codegen: codegen-backend codegen-frontend

codegen-backend:
	cd backend && go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -package api -generate chi-server,models,strict-server ../api/openapi.yaml > internal/api/server.gen.go

codegen-frontend:
	cd frontend && npx @openapitools/openapi-generator-cli generate -i ../api/openapi.yaml -g typescript-fetch -o src/api --additional-properties=supportsES6=true,typescriptThreePlus=true,modelPropertyNaming=original,paramNaming=original

docker-build: build
