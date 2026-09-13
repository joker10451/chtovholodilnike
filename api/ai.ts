import { handleAiRequest } from '../server/ai.js';

export function POST(request: Request): Promise<Response> {
  return handleAiRequest(request);
}
