import { getDeps } from '@/server/deps';
import { handleConcepts } from '@/server/handlers/concepts';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleConcepts(req, getDeps());
}
