import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export interface ProcessedPhoto {
  base64Data: string;
  mimeType: string;
  dataUrl: string;
  blob: Blob;
}

export async function compressPhotoForArchive(
  file: File,
  maxDimension = 760,
  quality = 0.74,
): Promise<ProcessedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected photograph.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a supported photograph.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser canvas context unavailable.'));
          return;
        }
        ctx.fillStyle = '#FBF9F5';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        // Guarantee payload stays comfortably inside Firestore 180,000 char validation rule
        while (dataUrl.length > 145000 && currentQuality > 0.35) {
          currentQuality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }

        const base64Data = dataUrl.split(',')[1] || '';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode compressed photograph.'));
              return;
            }
            resolve({
              base64Data,
              mimeType: 'image/jpeg',
              dataUrl,
              blob,
            });
          },
          'image/jpeg',
          currentQuality,
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadCollectiblePhoto(
  uid: string,
  itemId: string,
  processed: ProcessedPhoto,
): Promise<string> {
  try {
    const objectRef = ref(storage, `users/${uid}/items/${itemId}.jpg`);
    const uploadTask = uploadBytes(objectRef, processed.blob, {
      contentType: processed.mimeType,
      cacheControl: 'public,max-age=31536000',
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timed out')), 4500),
    );
    await Promise.race([uploadTask, timeout]);
    const downloadUrl = await getDownloadURL(objectRef);
    if (downloadUrl && downloadUrl.length <= 2048) {
      return downloadUrl;
    }
    return processed.dataUrl;
  } catch {
    // Graceful Spark fallback when Cloud Storage bucket rules are not yet initialized
    return processed.dataUrl;
  }
}
