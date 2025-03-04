# Website Auditor Backend

Backend API for the Website Auditor application, providing endpoints for auditing websites and retrieving audit history.

## Features

- Audit websites for compliance with best practices
- Store audit results in PostgreSQL database
- Retrieve audit history and statistics
- Search and filter audit results
- Export audit data to CSV

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up PostgreSQL database
4. Configure database connection in `.env` file (see `.env.example`)

## Running the Application

Start the development server:

```bash
npm run dev
```

Start the production server:

```bash
npm start
```

## Testing

The application includes comprehensive unit tests for all major components.

### Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode (automatically re-run when files change):

```bash
npm run test:watch
```

Generate test coverage report:

```bash
npm run test:coverage
```

### Test Structure

The tests are organized by component:

- `historyRoutes.test.js` - Tests for history API endpoints
- `auditController.test.js` - Tests for the audit controller
- `database.test.js` - Tests for database connection and queries
- `sqlGenerator.test.js` - Tests for SQL query generation

### Testing Approach

The tests use Jest as the testing framework and follow these principles:

1. **Isolation**: Each component is tested in isolation using mocks for dependencies
2. **Coverage**: Tests aim to cover both successful operations and error handling
3. **Readability**: Tests follow the Arrange-Act-Assert pattern for clarity
4. **Maintainability**: Tests are structured to be easy to update as the application evolves

## API Documentation

See the [API documentation](./docs/api.md) for details on available endpoints.

## License

MIT 