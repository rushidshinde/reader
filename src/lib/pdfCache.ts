const CACHE_NAME = 'pdf-reader-v1';

/**
 * Retrieves a PDF file as an ArrayBuffer, using CacheStorage API for instant mobile reloads.
 */
export async function getPdfArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch PDF`);
    return await res.arrayBuffer();
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      return await cachedResponse.arrayBuffer();
    }

    const networkResponse = await fetch(url);
    if (!networkResponse.ok) {
      throw new Error(`HTTP ${networkResponse.status}: Failed to fetch PDF`);
    }

    // Cache a copy of the response for future visits
    try {
      await cache.put(url, networkResponse.clone());
    } catch (cacheErr) {
      console.warn('Failed to store PDF in CacheStorage (quota exceeded or restricted):', cacheErr);
    }

    return await networkResponse.arrayBuffer();
  } catch (err) {
    console.warn('CacheStorage read failed, falling back to direct network fetch:', err);
    const fallbackRes = await fetch(url);
    if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}: Failed to fetch PDF`);
    return await fallbackRes.arrayBuffer();
  }
}
