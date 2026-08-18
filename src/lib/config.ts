export const BASE_PATH = '/reader';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (BASE_PATH && !cleanPath.startsWith(BASE_PATH)) {
    return `${BASE_PATH}${cleanPath}`;
  }
  return cleanPath;
}

export function getAssetUrl(path: string): string {
  if (!path) return '';
  // If it's an external URL (http/https), return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (BASE_PATH && !cleanPath.startsWith(BASE_PATH)) {
    return `${BASE_PATH}${cleanPath}`;
  }
  return cleanPath;
}
