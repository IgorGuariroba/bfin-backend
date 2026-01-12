# BFIN API - Vanilla TypeScript Client

Vanilla TypeScript client for BFIN API using Axios.

## Installation

```bash
# Copy SDK to your project
cp -r /path/to/backend/sdk /path/to/your/project/src/api
```

## Configuration

```typescript
import { configureBfinApi } from './sdk/client';

configureBfinApi({
  baseUrl: 'https://api.bfin.com/api/v1',
  token: 'your-jwt-token',
  onTokenExpired: async () => {
    // Handle token refresh
  },
  onUnauthorized: () => {
    // Handle unauthorized access
  },
});
```

## Usage

```typescript
import {
  postApiV1AuthLogin,
  getApiV1Accounts,
  postApiV1Accounts,
} from './sdk/client';

// Login
const loginResponse = await postApiV1AuthLogin({
  email: 'user@example.com',
  password: 'password123',
});

// Get accounts
const accounts = await getApiV1Accounts();

// Create account
const newAccount = await postApiV1Accounts({
  account_name: 'My Savings',
  account_type: 'savings',
  currency: 'BRL',
});
```

## Available Functions

All API endpoints are exported as functions following the pattern:
- `{method}ApiV1{Resource}{Action}`

Examples:
- `postApiV1AuthLogin`
- `getApiV1Accounts`
- `getApiV1AccountsId`
- `patchApiV1AccountsId`
- `deleteApiV1AccountsId`

## Types

All TypeScript types are auto-generated and exported:

```typescript
import type { User, Account, Category } from './sdk/client';
```

See the main SDK README for more details.
