import { handleLogRequest } from '../server/log.js';

export function POST(request: Request): Promise<Response> {
  return handleLogRequest(request);
}
