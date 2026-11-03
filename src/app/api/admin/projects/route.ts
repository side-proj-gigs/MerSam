import { collectionRoutes } from '@/presentation/http/crud';
import { projectConfig } from '@/presentation/http/collection-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionRoutes(projectConfig);
