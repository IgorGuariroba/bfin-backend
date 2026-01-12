# BFIN API - SWR Hooks

SWR hooks for BFIN API with stale-while-revalidate caching strategy.

## Installation

```bash
# Install SWR
npm install swr

# Copy SDK to your project
cp -r /path/to/backend/sdk /path/to/your/project/src/api
```

## Setup

```typescript
// App.tsx
import { SWRConfig } from 'swr';
import { configureBfinApi } from './sdk/swr';

configureBfinApi({
  baseUrl: process.env.REACT_APP_API_URL,
  token: localStorage.getItem('auth_token'),
});

function App() {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }}
    >
      <YourApp />
    </SWRConfig>
  );
}
```

## Usage

### Queries (GET requests)

```typescript
import { useGetApiV1Accounts, useGetApiV1AccountsId } from './sdk/swr';

function AccountsList() {
  const { data: accounts, error, isLoading, mutate } = useGetApiV1Accounts();

  if (error) return <div>Error loading accounts</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => mutate()}>Refresh</button>
      {accounts?.map((account) => (
        <div key={account.id}>{account.account_name}</div>
      ))}
    </div>
  );
}

function AccountDetail({ accountId }: { accountId: string }) {
  const { data: account } = useGetApiV1AccountsId(accountId);

  return <div>{account?.account_name}</div>;
}
```

### Mutations (POST, PATCH, DELETE)

SWR hooks are optimized for queries. For mutations, you can use the vanilla client:

```typescript
import { postApiV1Accounts } from '../client';
import { useGetApiV1Accounts } from './sdk/swr';

function CreateAccount() {
  const { mutate: refreshAccounts } = useGetApiV1Accounts();

  const handleCreate = async () => {
    try {
      await postApiV1Accounts({
        account_name: 'New Account',
        account_type: 'checking',
        currency: 'BRL',
      });

      // Refresh the accounts list
      refreshAccounts();
    } catch (error) {
      console.error('Failed to create account:', error);
    }
  };

  return <button onClick={handleCreate}>Create Account</button>;
}
```

## Hook Naming Convention

- `use{Method}ApiV1{Resource}{Action}`

Examples:
- `useGetApiV1Accounts` - List accounts
- `useGetApiV1AccountsId` - Get account by ID
- `useGetApiV1Categories` - List categories

## Benefits

- Lightweight and fast
- Automatic revalidation
- Focus revalidation
- Request deduplication
- Optimistic UI updates
- Built-in cache

## SWR Features

```typescript
const { data, error, isLoading, isValidating, mutate } = useGetApiV1Accounts();

// Manual revalidation
mutate();

// Optimistic update
mutate(newData, false);

// Revalidate after update
mutate(newData, true);
```

See the main SDK README for more details.
