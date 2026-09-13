import { handlePushRequest } from '../server/push.js';

export function POST(request: Request): Promise<Response> {
  return handlePushRequest(request);
}

export function DELETE(request: Request): Promise<Response> {
  return handlePushRequest(request);
}
