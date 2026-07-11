-- Remove INVENTORY from Role enum
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
DROP TYPE "Role_old";

-- Update loyalty_rewards table
ALTER TABLE "loyalty_rewards" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "station" TEXT;
ALTER TABLE "loyalty_rewards" ADD COLUMN IF NOT EXISTS "maxPrice" DOUBLE PRECISION;
