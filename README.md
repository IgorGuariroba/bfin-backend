# BFIN Backend

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=bugs)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=IgorGuariroba_bfin-backend&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=IgorGuariroba_bfin-backend)
[![CI Pipeline](https://github.com/IgorGuariroba/bfin-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/IgorGuariroba/bfin-backend/actions/workflows/ci.yml)
[![CommitLint](https://github.com/IgorGuariroba/bfin-backend/actions/workflows/commitlint.yml/badge.svg)](https://github.com/IgorGuariroba/bfin-backend/actions/workflows/commitlint.yml)

Banking Finance API - A comprehensive backend solution for personal finance management.

## Features

- User authentication and authorization with JWT
- Account management
- Transaction tracking and categorization
- Budget planning and monitoring
- Scheduled expenses with automated execution
- Rate limiting and security middleware
- Comprehensive API documentation with Swagger
- Automated testing with Vitest
- Code quality monitoring with SonarCloud

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (ioredis)
- **Testing**: Vitest with coverage
- **Code Quality**: ESLint, Prettier, SonarCloud
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Node.js 20 or higher
- Docker and Docker Compose
- npm or yarn

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bfin-backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (PostgreSQL, Redis)
npm run dev:services

# Run database migrations
npm run db:migrate

# (Optional) Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bfin

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Available Scripts

### Development

- `npm run dev` - Start development server with Docker services
- `npm run dev:services` - Start only Docker services (PostgreSQL, Redis)
- `npm run dev:down` - Stop Docker services

### Building

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server

### Database

- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (caution: deletes all data)
- `npm run db:generate` - Generate Prisma Client

### Testing

- `npm test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

### Code Quality

- `npm run lint` - Run ESLint on src directory
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run lint:all` - Run ESLint on entire project
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run format:all` - Format all files (TS, JSON, MD)
- `npm run type-check` - Run TypeScript type checking
- `npm run check` - Run all checks (type-check + lint + format)

### Scheduled Jobs

- `npm run cron:execute-expenses` - Manually execute scheduled expenses

## API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3000/api-docs
```

## Testing

This project uses Vitest for testing with the following configuration:

- **Test Framework**: Vitest with globals
- **Coverage Provider**: v8
- **Coverage Reports**: Text, JSON, HTML, LCOV
- **Timeout**: 30 seconds
- **Execution**: Single-threaded for database operations

Run tests:

```bash
# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/index.html
```

## Code Quality

### ESLint & Prettier

This project uses ESLint for linting and Prettier for code formatting:

- TypeScript-specific rules
- Import ordering and organization
- Consistent code style
- Pre-commit hooks via Husky

### Conventional Commits

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <description>

Examples:
feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
chore: update dependencies
```

### SonarCloud

Continuous code quality and security analysis:

- Automated analysis on every push and PR
- Coverage tracking
- Security vulnerability detection
- Code smell identification
- Quality gate enforcement

For more details, see [SonarCloud Documentation](./docs/sonarcloud.md).

## Project Structure

```
bfin-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middlewares/     # Express middlewares
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── jobs/            # Scheduled jobs
│   ├── tests/           # Test files
│   ├── types/           # TypeScript types
│   └── server.ts        # Application entry point
├── prisma/
│   ├── migrations/      # Database migrations
│   └── schema.prisma    # Database schema
├── docs/                # Documentation
├── .github/
│   └── workflows/       # GitHub Actions workflows
└── coverage/            # Test coverage reports
```

## Contributing

1. Create a new branch from `main`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure code quality checks pass: `npm run check`
5. Commit using conventional commits
6. Push your branch and create a Pull Request
7. Wait for CI/CD checks and code review

## License

MIT

## Author

Igor Guariroba
