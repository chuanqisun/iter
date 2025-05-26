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

export const codeBlockLangToFileExtension: Record<string, string> = {
  bash: "sh",
  javascript: "js",
  markdown: "md",
  plaintext: "txt",
  text: "txt",
  python: "py",
  typescript: "ts",
};

export function languageToFileExtension(language: string): string {
  const lang = language.toLocaleLowerCase();
  return codeBlockLangToFileExtension[lang] ?? lang;
}

export const fileExtensionCodeBLockLang: Record<string, string> = {
  sh: "bash",
  js: "javascript",
  md: "markdown",
  txt: "plaintext",
  text: "plaintext",
  py: "python",
  ts: "typescript",
};

export function fileExtensionToLanguage(fileExtension: string): string {
  const ext = fileExtension.toLocaleLowerCase();
  return fileExtensionCodeBLockLang[ext] ?? ext;
}

export const fileExtensionMimeTypes: Record<string, string> = {
  css: "text/css",
  csv: "text/csv",
  gif: "image/gif",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  jsond: "application/x-jsond",
  jsonl: "application/x-jsonl",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  ts: "application/typescript",
  txt: "text/plain",
  xml: "application/xml",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
};

export const mimeTypesFileExtensions: Record<string, string> = Object.fromEntries(
  Object.entries(fileExtensionMimeTypes).map(([ext, mime]) => [mime, ext]),
);

export function filenameToMimeType(fileName: string, fallback = "text/plain"): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return fileExtensionMimeTypes[ext ?? ""] ?? fallback;
}

export function mimeTypeToFileExtension(mimeType: string): string {
  return mimeTypesFileExtensions[mimeType.toLowerCase()] ?? "txt";
}

export function tryDecodeDataUrlAsText(dataUrl: string): { text: string; mediaType: string } | null {
  try {
    const { isBase64, data, mediaType } = parseDataURL(dataUrl);
    return isBase64 ? { text: dataUrlToText(dataUrl), mediaType } : { text: decodeURIComponent(data), mediaType };
  } catch (e) {
    console.warn("Failed to decode data URL as text:", e);
  }
  return null;
}

/**
 * Parse a data: URL into its components.
 *
 * @param {string} dataUrl
 * @returns {{ mediaType: string, isBase64: boolean, charset: string|null, data: string }}
 * @throws {TypeError} if `dataUrl` is not a valid data‑URL
 */
function parseDataURL(dataUrl: string) {
  // Split off the “data:” prefix, the metadata block, and the payload
  // Using a single-regexp with s‑flag to allow newlines in payload if any.
  const match = dataUrl.match(/^data:([^,]*),(.*)$/s);
  if (!match) {
    throw new TypeError("Invalid data URL");
  }

  // match[1] is everything between "data:" and the first comma
  // match[2] is the rest (the payload)
  const fullMime = match[1];
  const rawData = match[2];

  // The metadata block is semicolon‑separated, e.g.
  //    "text/plain;charset=UTF-8;base64"
  const parts = fullMime.split(";");
  // The first part (possibly empty) is the media type
  // (RFC2397 default is text/plain;charset=US‑ASCII when omitted)
  const mediaType = parts[0].toLowerCase() || "text/plain";
  const params = parts.slice(1);

  // Detect base64 flag and optional charset parameter
  const isBase64 = params.includes("base64");
  const charsetParam = params.find((p) => p.toLowerCase().startsWith("charset="));
  const charset = charsetParam ? charsetParam.slice(charsetParam.indexOf("=") + 1) : null;

  return {
    mediaType,
    isBase64,
    charset,
    data: rawData,
  };
}

export function isTextEncodable(mimeType: string): boolean {
  // all the /text
  // svg+xml is also text
  // some application types: js, ts, json, xml, yaml
  return (
    mimeType.startsWith("text/") ||
    mimeType === "image/svg+xml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/x-jsond" ||
    mimeType === "application/x-jsonl"
  );
}
