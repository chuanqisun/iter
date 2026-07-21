import type { EmbeddedFile } from "./tree-store";

export interface ClipboardTextAttachment {
  filename: "filename.md" | "filename.txt";
  text: string;
}

const SUPPORTED_TEXT_TYPES = ["text/markdown", "text/html", "text/plain"] as const;

export async function readClipboardTextAttachment(): Promise<ClipboardTextAttachment | undefined> {
  const items = await navigator.clipboard.read();
  const item = items.find((candidate) => SUPPORTED_TEXT_TYPES.some((type) => candidate.types.includes(type)));
  if (!item) return undefined;

  if (item.types.includes("text/markdown")) {
    const text = await (await item.getType("text/markdown")).text();
    return text ? { filename: "filename.md", text } : undefined;
  }

  if (item.types.includes("text/html")) {
    if (!item.types.includes("text/plain")) return undefined;
    const text = await (await item.getType("text/plain")).text();
    return text ? { filename: "filename.md", text } : undefined;
  }

  const text = await (await item.getType("text/plain")).text();
  return text ? { filename: "filename.txt", text } : undefined;
}

export async function getParts(data?: DataTransfer): Promise<EmbeddedFile[]> {
  const items = data?.items;
  if (!items) return [];

  const parts = await Promise.all(
    [...items].map(async (item) => {
      const file = item.getAsFile();
      if (!file) return null;
      const reader = new FileReader();

      return new Promise<EmbeddedFile>((resolve) => {
        reader.onload = () =>
          resolve({
            name: file.name,
            type: file.type ? file.type : "text/plain",
            url: reader.result as string,
            size: file.size,
          });
        reader.readAsDataURL(file);
      });
    }),
  );

  return parts.filter((part) => part !== null);
}
