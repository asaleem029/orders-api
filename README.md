# Orders API

A production-ready NestJS Orders API with idempotent create operations, optimistic locking, keyset pagination, and transactional outbox pattern.

## Features

- ✅ **Idempotent Create**: Uses `Idempotency-Key` header with Redis storage (1-hour TTL)
- ✅ **Optimistic Locking**: Version-based updates using `If-Match` header
- ✅ **Keyset Pagination**: Stable, cursor-based pagination for listing orders
- ✅ **Transactional Outbox**: Atomic order closure with outbox event insertion
- ✅ **Multi-tenancy**: Tenant-scoped operations via `X-Tenant-Id` header
- ✅ **Correlation IDs**: Request tracking via `X-Request-ID` header
- ✅ **Event Publishing**: Mock Apache Pulsar integration with event envelope format
- ✅ **Health Checks**: Liveness and readiness probes
- ✅ **OpenAPI/Swagger**: API documentation at `/api`

## Tech Stack

- **NestJS** (latest) with TypeScript
- **TypeORM** for database access
- **PostgreSQL** for data persistence
- **Redis** for idempotency key storage
- **pnpm** as package manager
- **Jest + Supertest** for testing

## Prerequisites

- Node.js 18+ 
- pnpm 8+
- Docker and Docker Compose (for PostgreSQL and Redis)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 3. Environment Variables

Create a `.env` file (or use `.env.local`):

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=orders_user
DATABASE_PASSWORD=orders_password
DATABASE_NAME=orders_db

REDIS_HOST=localhost
REDIS_PORT=6379

PORT=3000
NODE_ENV=development
```

### 4. Run Migrations

```bash
pnpm migration:run
```

### 5. Start the Application

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`
Swagger documentation: `http://localhost:3000/api`

## API Endpoints

### Base Path: `/api/v1`

All endpoints require the `X-Tenant-Id` header for tenant identification.

### POST `/api/v1/orders` - Create Draft Order (Idempotent)

Creates a new draft order. Same `Idempotency-Key` + same body within 1 hour returns the original response.

**Headers:**
- `X-Tenant-Id`: Tenant identifier (required)
- `Idempotency-Key`: Unique key for idempotency (required)
- `X-Request-ID`: Correlation ID (optional, auto-generated if missing)

**Request Body:**
```json
{}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "status": "draft",
  "version": 1,
  "createdAt": "2025-01-26T10:30:00.000Z"
}
```

**Error (409) - Idempotency Key Conflict:**
```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_CONFLICT",
    "message": "Idempotency key already used with different request body",
    "timestamp": "2025-01-26T10:30:00Z",
    "path": "/api/v1/orders",
    "details": {
      "idempotencyKey": "key-123"
    }
  }
}
```

### PATCH `/api/v1/orders/:id/confirm` - Confirm Order (Optimistic Locking)

Confirms a draft order and sets the total amount. Requires `If-Match` header with current version.

**Headers:**
- `X-Tenant-Id`: Tenant identifier (required)
- `If-Match`: Current order version, e.g., `"1"` (required)
- `X-Request-ID`: Correlation ID (optional)

**Request Body:**
```json
{
  "totalCents": 1234
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "status": "confirmed",
  "version": 2,
  "totalCents": 1234,
  "createdAt": "2025-01-26T10:30:00.000Z"
}
```

**Error (409) - Version Mismatch:**
```json
{
  "error": {
    "code": "VERSION_MISMATCH",
    "message": "Order version mismatch. Expected 1, got 2",
    "timestamp": "2025-01-26T10:30:00Z",
    "path": "/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/confirm",
    "details": {
      "orderId": "550e8400-e29b-41d4-a716-446655440000",
      "expectedVersion": 1,
      "currentVersion": 2
    }
  }
}
```

### POST `/api/v1/orders/:id/close` - Close Order (Transactional Outbox)

Closes a confirmed order and writes an outbox event in the same database transaction.

