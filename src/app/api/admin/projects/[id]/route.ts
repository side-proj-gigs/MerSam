import { itemRoutes } from '@/presentation/http/crud';
import { projectConfig } from '@/presentation/http/collection-configs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = itemRoutes(projectConfig);
