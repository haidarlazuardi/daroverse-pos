-- Safe migration: remove INVENTORY from Role enum
-- Step 1: Drop default on role column
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Step 2: Update any INVENTORY users first
UPDATE "users" SET role = 'MANAGER' WHERE role::text = 'INVENTORY';

-- Step 3: Create new enum
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN');

-- Step 4: Alter column using new enum
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING role::text::"Role_new";

-- Step 5: Drop old enum and rename
DROP TYPE IF EXISTS "Role";
DROP TYPE IF EXISTS "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Step 6: Restore default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER';

-- Step 7: Add PURCHASE to ExpenseCategory
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PURCHASE';

-- Step 8: loyalty_rewards updates
ALTER TABLE "loyalty_rewards" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "station" TEXT;
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "maxPrice" DOUBLE PRECISION;
