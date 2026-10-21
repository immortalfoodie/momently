import { getDeps } from '@/server/deps';
import { handleNarrate } from '@/server/handlers/narrate';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleNarrate(req, getDeps());
}
