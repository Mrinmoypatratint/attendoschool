import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { API_BASE_URL } from '../api';

const serverOrigin = new URL(API_BASE_URL).origin;

function resolveUrl(value: string): URL {
  const url = new URL(value, value.startsWith('/api/') ? serverOrigin : window.location.href);
  if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
    return new URL(url.pathname + url.search, serverOrigin);
  }
  return url;
}

async function shareDownload(value: string, suggestedName = 'document'): Promise<void> {
  const url = resolveUrl(value);
  const headers: Record<string, string> = {};
  // Never disclose the session to a third-party URL.
  if (url.origin === serverOrigin && url.pathname.startsWith('/api/')) {
    const token = localStorage.getItem('attendance_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url.href, { headers });
  if (!response.ok) throw new Error('Could not download this file. Please try again.');
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the downloaded file.'));
    reader.readAsDataURL(blob);
  });
  const dispositionName = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1];
  const name = (dispositionName || suggestedName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
  const file = await Filesystem.writeFile({ path: `downloads/${Date.now()}-${name}`, directory: Directory.Cache, data, recursive: true });
  await Share.share({ title: name, files: [file.uri], dialogTitle: 'Save or share document' });
}

function reportError(error: unknown): void {
  console.error('Native action failed', error);
  window.alert(error instanceof Error ? error.message : 'Could not open this file. Please try again.');
}

async function openNative(value: string, name?: string): Promise<void> {
  const url = resolveUrl(value);
  if (name || url.protocol === 'blob:' || url.protocol === 'data:' || (url.origin === serverOrigin && url.pathname.startsWith('/api/'))) {
    await shareDownload(value, name);
  } else if (url.protocol === 'https:') {
    await Browser.open({ url: url.href });
  }
}

export async function initializeNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() === 'android') {
    await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      if (canGoBack) window.history.back();
      else void App.minimizeApp();
    });
  }

  // Existing screens use anchors and window.open for PDFs, CSVs and attachments.
  // On devices, use the native share sheet instead of WebView-only downloads.
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a') : null;
    if (!link || event.defaultPrevented) return;
    if (link.hasAttribute('download') || link.target === '_blank') {
      event.preventDefault();
      void openNative(link.href, link.hasAttribute('download') ? link.download || 'document' : undefined).catch(reportError);
    }
  }, true);
  window.open = ((url?: string | URL) => {
    if (url) void openNative(String(url)).catch(reportError);
    return null;
  }) as typeof window.open;
}
