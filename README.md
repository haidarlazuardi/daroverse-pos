# Daroverse POS

Production-ready F&B Point of Sale system built with Next.js, Prisma, and PostgreSQL.

## Features

- **Fast POS** — Touch-optimized cashier interface, <3 step checkout
- **Recipe-Based Inventory** — Auto stock deduction on every sale
- **Inventory Management** — Stock levels, movements, adjustments, low-stock alerts
- **Procurement** — Suppliers, purchase orders (draft → approved → completed)
- **Cost Tracking** — COGS calculated from recipes, profit per transaction
- **Analytics Dashboard** — Revenue, profit, peak hours, menu engineering
- **Role-Based Access** — Admin (full access) and Cashier (POS only)
- **Multi-Outlet** — Separate inventory per outlet, centralized reporting
- **Multi-Device** — Desktop admin dashboard, tablet-optimized POS

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Prisma** ORM + **PostgreSQL**
- **Zustand** for state management
- **Tailwind CSS** for styling

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally or remote)
- npm or yarn

### 1. Install Dependencies

```bash
cd daroverse-pos
npm install
```

### 2. Configure Database

Edit `.env` and set your PostgreSQL connection string:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/daroverse_pos"
```

Create the database:

```bash
createdb daroverse_pos
# or via psql: CREATE DATABASE daroverse_pos;
```

### 3. Setup Database & Seed

```bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed with demo data (20 products, 30 days of orders, suppliers, etc.)
npx tsx prisma/seed.ts
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

| Role    | Email                    | Password    | Redirects to |
|---------|--------------------------|-------------|--------------|
| Admin   | admin@daroverse.com      | admin123    | /dashboard   |
| Cashier | cashier@daroverse.com    | cashier123  | /pos         |

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/login/         # JWT authentication
│   │   ├── products/           # CRUD + recipe management
│   │   ├── categories/         # Category management
│   │   ├── ingredients/        # Ingredient management
│   │   ├── orders/             # Order creation + stock deduction
│   │   ├── dashboard/          # Analytics aggregation
│   │   ├── suppliers/          # Supplier CRUD
│   │   ├── purchase-orders/    # PO lifecycle management
│   │   ├── stock-movements/    # Stock adjustment logging
│   │   ├── users/              # User management
│   │   ├── alerts/             # Low stock + margin alerts
│   │   └── outlets/            # Multi-outlet management
│   ├── login/                  # Login page
│   ├── pos/                    # POS interface (cashier)
│   ├── dashboard/              # Analytics dashboard (admin)
│   ├── inventory/              # Stock management (admin)
│   ├── products/               # Product + recipe management (admin)
│   ├── suppliers/              # Supplier management (admin)
│   ├── purchase-orders/        # Procurement (admin)
│   └── users/                  # User management (admin)
├── components/
│   ├── ui/                     # Reusable UI components
│   └── layout/                 # Admin sidebar layout
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # JWT auth utilities
│   ├── api-helpers.ts          # API response helpers + middleware
│   ├── stock-engine.ts         # Core stock deduction + cost calculation
│   └── fetch.ts                # Client-side API helper
├── store/
│   └── index.ts                # Zustand stores (auth + cart)
└── types/                      # TypeScript types
```

## Core Business Logic

### Transaction Flow
```
Order → Checkout → Calculate COGS → Create Order + Payment
  → Trigger Recipe Engine → Deduct Stock per Ingredient
  → Log Stock Movements → Update Analytics
```

### Inventory Flow
```
Stock Change → Log Movement → Update Stock Level
  → Check Threshold → Generate Alert if Low
```

### Procurement Flow
```
Low Stock Alert → Create PO (Draft) → Approve → Receive (Complete)
  → Increase Stock → Update Ingredient Price → Recalculate Product Costs
```

### Menu Engineering
Products are auto-classified based on popularity and profitability:
- ⭐ **Star** — High popularity, high margin
- 🐴 **Plowhorse** — High popularity, low margin
- 🧩 **Puzzle** — Low popularity, high margin
- 🐕 **Dog** — Low popularity, low margin

## Role Permissions

| Feature            | Admin | Cashier |
|--------------------|-------|---------|
| POS / Create Order | ✅    | ✅      |
| View Own Orders    | ✅    | ✅      |
| Dashboard          | ✅    | ❌      |
| Products           | ✅    | ❌      |
| Inventory          | ✅    | ❌      |
| Suppliers          | ✅    | ❌      |
| Purchase Orders    | ✅    | ❌      |
| User Management    | ✅    | ❌      |
| View Cost/Profit   | ✅    | ❌      |

## Database Schema

17 tables covering users, outlets, products, categories, recipes, ingredients, stock levels, stock movements, orders, payments, suppliers, purchase orders, and customers.

Run `npx prisma studio` to explore the database visually.

---

Built as a Daroverse product. ☕
