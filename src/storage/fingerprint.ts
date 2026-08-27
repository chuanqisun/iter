import type { Attachment, ChatNode } from "../chat-tree/tree-store";

export function getAttachmentToken({ file: { name, size, type } }: Attachment): string {
  return `${name}:${size}:${type}`;
}

export async function computeNodeFingerprint(
  role: string,
  content: string,
  attachments?: Attachment[],
): Promise<string> {
  const attachmentTokens = (attachments ?? [])
    .map(getAttachmentToken)
    .sort() // ensure order-insensitivity
    .join(";");

  const payload = `${role}\0${content}\0${attachmentTokens}`;
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);

  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function computeThreadFingerprints(nodes: ChatNode[]): Promise<string[]> {
  return Promise.all(nodes.map(({ role, content, attachments }) => computeNodeFingerprint(role, content, attachments)));
}
