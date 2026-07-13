export const dynamic = 'force-dynamic';
import { success, withAuth } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions-config';

export const GET = withAuth(async () => {
  return success({ features: FEATURES });
});
