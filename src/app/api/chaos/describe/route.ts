import { getDeps } from '@/server/deps';
import { handleChaosDescribe } from '@/server/handlers/chaosDescribe';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleChaosDescribe(req, getDeps());
}
