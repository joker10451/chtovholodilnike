import { handleBackupRequest } from '../server/backup.js';

export function GET(request: Request): Promise<Response> {
  return handleBackupRequest(request);
}

export function POST(request: Request): Promise<Response> {
  return handleBackupRequest(request);
}
