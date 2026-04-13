## Codegeneration

This project heavily relies on code generation to maintain type safety and reduce boilerplate. Whenever you make changes to the database schema, API routes, or data models, you should run the appropriate code generation commands to keep everything in sync.
DO NOT manually edit generated files, as they will be overwritten the next time code generation runs.

### API contract: `api/openapi.yaml`

The OpenAPI 3.0 spec at `api/openapi.yaml` is the **single source of truth** for the API contract. Both the Go server stubs and the TypeScript client are generated from it.

### Code generation commands

- **`make codegen`** — run both backend and frontend code generation
- **`make codegen-backend`** — generate Go server stubs (strict-server + chi models) into `backend/internal/api/server.gen.go` using `oapi-codegen`
- **`make codegen-frontend`** — generate TypeScript fetch client into `frontend/src/api/` using `openapi-generator`
- **`make sqlc`** (or `cd backend && sqlc generate`) — regenerate SQLC query code from `backend/sql/queries/*.sql` against the migration schema

### Workflow

1. Edit `api/openapi.yaml` when changing API endpoints or request/response schemas
2. Run `make codegen` to regenerate both Go and TypeScript code
3. Update the strict server implementation in `backend/internal/api/impl.go` to match new/changed endpoints
4. Update frontend pages to use the regenerated client
5. Run `make sqlc` after changing SQL queries or migration schema

### Generated files (DO NOT EDIT)

- `backend/internal/api/server.gen.go` — Go models, chi router, strict server interface
- `backend/internal/db/db.go`, `backend/internal/db/*.sql.go`, `backend/internal/db/models.go` — SQLC-generated database code
- `frontend/src/api/` — entire directory is generated TypeScript client

### Hand-written files

- `backend/internal/api/impl.go` — implements `StrictServerInterface` with business logic
- `backend/internal/db/store.go` — domain types, UUID/time helpers, row converters, wrapper methods

## Codestyle

When writing golang/backend code, stick to the modern go practices in @MODERN_GO.md

We want small files with a clear single responsibility. If a file grows too large, consider splitting it into smaller modules. For example, if you have a file that contains multiple related functions or types, you can split it into separate files based on functionality.

The smaller a change is you do, the better. I like simple. Be simple. If you find yourself writing complex code, take a step back and see if there’s a simpler way to achieve the same result. Simple code is easier to read, understand, and maintain.

## FRONTEND (/frontend) typescript/react/vite

### Format frontend code

Always run `npm run format:check` to verify code formatting with Prettier. To auto-fix formatting, run `npm run format`.

### Testing frontend code

Always run npm run build after changing code to ensure there are no compilation errors. This will help catch issues early before running tests.
Always run `npm run lint` to check for linting issues with ESLint.
Always run `npm run deadcode` to check for unused exports, files, and dependencies with Knip.
Always test the code after making changes. You can run the tests for frontend with `npm test`. This will execute all tests in the `frontend` directory. Make sure to have the backend server

## BACKEND (/backend) golang

### Format backend code

Always run "go fmt ./..." to format the code according to Go's standard formatting rules. This will help maintain a consistent code style across the project and improve readability.

### Testing Backend Code

Always run "go build" after changing code to ensure there are no compilation errors. This will help catch issues early before running tests.
Always run "go vet" to check for common mistakes and potential issues in the code. This can help identify problems that may not be caught by the compiler.
Always run "golangci-lint run ./..." to check for code quality issues, style violations, and potential bugs. This will help maintain a clean and consistent codebase.

Always test the code after making changes. You can run the tests for backend with `make test`. This will execute all tests in the `backend` directory. Make sure to have the PostgreSQL database running and properly configured before running tests, as they may require database access.

### Golang specials

If you need any documentation about a library you can just use the `go doc` command. For example, `go doc time.Since` will show you the documentation for the `time.Since` function. Also works for external libraries, e.g. `go doc github.com/google/uuid.New` will show you the documentation for the `New` function in the `github.com/google/uuid` package.