**Headers:**
- `X-Tenant-Id`: Tenant identifier (required)
- `X-Request-ID`: Correlation ID (optional)

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "status": "closed",
  "version": 3,
  "totalCents": 1234,
  "createdAt": "2025-01-26T10:30:00.000Z"
}
```

**Preconditions:** Order must be in `confirmed` status.

### GET `/api/v1/orders` - List Orders (Keyset Pagination)

Lists orders with keyset pagination. Results are sorted by `created_at DESC, id DESC`.

**Query Parameters:**
- `limit`: Number of items per page (default: 20, max: 100)
- `cursor`: Opaque cursor for pagination (optional)

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "tenant-123",
      "status": "draft",
      "version": 1,
      "createdAt": "2025-01-26T10:30:00.000Z"
    }
  ],
  "nextCursor": "MjAyNS0wMS0yNlQxMDozMDowMC4wMDBafDU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMA=="
}
```

### GET `/health/liveness` - Liveness Probe

**Response (200):**
```json
{
  "status": "ok"
}
```

### GET `/health/readiness` - Readiness Probe

**Response (200):**
```json
{
  "status": "ready",
  "checks": {
    "database": "up",
    "redis": "up"
  }
}
```

## cURL Examples

### Create Order

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "X-Tenant-Id: tenant-123" \
  -H "Idempotency-Key: key-abc-123" \
  -H "X-Request-ID: req-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Confirm Order

```bash
curl -X PATCH http://localhost:3000/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/confirm \
  -H "X-Tenant-Id: tenant-123" \
  -H "If-Match: \"1\"" \
  -H "X-Request-ID: req-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"totalCents": 1234}'
```

### Close Order

```bash
curl -X POST http://localhost:3000/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/close \
  -H "X-Tenant-Id: tenant-123" \
  -H "X-Request-ID: req-$(uuidgen)"
```

### List Orders

```bash
curl -X GET "http://localhost:3000/api/v1/orders?limit=10" \
  -H "X-Tenant-Id: tenant-123" \
  -H "X-Request-ID: req-$(uuidgen)"
```

### List Orders with Cursor

```bash
curl -X GET "http://localhost:3000/api/v1/orders?limit=10&cursor=MjAyNS0wMS0yNlQxMDozMDowMC4wMDBafDU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMA=="" \
  -H "X-Tenant-Id: tenant-123" \
  -H "X-Request-ID: req-$(uuidgen)"
```

## Testing

Run unit tests:
```bash
pnpm test
```

Run e2e tests:
```bash
pnpm test:e2e
```

The e2e tests cover:
- Idempotent create (same key replay, different body conflict)
- Optimistic locking (correct version, stale version 409)
- Transactional outbox (close creates outbox entry)
- Keyset pagination (no duplicates, tenant filtering)

## Database Schema

### `orders` Table

- `id` (UUID, PK)
- `tenant_id` (TEXT)
- `status` (ENUM: draft | confirmed | closed)
- `version` (INT, default: 1)
- `total_cents` (INT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `(tenant_id, created_at, id)` - For keyset pagination
- `(tenant_id, id)` - For tenant-scoped lookups

### `outbox` Table

- `id` (UUID, PK)
- `event_type` (TEXT)
- `order_id` (UUID)
- `tenant_id` (TEXT)
- `payload` (JSONB)
- `published_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)

**Indexes:**
- `(published_at, event_type)` - For polling unpublished events

## Architecture Notes

### Multi-tenancy

Tenant identification is done via the `X-Tenant-Id` header (simpler for exercise). In production, extract from JWT Bearer token claims.

### Idempotency

Idempotency keys are stored in Redis with a 1-hour TTL. The key format is: `idempotency:{tenantId}:{key}`.

### Event Publishing

Events are published with a standard envelope format. The Pulsar client is mocked for this exercise. In production, integrate with Apache Pulsar.

### Correlation IDs

Correlation IDs are extracted from `X-Request-ID` header (or auto-generated) and stored in `AsyncLocalStorage` for logging and tracing.

## Project Structure

```
src/
├── modules/
│   ├── orders/
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── entities/         # TypeORM entities
│   │   ├── services/         # Business logic
│   │   ├── orders.controller.ts
│   │   └── orders.module.ts
│   └── health/
├── common/
│   ├── decorators/           # Custom decorators (e.g., @Tenant)
│   ├── errors/               # Exception filters
│   ├── guards/               # Guards (e.g., TenantGuard)
│   ├── interceptors/         # Interceptors (e.g., CorrelationIdInterceptor)
│   └── types/                # TypeScript type definitions
├── config/                   # Configuration modules (Database, Redis)
├── events/                   # Event publishing service
└── migrations/              # TypeORM migrations
```

## License

UNLICENSED

