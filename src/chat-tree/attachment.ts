import { dataUrlToFile, dataUrlToText, fileToDataUrl, isTextEncodable } from "../storage/codec";
import { downloadUrl } from "./download";
import { getReadableFileSize } from "./file-size";
import type { Attachment, AttachmentEmbedded, AttachmentExternal, ChatNode, EmbeddedFile } from "./tree-store";

export function createAttachmentFromChatPart(part: EmbeddedFile): AttachmentEmbedded {
  return { id: crypto.randomUUID(), type: "embedded", file: part };
}

export function createAttacchmentFromFile(file: File): AttachmentExternal {
  return { id: crypto.randomUUID(), type: "external", file };
}

export function getAttachmentExternalFiles(node: ChatNode): File[] {
  return (
    node.attachments?.filter((attachment) => attachment.type === "external").map((attachment) => attachment.file) ?? []
  );
}

export function getAttachmentEmbeddedFiles(node: ChatNode): EmbeddedFile[] {
  return (
    node.attachments?.filter((attachment) => attachment.type === "embedded").map((attachment) => attachment.file) ?? []
  );
}

export async function castToFile(maybeFile?: File | EmbeddedFile | null): Promise<File | undefined> {
  if (!maybeFile) return undefined;
  if (maybeFile instanceof File) return maybeFile;
  return dataUrlToFile(maybeFile.url, maybeFile.name);
}

/**
 * Assuming new attachments are unique by type and file name already
 */
export function upsertAttachments(...newAttachments: Attachment[]) {
  return (node: ChatNode) => {
    const existingAttachments = node.attachments ?? [];
    const remaining = existingAttachments.filter(
      (attachment) =>
        !newAttachments.some(
          (newAttachment) => newAttachment.type === attachment.type && newAttachment.file.name === attachment.file.name,
        ),
    );
    return { attachments: [...remaining, ...newAttachments] };
  };
}

export function removeAttachment(id: string) {
  return (node: ChatNode) => ({ attachments: node.attachments?.filter((attachment) => attachment.id !== id) });
}

export function downloadAttachment(node: ChatNode, attachmentId: string) {
  const attachment = findAttachment(node, attachmentId);
  switch (attachment?.type) {
    case "embedded": {
      const file = attachment.file;
      return downloadUrl(file.url, file.name);
    }
    case "external": {
      const file = attachment.file;
      const url = URL.createObjectURL(file);
      downloadUrl(url, file.name);
      URL.revokeObjectURL(url);
      return;
    }
    default: {
      console.error(`Unknown attachment`, attachment);
    }
  }
}

export function replaceAttachment(attachmentId: string, newAttachment: Attachment) {
  return (node: ChatNode) => {
    const existingAttachments = node.attachments ?? [];
    const updatedAttachments = existingAttachments.map((attachment) => {
      if (attachment.id === attachmentId && attachment.file.name === newAttachment.file.name) return newAttachment;
      return attachment;
    });

    return { attachments: updatedAttachments };
  };
}

export async function getToggledAttachment(node: ChatNode, attachmentId: string): Promise<Attachment | undefined> {
  const attachment = findAttachment(node, attachmentId);
  if (!attachment) return undefined;

  if (attachment.type === "embedded") {
    const part = attachment.file;
    const createdFile = await dataUrlToFile(part.url, part.name);
    const newAttachment: AttachmentExternal = { id: attachmentId, type: "external", file: createdFile };
    return newAttachment;
  } else {
    const file = attachment.file;
    const base64DataUrl = await fileToDataUrl(file);
    const newAttachment: AttachmentEmbedded = {
      id: attachmentId,
      type: "embedded",
      file: { name: file.name, type: file.type, size: file.size, url: base64DataUrl },
    };
    return newAttachment;
  }
}

export function findAttachment(node: ChatNode, attachmentId: string): Attachment | undefined {
  return node.attachments?.find((attachment) => attachment.id === attachmentId);
}

export function getDisplayType(attachment: Attachment): string {
  switch (attachment.type) {
    case "embedded":
      return "Embedded";
    case "external":
      return "External";
    default:
      return "Unknown";
  }
}

export async function getAttachmentTextContent(attachment: Attachment): Promise<string> {
  if (!isTextEncodable(attachment.file.type)) {
    return `(binary data ${getReadableFileSize(attachment.file.size)})`;
  }

  switch (attachment.type) {
    case "embedded": {
      const file = attachment.file;
      return dataUrlToText(file.url);
    }

    case "external": {
      const file = attachment.file;
      return file.text();
    }
  }
}

export function getValidAttachmentFileName(name: string): string {
  // Remove any characters that are not alphanumeric, underscore, or hyphen
  const base = name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  const hasExt = base.lastIndexOf(".");
  if (hasExt === -1) return `${base}.txt`;

  const ext = base.slice(hasExt);
  const baseName = base.slice(0, hasExt);
  if (baseName.length === 0) {
    return `file${ext}`;
  }
  return `${baseName}${ext}`;
}
