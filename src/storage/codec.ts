// reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa

export function textToDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return `data:text/plain;charset=utf-8;base64,${bytesToBase64(bytes)}`;
}

export async function fileToDataUrl(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

export function dataUrlToText(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1];
  return new TextDecoder().decode(base64ToBytes(base64));
}

export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const fetched = await fetch(dataUrl);
  const blob = await fetched.blob();
  return new File([blob], fileName, { type: blob.type });
}

function base64ToBytes(base64: string) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

export const fileExtensionMimeTypes: Record<string, string> = {
  txt: "text/plain",
  js: "text/javascript",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  md: "text/markdown",
  xml: "application/xml",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};
