import { itemRoutes } from '@/presentation/http/crud';
import { serviceCategoryConfig } from '@/presentation/http/collection-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = itemRoutes(serviceCategoryConfig);
