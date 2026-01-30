# Quickstart: Loan Simulation Approval & Withdrawal

**Feature**: 001-aprovar-emprestimo-reserva
**Date**: 2026-01-28

This guide provides a quick reference for developers implementing or using the loan simulation approval and withdrawal features.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Migration](#database-migration)
3. [API Usage Examples](#api-usage-examples)
4. [Testing](#testing)
5. [Common Errors](#common-errors)
6. [Architecture Overview](#architecture-overview)

---

## Prerequisites

**Required**:
- Existing loan simulation feature (already implemented)
- PostgreSQL database with Prisma ORM
- JWT authentication middleware
- Node.js + TypeScript environment

**Verify Prerequisites**:
```bash
# Check Prisma is installed
npx prisma --version

# Check existing loan simulation service
cat src/services/loanSimulationService.ts

# Check authentication middleware
cat src/middlewares/auth.ts
```

---

## Database Migration

### 1. Update Prisma Schema

Add to `/prisma/schema.prisma`:

```prisma
enum LoanSimulationStatus {
  PENDING
  APPROVED
  COMPLETED
}

model LoanSimulation {
  // ... existing fields ...

  status       LoanSimulationStatus @default(PENDING)
  approved_at  DateTime?
  withdrawn_at DateTime?

  @@index([status])
  @@index([user_id, status])
}
```

### 2. Generate and Apply Migration

```bash
# Create migration
npx prisma migrate dev --name add-loan-simulation-status

# Verify migration succeeded
npx prisma migrate status

# Regenerate Prisma client
npx prisma generate
```

### 3. Verify Migration

```bash
# Check database
psql -d your_database -c "\d LoanSimulation"

# Should show:
# - status column (enum, default PENDING)
# - approved_at column (timestamp, nullable)
# - withdrawn_at column (timestamp, nullable)
```

---

## API Usage Examples

### Prerequisites for API Calls

1. **Create a user** (if not exists)
2. **Create an account** with emergency reserve balance
3. **Create a loan simulation** (existing endpoint)
4. **Get JWT token** for authentication

### Full Example Flow

```bash
# 1. Get JWT token (replace with your auth endpoint)
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' \
  | jq -r '.token')

# 2. Create loan simulation (existing endpoint)
SIMULATION_ID=$(curl -X POST http://localhost:3000/api/v1/loan-simulations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "termMonths": 12}' \
  | jq -r '.id')

echo "Created simulation: $SIMULATION_ID"

# 3. Approve the simulation
curl -X POST "http://localhost:3000/api/v1/loan-simulations/$SIMULATION_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.'

# Response:
# {
#   "simulation": {
#     "id": "...",
#     "status": "APPROVED",
#     "approvedAt": "2026-01-28T10:30:00.000Z",
#     "amount": 500.00,
#     ...
#   },
#   "message": "Loan simulation approved successfully"
# }

# 4. Withdraw funds
curl -X POST "http://localhost:3000/api/v1/loan-simulations/$SIMULATION_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.'

# Response:
# {
#   "simulation": {
#     "id": "...",
#     "status": "COMPLETED",
#     "withdrawnAt": "2026-01-28T10:35:00.000Z",
#     ...
#   },
#   "balances": {
#     "emergencyReserveBefore": 1000.00,
#     "emergencyReserveAfter": 500.00,
#     "availableBalanceBefore": 200.00,
#     "availableBalanceAfter": 700.00
#   },
#   "message": "Funds withdrawn successfully. Amount transferred to available balance."
# }

# 5. Verify simulation status
curl "http://localhost:3000/api/v1/loan-simulations/$SIMULATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.status, .approvedAt, .withdrawnAt'

# 6. List approved simulations
curl "http://localhost:3000/api/v1/loan-simulations?status=APPROVED" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[].id, .[].status'
```

### JavaScript/TypeScript Example

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';
const token = 'your-jwt-token';

async function approveLoanSimulation(simulationId: string) {
  const response = await axios.post(
    `${API_BASE}/loan-simulations/${simulationId}/approve`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  console.log('Approved:', response.data);
  return response.data;
}

async function withdrawFunds(simulationId: string) {
  const response = await axios.post(
    `${API_BASE}/loan-simulations/${simulationId}/withdraw`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  console.log('Withdrawn:', response.data);
  console.log('New available balance:', response.data.balances.availableBalanceAfter);
  return response.data;
}

// Usage
const simulationId = '123e4567-e89b-12d3-a456-426614174000';
await approveLoanSimulation(simulationId);
await withdrawFunds(simulationId);
```

---

## Testing

### Run Existing Tests (Regression Check)

```bash
# Run all loan simulation tests
npm test -- loanSimulations

# Should pass without modifications to existing behavior
```

### Run New Tests (After Implementation)

```bash
# Integration tests for approval
npm test -- tests/integration/loanSimulations.approve.test.ts

# Integration tests for withdrawal
npm test -- tests/integration/loanSimulations.withdraw.test.ts

# Unit tests
npm test -- tests/unit/loanSimulations.controller.test.ts
npm test -- tests/unit/loanSimulationService.test.ts

# All tests
npm test

# With coverage
npm run test:coverage
```

### Manual Testing Checklist

**Approval Endpoint**:
- [ ] Approve a PENDING simulation → succeeds
- [ ] Approve already APPROVED simulation → 400 error
- [ ] Approve simulation >30 days old → 400 error
- [ ] Approve when 70% limit would be exceeded → 400 error
- [ ] Approve without authentication → 401 error
- [ ] Approve non-existent simulation → 404 error
- [ ] Approve another user's simulation → 404 error

**Withdrawal Endpoint**:
- [ ] Withdraw from APPROVED simulation → succeeds
- [ ] Withdraw from PENDING simulation → 400 error
- [ ] Withdraw from COMPLETED simulation → 400 error
- [ ] Withdraw when reserve reduced after approval → 400 error
- [ ] Verify balance changes in database
- [ ] Verify audit events created
- [ ] Verify transaction atomicity (all-or-nothing)

**List/Get Endpoints**:
- [ ] GET /loan-simulations includes status field
- [ ] GET /loan-simulations?status=APPROVED filters correctly
- [ ] GET /loan-simulations/:id returns timestamps

---

## Common Errors

### 400: Already Approved

```json
{
  "error": "Simulation is already approved"
}
```

**Cause**: Trying to approve a simulation that's already in APPROVED or COMPLETED status

**Solution**: Check simulation status before approving. Use GET endpoint to verify current state.

---

### 400: Simulation Expired

```json
{
  "error": "Simulation expired. Created 35 days ago. Maximum age is 30 days. Please create a new simulation."
}
```

**Cause**: Simulation was created more than 30 days ago

**Solution**: Create a new simulation with the same parameters using POST /loan-simulations

---

### 400: Reserve Limit Exceeded

```json
{
  "error": "Total active loans would exceed 70% reserve limit. Current reserve: 1000.00, maximum allowed: 700.00, requested: 500.00"
}
```

**Cause**:
- Sum of all APPROVED + COMPLETED simulations would exceed 70% of emergency reserve
- Or reserve balance was reduced after approval (checked at withdrawal)

**Solution**:
- Wait until existing loans are paid off
- Reduce loan amount
- Increase emergency reserve balance

---

### 400: Cannot Withdraw - Not Approved

```json
{
  "error": "Cannot withdraw - simulation must be approved first"
}
```

**Cause**: Trying to withdraw from a PENDING simulation

**Solution**: Approve the simulation first using POST /:id/approve

---

### 400: Insufficient Reserve Balance

```json
{
  "error": "Insufficient emergency reserve balance. Required: 500.00, available: 300.00"
}
```

**Cause**: Emergency reserve balance is less than loan amount at withdrawal time

**Solution**:
- Add funds to emergency reserve
- Create a new simulation with a smaller amount

---

### 404: Simulation Not Found

```json
{
  "error": "Loan simulation not found"
}
```

**Cause**:
- Invalid simulation ID
- Simulation belongs to another user
- Simulation was deleted

**Solution**:
- Verify simulation ID
- Ensure using correct authentication token
- Use GET /loan-simulations to list available simulations

---

## Architecture Overview

### State Machine

```
PENDING ─────approve()────▶ APPROVED ─────withdraw()────▶ COMPLETED
   ↑                           │                              │
   │                           │                              │
   └─────────────── create() ──┘                              │
                                                               │
                                              (terminal state) ─┘
```

### Service Layer Methods

```typescript
// LoanSimulationService
class LoanSimulationService {
  // NEW methods
  async approveSimulation(userId: string, simulationId: string): Promise<LoanSimulationDetails>
  async withdrawFunds(userId: string, simulationId: string): Promise<WithdrawalResponse>

  // Existing methods (no changes)
  async createSimulation(userId: string, input: LoanSimulationCreateInput): Promise<LoanSimulationDetails>
  async listSimulations(userId: string, limit?: number, offset?: number): Promise<LoanSimulationSummary[]>
  async getSimulation(userId: string, simulationId: string): Promise<LoanSimulationDetails>
}
```

### Controller Endpoints

```typescript
// LoanSimulationsController
class LoanSimulationsController {
  // NEW endpoints
  async approve(req: AuthRequest, res: Response): Promise<void>
  async withdraw(req: AuthRequest, res: Response): Promise<void>

  // Existing endpoints (response extended with status fields)
  async create(req: AuthRequest, res: Response): Promise<void>
  async list(req: AuthRequest, res: Response): Promise<void>
  async get(req: AuthRequest, res: Response): Promise<void>
}
```

### Routes

```typescript
// src/routes/loanSimulations.routes.ts
router.post('/', authenticate, controller.create);                    // Existing
router.get('/', authenticate, controller.list);                       // Existing (+ status filter)
router.get('/:id', authenticate, controller.get);                     // Existing (+ status fields)
router.post('/:id/approve', authenticate, controller.approve);        // NEW
router.post('/:id/withdraw', authenticate, controller.withdraw);      // NEW
```

### Database Transaction Flow (Withdrawal)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Validate state and permissions
  const simulation = await tx.loanSimulation.findFirst(...);
  if (simulation.status !== 'APPROVED') throw error;

  // 2. Get account and validate reserve
  const account = await tx.account.findUnique(...);
  if (account.emergency_reserve < simulation.principal_amount) throw error;

  // 3. Validate 70% limit (with active loans)
  const activeLoans = await tx.loanSimulation.aggregate(...);
  if (activeLoans > 0.70 * account.emergency_reserve) throw error;

  // 4. Update balances (atomic)
  await tx.account.update({
    data: {
      emergency_reserve: { decrement: amount },
      available_balance: { increment: amount }
    }
  });

  // 5. Update simulation status
  await tx.loanSimulation.update({
    data: {
      status: 'COMPLETED',
      withdrawn_at: new Date()
    }
  });

  // 6. Create audit event
  await auditEventService.writeEvent({ ... }, tx);

  return { simulation, balances };
});
```

---

## Next Steps

1. ✅ Database migration completed
2. ⏳ Implement service methods (`approveSimulation`, `withdrawFunds`)
3. ⏳ Implement controller endpoints
4. ⏳ Update routes
5. ⏳ Write integration tests
6. ⏳ Write unit tests
7. ⏳ Update API documentation
8. ⏳ Deploy to staging
9. ⏳ Run acceptance tests
10. ⏳ Deploy to production

---

## Support

**Documentation**:
- [Specification](./spec.md)
- [Data Model](./data-model.md)
- [API Contract](./contracts/api-spec.yaml)
- [Research Decisions](./research.md)

**Troubleshooting**:
1. Check logs: `tail -f logs/app.log`
2. Check Prisma client is regenerated: `npx prisma generate`
3. Verify database schema: `npx prisma db pull`
4. Run tests: `npm test -- loanSimulations`

**Common Commands**:
```bash
# Reset database (dev only)
npx prisma migrate reset

# View database
npx prisma studio

# Generate SDK (if using Orval)
npm run sdk:generate

# Lint and format
npm run lint
npm run format
```
