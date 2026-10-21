import { getDeps } from '@/server/deps';
import { handleMessage } from '@/server/handlers/message';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleMessage(req, getDeps());
}
