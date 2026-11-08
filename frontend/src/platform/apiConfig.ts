export const PRODUCTION_API_URL = 'https://attendoschool.online/api';

/** Native assets run on localhost; API traffic must go to the shared HTTPS server. */
export function nativeApiUrl(configuredUrl?: string): string {
  const value = configuredUrl?.trim() || PRODUCTION_API_URL;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('The native API URL must be an absolute HTTPS URL without credentials or query parameters.');
  }
  return value.replace(/\/+$/, '');
}
