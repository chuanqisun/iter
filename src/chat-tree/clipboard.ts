import { textToDataUrl } from "../storage/codec";
import type { EmbeddedFile } from "./tree-store";

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

export async function getSystemClipboardParts(): Promise<EmbeddedFile[]> {
  const embeddedFiles: EmbeddedFile[] = [];
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const types = item.types.filter((t) => t !== "text/html" && t !== "text/uri-list");
      const nonTextType = types.find((t) => !t.startsWith("text/"));
      const targetType = nonTextType || types.find((t) => t === "text/plain") || types[0];

      if (targetType) {
        const blob = await item.getType(targetType);
        const reader = new FileReader();
        const url = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        let ext = targetType.split("/")[1] || "bin";
        if (ext === "plain") ext = "txt";
        if (ext === "jpeg") ext = "jpg";
        const filename = `pasted.${ext}`;

        embeddedFiles.push({
          name: filename,
          type: targetType,
          url,
          size: blob.size,
        });
      }
    }
  } catch (err) {
    // Ignored, fallback to readText below
  }

  if (embeddedFiles.length === 0) {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text) {
      embeddedFiles.push({
        name: "pasted.txt",
        type: "text/plain",
        url: textToDataUrl(text),
        size: new Blob([text]).size,
      });
    }
  }

  return embeddedFiles;
}
