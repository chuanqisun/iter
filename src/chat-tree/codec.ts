import type { ChatNode } from "./chat-tree";

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

function stringifyNode(node: ChatNode) {
  return node.role === "user" ? stringifyUserMessage(node) : stringifySystemOrAssistantMessage(node);
}

function stringifySystemOrAssistantMessage(node: ChatNode) {
  const section = document.createElement("section");
  section.dataset.role = node.role;
  const p = document.createElement("p");
  p.textContent = node.content;
  section.append(p);
  return section.outerHTML;
}

async function stringifyUserMessage(node: ChatNode) {
  const section = document.createElement("section");
  section.dataset.role = node.role;
  const p = document.createElement("p");
  p.textContent = node.content;
  section.append(p);

  const imageNodes = (node.images ?? [])?.map((imgData) => {
    const img = document.createElement("img");
    img.src = imgData;
    return img;
  });

  const objectNodes = await Promise.all(
    (node.files ?? [])?.map(async (file) => {
      const object = document.createElement("object");
      object.type = file.type;
      object.data = await fileToBase64DataUrl(file);
      return object;
    })
  );

  section.append(...imageNodes, ...objectNodes);

  return section.outerHTML;
}

async function fileToBase64DataUrl(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function parseChat(raw: string, preserveIds?: string[]): Promise<ChatNode[]> {
  const dom = new DOMParser().parseFromString(raw, "text/html");
  const nodes = [...dom.querySelectorAll<HTMLElement>(`[data-role]`)]
    .map((el) => (el.dataset.role === "user" ? parseUserMessage(el) : parseSystemOrAssistantMessage(el)))
    .map((node, i) => ({ ...node, id: preserveIds?.at(i) ?? node.id }));

  // use the next node id as the current node's childId.
  const linkedNodes = nodes.map((node, i) => ({ ...node, childIds: i < nodes.length - 1 ? [nodes[i + 1].id] : undefined } satisfies ChatNode));

  return await Promise.all(linkedNodes);
}

function parseSystemOrAssistantMessage(node: HTMLElement): ChatNode {
  const content = [...node.querySelectorAll("p")].map((p) => p.textContent).join("\n\n");
  const role = node.dataset.role as "system" | "assistant";
  return { id: crypto.randomUUID(), role, content, isEntry: role === "system" };
}

function parseUserMessage(node: HTMLElement): ChatNode {
  const content = [...node.querySelectorAll("p")].map((p) => p.textContent).join("\n\n");
  return { id: crypto.randomUUID(), role: node.dataset.role as "user", content };
}
