# BFIN API SDK

TypeScript SDK for BFIN Banking Finance API with React Query and SWR support.

## Features

- **Type-Safe**: Full TypeScript support with auto-generated types from OpenAPI spec
- **Multiple Frameworks**: Support for vanilla TypeScript, React Query, and SWR
- **Authentication**: Built-in JWT token management with interceptors
- **Error Handling**: Automatic error handling and token refresh
- **Auto-Generated**: SDK is automatically generated from OpenAPI specification

## Installation

### From GitHub Packages

First, configure npm to use GitHub Packages for `@igorguariroba` scope:

```bash
# Create or edit ~/.npmrc
echo "@igorguariroba:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

Then install the SDK:

```bash
npm install @igorguariroba/bfin-sdk
```

**Note:** You need a GitHub Personal Access Token with `read:packages` permission. Add to your `.npmrc`:

```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

### From Source (Development)

If you're developing locally, you can copy the SDK directory to your frontend project:

```bash
# Copy the SDK directory to your frontend project
cp -r /path/to/backend/sdk /path/to/frontend/src/api
```

## Quick Start

```typescript
// Import from the package
import { configureBfinApi } from '@igorguariroba/bfin-sdk';
import { usePostApiV1AuthLogin, useGetApiV1Accounts } from '@igorguariroba/bfin-sdk/react-query';

// Configure once in your app root
configureBfinApi({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
  token: localStorage.getItem('auth_token'),
});

// Use in components
function LoginForm() {
  const { mutate: login } = usePostApiV1AuthLogin();
  return <form onSubmit={(data) => login({ data })} />;
}

function AccountsList() {
  const { data: accounts } = useGetApiV1Accounts();
  return <div>{accounts?.map(account => ...)}</div>;
}
```

## Configuration

Configure the SDK once in your application root:

```typescript
import { configureBfinApi } from '@igorguariroba/bfin-sdk';

configureBfinApi({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
  token: localStorage.getItem('auth_token'),
  onTokenExpired: async () => {
    // Implement token refresh logic
    const newToken = await refreshToken();
    configureBfinApi({ token: newToken });
  },
  onUnauthorized: () => {
    // Redirect to login
    window.location.href = '/login';
  },
});
```

## Package Exports

The SDK provides multiple entry points for different use cases:

```typescript
// Default export (client)
import { configureBfinApi, postApiV1AuthLogin } from '@igorguariroba/bfin-sdk';

// Explicit client import
import { getApiV1Accounts } from '@igorguariroba/bfin-sdk/client';

// React Query hooks
import { useGetApiV1Accounts, usePostApiV1AuthLogin } from '@igorguariroba/bfin-sdk/react-query';

// SWR hooks
import { useGetApiV1Accounts } from '@igorguariroba/bfin-sdk/swr';
```

## Usage

### Vanilla TypeScript Client

```typescript
import { postApiV1AuthLogin, getApiV1Accounts } from '@igorguariroba/bfin-sdk';

// Login
const loginResponse = await postApiV1AuthLogin({
  email: 'user@example.com',
  password: 'password123',
});

// Get accounts
const accounts = await getApiV1Accounts();
```

### React Query Hooks

```typescript
import { usePostApiV1AuthLogin, useGetApiV1Accounts } from './sdk/react-query';

function LoginForm() {
  const { mutate: login, isPending } = usePostApiV1AuthLogin();

  const handleSubmit = (data) => {
    login(
      { data: { email: data.email, password: data.password } },
      {
        onSuccess: (response) => {
          console.log('Login successful:', response);
        },
      }
    );
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}

function AccountsList() {
  const { data: accounts, isLoading, error } = useGetApiV1Accounts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {accounts?.map((account) => (
        <li key={account.id}>{account.account_name}</li>
      ))}
    </ul>
  );
}
```

### SWR Hooks

```typescript
import { useGetApiV1Accounts } from './sdk/swr';

function AccountsList() {
  const { data: accounts, error, isLoading } = useGetApiV1Accounts();

  if (error) return <div>Error loading accounts</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {accounts?.map((account) => (
        <li key={account.id}>{account.account_name}</li>
      ))}
    </ul>
  );
}
```

## API Endpoints

The SDK provides access to all BFIN API endpoints organized by resource:

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user info

### Accounts
- `GET /api/v1/accounts` - List all accounts
- `POST /api/v1/accounts` - Create new account
- `GET /api/v1/accounts/{id}` - Get account by ID
- `PATCH /api/v1/accounts/{id}` - Update account
- `DELETE /api/v1/accounts/{id}` - Delete account

### Categories
- `GET /api/v1/categories` - List categories
- `POST /api/v1/categories` - Create custom category

## Type Safety

All SDK functions are fully typed:

```typescript
import type {
  User,
  Account,
  Category,
  PostApiV1AuthLoginBody,
  PostApiV1AuthLogin200,
} from './sdk/client';

// Types are automatically inferred
const response: PostApiV1AuthLogin200 = await postApiV1AuthLogin({
  email: 'user@example.com',
  password: 'password',
});

const user: User = response.user;
```

## Error Handling

```typescript
import { AxiosError } from 'axios';

try {
  await postApiV1AuthLogin(credentials);
} catch (error) {
  if (error instanceof AxiosError) {
    switch (error.response?.status) {
      case 400:
        console.error('Validation error:', error.response.data);
        break;
      case 401:
        console.error('Unauthorized');
        break;
      case 404:
        console.error('Resource not found');
        break;
      default:
        console.error('Unexpected error:', error.message);
    }
  }
}
```

## SDK Variants

- **`/client`** - Vanilla TypeScript client using Axios
- **`/react-query`** - React Query hooks for React applications
- **`/swr`** - SWR hooks for React applications

## Development

The SDK is automatically regenerated when the backend is built:

```bash
# In the backend project
npm run build

# Or generate SDK separately
npm run generate:openapi
npm run generate:sdk
```

## License

MIT
