import { getDeps } from '@/server/deps';
import { handleIntake } from '@/server/handlers/intake';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleIntake(req, getDeps());
}
