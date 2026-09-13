import { handleBarcodeRequest } from '../server/barcode.js';

export function GET(request: Request): Promise<Response> {
  return handleBarcodeRequest(request);
}
