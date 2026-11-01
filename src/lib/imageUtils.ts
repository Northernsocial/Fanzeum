import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
  type StorageReference,
} from 'firebase/storage';
import type { ItemPhoto } from '../types/domain';
import { storage } from './firebase';

export interface CropRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

export interface PhotoEditOptions {
  rotationDeg?: 0 | 90 | 180 | 270;
  crop?: CropRect;
  label?: string;
}

export interface ProcessedCollectiblePhoto {
  fullBlob: Blob;
  thumbBlob: Blob;
  mimeType: string;
  width: number;
  height: number;
  previewUrl: string;
  blurDataUrl: string;
  identifyBase64: string;
  label: string;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode selected photo.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo file.'));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<{ blob: Blob; actualMime: string }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, actualMime: blob.type || mimeType });
          return;
        }
        // Fallback to JPEG if WebP encoding isn't supported in an older WebView
        canvas.toBlob(
          (fallbackBlob) => {
            if (!fallbackBlob) {
              reject(new Error('Failed to encode photo on canvas.'));
              return;
            }
            resolve({ blob: fallbackBlob, actualMime: 'image/jpeg' });
          },
          'image/jpeg',
          quality,
        );
      },
      mimeType,
      quality,
    );
  });
}

function drawEditedSourceCanvas(
  img: HTMLImageElement,
  options?: PhotoEditOptions,
): HTMLCanvasElement {
  const crop: CropRect = options?.crop || { x: 0, y: 0, width: 1, height: 1 };
  const sx = Math.max(0, Math.round(crop.x * img.naturalWidth));
  const sy = Math.max(0, Math.round(crop.y * img.naturalHeight));
  const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(crop.width * img.naturalWidth)));
  const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(crop.height * img.naturalHeight)));

  const rot = options?.rotationDeg || 0;
  const swapAxes = rot === 90 || rot === 270;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = swapAxes ? sh : sw;
  baseCanvas.height = swapAxes ? sw : sh;

  const ctx = baseCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available.');

  ctx.save();
  ctx.translate(baseCanvas.width / 2, baseCanvas.height / 2);
  if (rot !== 0) {
    ctx.rotate((rot * Math.PI) / 180);
  }
  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();

  return baseCanvas;
}

function scaleCanvas(source: HTMLCanvasElement, maxLongEdge: number): HTMLCanvasElement {
  const longEdge = Math.max(source.width, source.height);
  const scale = Math.min(1, maxLongEdge / longEdge);
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return out;
}

/**
 * Strips EXIF/GPS by re-encoding on <canvas>, applies optional crop + 90-deg rotation,
 * and produces a 2000px WebP master, 480px WebP thumbnail, 24px blur-up string, and AI base64 payload.
 */
export async function processCollectiblePhoto(
  file: Blob,
  options?: PhotoEditOptions,
): Promise<ProcessedCollectiblePhoto> {
  const srcDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(srcDataUrl);
  const edited = drawEditedSourceCanvas(img, options);

  const fullCanvas = scaleCanvas(edited, 2000);
  const thumbCanvas = scaleCanvas(edited, 480);
  const aiCanvas = scaleCanvas(edited, 1280);
  const blurCanvas = scaleCanvas(edited, 20);

  const [{ blob: fullBlob, actualMime }, { blob: thumbBlob }] = await Promise.all([
    canvasToBlob(fullCanvas, 'image/webp', 0.8),
    canvasToBlob(thumbCanvas, 'image/webp', 0.78),
  ]);

  const aiDataUrl = aiCanvas.toDataURL('image/webp', 0.8);
  const identifyBase64 = aiDataUrl.split(',')[1] || '';
  const blurDataUrl = blurCanvas.toDataURL('image/jpeg', 0.5).slice(0, 480);
  const previewUrl = URL.createObjectURL(fullBlob);

  return {
    fullBlob,
    thumbBlob,
    mimeType: actualMime,
    width: fullCanvas.width,
    height: fullCanvas.height,
    previewUrl,
    blurDataUrl,
    identifyBase64,
    label: options?.label || 'Front',
  };
}

export async function uploadProcessedItemPhoto(
  uid: string,
  itemId: string,
  index: number,
  processed: ProcessedCollectiblePhoto,
): Promise<ItemPhoto> {
  const ext = processed.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fullRef = ref(storage, `users/${uid}/items/${itemId}/photo_${index}.${ext}`);
  const thumbRef = ref(storage, `users/${uid}/items/${itemId}/thumb_${index}.${ext}`);

  const metadata = {
    contentType: processed.mimeType,
    cacheControl: 'public,max-age=31536000,immutable',
  };

  await Promise.all([
    uploadBytes(fullRef, processed.fullBlob, metadata),
    uploadBytes(thumbRef, processed.thumbBlob, metadata),
  ]);

  const [url, thumbUrl] = await Promise.all([
    getDownloadURL(fullRef),
    getDownloadURL(thumbRef),
  ]);

  return {
    url,
    thumbUrl,
    width: processed.width,
    height: processed.height,
    label: processed.label,
    blurDataUrl: processed.blurDataUrl,
  };
}

export async function uploadAvatarPhoto(uid: string, file: File): Promise<string> {
  const srcDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(srcDataUrl);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const crop: CropRect = {
    x: (img.naturalWidth - side) / 2 / img.naturalWidth,
    y: (img.naturalHeight - side) / 2 / img.naturalHeight,
    width: side / img.naturalWidth,
    height: side / img.naturalHeight,
  };
  const edited = drawEditedSourceCanvas(img, { crop });
  const avatarCanvas = scaleCanvas(edited, 400);
  const { blob, actualMime } = await canvasToBlob(avatarCanvas, 'image/webp', 0.82);
  const ext = actualMime === 'image/webp' ? 'webp' : 'jpg';
  const avatarRef = ref(storage, `users/${uid}/profile/avatar_${Date.now()}.${ext}`);
  await uploadBytes(avatarRef, blob, {
    contentType: actualMime,
    cacheControl: 'public,max-age=31536000',
  });
  return getDownloadURL(avatarRef);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(b64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function deleteFolderRecursive(folderRef: StorageReference): Promise<void> {
  try {
    const listed = await listAll(folderRef);
    await Promise.all([
      ...listed.items.map((itemRef) => deleteObject(itemRef).catch(() => undefined)),
      ...listed.prefixes.map((subRef) => deleteFolderRecursive(subRef)),
    ]);
  } catch {
    // Non-fatal if bucket path has no objects yet
  }
}

export async function deleteItemStoragePhotos(uid: string, itemId: string): Promise<void> {
  const folderRef = ref(storage, `users/${uid}/items/${itemId}`);
  await deleteFolderRecursive(folderRef);
}

export async function deleteAllUserStorageFiles(uid: string): Promise<void> {
  const rootUserRef = ref(storage, `users/${uid}`);
  await deleteFolderRecursive(rootUserRef);
}
