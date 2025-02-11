// reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa

export function textToDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return `data:text/plain;charset=utf-8;base64,${bytesToBase64(bytes)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

export function dataUrlToText(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1];
  return new TextDecoder().decode(base64ToBytes(base64));
}

function base64ToBytes(base64: string) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}
