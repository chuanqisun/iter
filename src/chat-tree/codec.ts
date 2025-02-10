export function textToDataUrl(text: string): string {
  const utf8Encoder = new TextEncoder();
  const uint8Array = utf8Encoder.encode(text);
  const base64 = btoa(String.fromCharCode(...uint8Array));
  return `data:text/plain;charset=utf-8;base64,${base64}`;
}