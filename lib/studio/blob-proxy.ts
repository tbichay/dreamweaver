/**
 * Blob URL proxy — converts Vercel Blob private URLs to proxied public URLs.
 * Used everywhere that displays blob-stored images/audio/video.
 */

/** Proxy a Vercel Blob URL through our API for authenticated access */
export function blobProxy(url: string): string {
  if (!url) return url;
  if (url.includes(".blob.vercel-storage.com")) {
    return `/api/studio/blob?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/** Same as blobProxy but returns undefined for falsy input */
export function blobProxyOpt(url?: string | null): string | undefined {
  if (!url) return undefined;
  return blobProxy(url);
}
