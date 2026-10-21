import { getDeps } from '@/server/deps';
import { handleHealth } from '@/server/handlers/health';

export const maxDuration = 30;

export async function GET(req: Request): Promise<Response> {
  return handleHealth(req, getDeps());
}
