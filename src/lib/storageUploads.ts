import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { compressImage } from './utils';

interface UploadOptimizedImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  timeoutMs?: number;
  allowDataUrlFallback?: boolean;
  preferDataUrl?: boolean;
  retryCount?: number;
}

export function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(',');
  if (!header || !data) {
    throw new Error('Invalid image data URL.');
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function uploadBytesWithRetry(
  storageRef: ReturnType<typeof ref>,
  payload: Blob | File,
  contentType: string,
  timeoutMs: number,
  retryCount: number
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      await withTimeout(
        uploadBytes(storageRef, payload, { contentType }),
        timeoutMs,
        'Image upload timed out.'
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt === retryCount) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Image upload failed.');
}

export async function uploadOptimizedImage(
  file: File,
  storagePath: string,
  options: UploadOptimizedImageOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? 16000;
  const retryCount = options.retryCount ?? 1;
  let uploadPayload: Blob | File = file;
  let contentType = file.type || 'image/jpeg';
  let fallbackDataUrl: string | null = null;

  if (file.type !== 'image/gif') {
    const compressedDataUrl = await withTimeout(
      compressImage(
        file,
        options.maxWidth ?? 800,
        options.maxHeight ?? 800,
        options.quality ?? 0.8
      ),
      timeoutMs,
      'Image compression timed out.'
    );
    fallbackDataUrl = compressedDataUrl;
    uploadPayload = dataUrlToBlob(compressedDataUrl);
    contentType = uploadPayload.type || 'image/jpeg';
  } else if (options.allowDataUrlFallback) {
    fallbackDataUrl = await withTimeout(
      readFileAsDataUrl(file),
      timeoutMs,
      'Image preparation timed out.'
    );
  }

  const storageRef = ref(storage, storagePath);

  try {
    if (options.allowDataUrlFallback && options.preferDataUrl && fallbackDataUrl) {
      return {
        url: fallbackDataUrl,
        storagePath: null,
      };
    }

    await uploadBytesWithRetry(storageRef, uploadPayload, contentType, timeoutMs, retryCount);
    const url = await withTimeout(
      getDownloadURL(storageRef),
      10000,
      'Image URL retrieval timed out.'
    );

    return {
      url,
      storagePath,
    };
  } catch (error) {
    if (options.allowDataUrlFallback) {
      const inlineUrl = fallbackDataUrl || await withTimeout(
        readFileAsDataUrl(file),
        timeoutMs,
        'Image fallback preparation timed out.'
      );

      return {
        url: inlineUrl,
        storagePath: null,
      };
    }

    throw error;
  }
}

export async function tryDeleteStoragePath(storagePath?: string | null) {
  if (!storagePath) return false;

  try {
    await deleteObject(ref(storage, storagePath));
    return true;
  } catch (error) {
    console.warn('Could not delete storage object:', storagePath, error);
    return false;
  }
}
