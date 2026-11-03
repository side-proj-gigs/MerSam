import { collectionRoutes } from '@/presentation/http/crud';
import { serviceCategoryConfig } from '@/presentation/http/collection-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionRoutes(serviceCategoryConfig);
