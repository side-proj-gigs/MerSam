import { collectionRoutes } from '@/presentation/http/crud';
import { testimonialConfig } from '@/presentation/http/collection-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionRoutes(testimonialConfig);
