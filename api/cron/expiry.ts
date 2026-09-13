import { handleExpiryCron } from '../../server/notify.js';

export function GET(request: Request): Promise<Response> {
  return handleExpiryCron(request);
}
