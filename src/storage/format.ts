import { BehaviorSubject } from "rxjs";
import { createAttacchmentFromFile, createAttachmentFromChatPart } from "../chat-tree/attachment";
import type { ChatNode } from "../chat-tree/tree-store";
import { fileToDataUrl } from "./codec";

export async function stringifyChat(nodes: ChatNode[]) {
  return `
<html>
  <head></head>
  <body>
    <article>${(await Promise.all(nodes.map(stringifyNode))).join("")}</article>
  </body>
</html>
  `;
}

async function stringifyNode(node: ChatNode) {
  const section = createMessageSection(node);

  const objects = await Promise.all(
    (node.attachments ?? []).map(async (attachment) => {
      switch (attachment.type) {
        case "embedded": {
          const part = attachment.file;
          const object = document.createElement("object");
          object.setAttribute("data-attachment-type", "embedded");
          object.setAttribute("data-size", part.size.toString());
          object.type = part.type;
          object.name = part.name;
          object.data = part.url;
          return object;
        }
        case "external": {
          const file = attachment.file;
          const object = document.createElement("object");
          object.setAttribute("data-attachment-type", "external");
          object.type = file.type;
          object.name = file.name;
          object.data = await fileToDataUrl(file);
          return object;
        }
        default: {
          throw new Error(`Unknown attachment type: ${(attachment as any).type}`);
        }
      }
    }),
  );

  section.append(...objects);

  return section.outerHTML;
}

function createMessageSection(node: ChatNode): HTMLElement {
  const section = document.createElement("section");
  section.dataset.role = node.role;
  const p = document.createElement("p");
  p.textContent = node.content;
  section.append(p);
  return section;
}

export async function parseChat(raw: string, preserveIds?: string[]): Promise<ChatNode[]> {
  const dom = new DOMParser().parseFromString(raw, "text/html");
  const nodes = (await Promise.all([...dom.querySelectorAll<HTMLElement>(`[data-role]`)].map(parseMessaage))).map(
    (node, i) => ({ ...node, id: preserveIds?.at(i) ?? node.id }),
  );

  return nodes;
}

async function parseMessaage(node: HTMLElement): Promise<ChatNode> {
  const content = [...node.querySelectorAll("p")].map((p) => p.textContent).join("\n\n");

  const attachments = await Promise.all(
    [...node.querySelectorAll("object")].map(async (obj) => {
      const type = obj.getAttribute("data-attachment-type");
      switch (type) {
        case "embedded": {
          return createAttachmentFromChatPart({
            type: obj.type,
            name: obj.name,
            url: obj.data,
            size: parseInt(obj.getAttribute("data-size") ?? "0"),
          });
        }
        case "external": {
          return createAttacchmentFromFile(
            await fetch(obj.data)
              .then((res) => res.blob())
              .then((blob) => new File([blob], obj.name, { type: obj.type })),
          );
        }
        default: {
          throw new Error(`Unknown attachment type: ${type}`);
        }
      }
    }),
  );

  return {
    id: crypto.randomUUID(),
    role: node.dataset.role as "user",
    attachments: attachments.length > 0 ? attachments : undefined,
    content,
    metadata$: new BehaviorSubject({}),
  };
}
