import type { ImagePart } from '../shared/aiSchemas';

const MAX_SIDE = 1280;
const QUALITY = 0.8;

/** Уменьшает фото с камеры, чтобы быстро отправить его нейросети и не занимать память */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const source = bitmap ?? (await loadImage(file));
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', QUALITY),
  );
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть фото')); };
    img.src = url;
  });
}

export async function toImagePart(blob: Blob): Promise<ImagePart> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const mime = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
  return { mime_type: mime, data: btoa(binary) };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения'));
    reader.readAsDataURL(blob);
  });
}
