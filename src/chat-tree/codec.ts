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
      object.name = file.name;
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
  const nodes = (
    await Promise.all(
      [...dom.querySelectorAll<HTMLElement>(`[data-role]`)].map(async (el) =>
        el.dataset.role === "user" ? await parseUserMessage(el) : parseSystemOrAssistantMessage(el)
      )
    )
  ).map((node, i) => ({ ...node, id: preserveIds?.at(i) ?? node.id }));

  // use the next node id as the current node's childId.
  const linkedNodes = nodes.map((node, i) => ({ ...node, childIds: i < nodes.length - 1 ? [nodes[i + 1].id] : undefined } satisfies ChatNode));

  return linkedNodes;
}

function parseSystemOrAssistantMessage(node: HTMLElement): ChatNode {
  const content = [...node.querySelectorAll("p")].map((p) => p.textContent).join("\n\n");
  const role = node.dataset.role as "system" | "assistant";
  return { id: crypto.randomUUID(), role, content, isEntry: role === "system" };
}

async function parseUserMessage(node: HTMLElement): Promise<ChatNode> {
  const content = [...node.querySelectorAll("p")].map((p) => p.textContent).join("\n\n");
  const images = [...node.querySelectorAll("img")].map((img) => img.src);
  const files: File[] = await Promise.all(
    [...node.querySelectorAll("object")].map((obj) =>
      fetch(obj.data)
        .then((res) => res.blob())
        .then((blob) => new File([blob], obj.name, { type: obj.type }))
    )
  );

  return { id: crypto.randomUUID(), role: node.dataset.role as "user", images, files, content };
}
