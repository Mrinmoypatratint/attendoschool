/** Keep the native login available independently of third-party font/checkout hosts. */
export function nativeEntryHtml(html: string): string {
  return html
    .replace(/<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/g, '')
    .replace('<script src="https://checkout.razorpay.com/v1/checkout.js">', '<script async src="https://checkout.razorpay.com/v1/checkout.js">');
}
