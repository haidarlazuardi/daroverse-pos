export const dynamic = 'force-dynamic';
import { success, withAuth } from '@/lib/api-helpers';
import { FEATURES } from '../route';

export const GET = withAuth(async () => {
  return success({ features: FEATURES });
});
