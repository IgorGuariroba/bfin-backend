# BFIN API - React Query Hooks

React Query hooks for BFIN API with automatic caching and state management.

## Installation

```bash
# Install React Query
npm install @tanstack/react-query

# Copy SDK to your project
cp -r /path/to/backend/sdk /path/to/your/project/src/api
```

## Setup

```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureBfinApi } from './sdk/react-query';

const queryClient = new QueryClient();

configureBfinApi({
  baseUrl: process.env.REACT_APP_API_URL,
  token: localStorage.getItem('auth_token'),
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Usage

### Queries (GET requests)

```typescript
import { useGetApiV1Accounts, useGetApiV1AccountsId } from './sdk/react-query';

function AccountsList() {
  const { data: accounts, isLoading, error, refetch } = useGetApiV1Accounts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
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

```typescript
import {
  usePostApiV1AuthLogin,
  usePostApiV1Accounts,
  usePatchApiV1AccountsId,
  useDeleteApiV1AccountsId,
} from './sdk/react-query';

function LoginForm() {
  const { mutate: login, isPending, error } = usePostApiV1AuthLogin({
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.tokens.access_token);
      // Redirect or update state
    },
  });

  const handleSubmit = (formData) => {
    login({ data: { email: formData.email, password: formData.password } });
  };

  return <form onSubmit={handleSubmit}>{/* form */}</form>;
}

function CreateAccount() {
  const { mutate: createAccount } = usePostApiV1Accounts({
    onSuccess: () => {
      // Invalidate accounts query to refetch
      queryClient.invalidateQueries({ queryKey: ['getApiV1Accounts'] });
    },
  });

  const handleCreate = () => {
    createAccount({
      data: {
        account_name: 'New Account',
        account_type: 'checking',
        currency: 'BRL',
      },
    });
  };

  return <button onClick={handleCreate}>Create Account</button>;
}
```

## Hook Naming Convention

- **Queries**: `use{Method}ApiV1{Resource}{Action}`
- **Mutations**: Same pattern for POST, PATCH, DELETE

Examples:
- `useGetApiV1Accounts` - List accounts
- `useGetApiV1AccountsId` - Get account by ID
- `usePostApiV1Accounts` - Create account
- `usePatchApiV1AccountsId` - Update account
- `useDeleteApiV1AccountsId` - Delete account

## Benefits

- Automatic caching and background updates
- Loading and error states handled automatically
- Optimistic updates support
- Request deduplication
- Automatic retries

See the main SDK README for more details.
