## Testing frontend code

Always run npm run build after changing code to ensure there are no compilation errors. This will help catch issues early before running tests.
Always test the code after making changes. You can run the tests for frontend with `npm test`. This will execute all tests in the `frontend` directory. Make sure to have the backend server

## Format backend code

Always run "go fmt ./..." to format the code according to Go's standard formatting rules. This will help maintain a consistent code style across the project and improve readability.

## Testing Backend Code

Always run "go build" after changing code to ensure there are no compilation errors. This will help catch issues early before running tests.
Always run "go vet" to check for common mistakes and potential issues in the code. This can help identify problems that may not be caught by the compiler.
Always run "golangci-lint run ./..." to check for code quality issues, style violations, and potential bugs. This will help maintain a clean and consistent codebase.

Always test the code after making changes. You can run the tests for backend with `make test`. This will execute all tests in the `backend` directory. Make sure to have the PostgreSQL database running and properly configured before running tests, as they may require database access.