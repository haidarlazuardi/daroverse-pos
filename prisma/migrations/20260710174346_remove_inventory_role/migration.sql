-- Step 1: Drop default constraint first
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Step 2: Rename old enum
ALTER TYPE "Role" RENAME TO "Role_old";

-- Step 3: Create new enum without INVENTORY
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN');

-- Step 4: Update any INVENTORY users to MANAGER
UPDATE "users" SET role = 'MANAGER'::text WHERE role::text = 'INVENTORY';

-- Step 5: Cast column to new type
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING role::text::"Role";

-- Step 6: Restore default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER';

-- Step 7: Drop old enum
DROP TYPE "Role_old";

-- Step 8: Add PURCHASE to ExpenseCategory
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PURCHASE';

-- Step 9: loyalty_rewards - remove productId, add station and maxPrice
ALTER TABLE "loyalty_rewards" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "station" TEXT;
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "maxPrice" DOUBLE PRECISION;
