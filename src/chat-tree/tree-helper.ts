import type { ChatNode } from "./tree-store";

export const INITIAL_USER_NODE = getUserNode(crypto.randomUUID());
export const INITIAL_SYSTEM_NODE: ChatNode = {
  id: crypto.randomUUID(),
  role: "system",
  content: "",
};
export const INITIAL_NODES = [INITIAL_SYSTEM_NODE, INITIAL_USER_NODE];

export function getUserNode(id: string): ChatNode {
  return {
    id,
    role: "user",
    content: "",
  };
}

export function patchNode(
  predicate: (node: ChatNode) => boolean,
  patch: Partial<ChatNode> | ((node: ChatNode) => Partial<ChatNode>),
) {
  return (candidateNode: ChatNode) => {
    if (predicate(candidateNode)) {
      const patched = patch instanceof Function ? patch(candidateNode) : patch;
      return { ...candidateNode, ...patched };
    } else {
      return candidateNode;
    }
  };
}

export function getPrevId(currentId: string, nodes: ChatNode[]): string | null {
  const currentIndex = nodes.findIndex((n) => n.id === currentId);
  if (currentIndex > 0) return nodes[currentIndex - 1].id;
  return null;
}

export function getNextId(currentId: string, nodes: ChatNode[]): string | null {
  const currentIndex = nodes.findIndex((n) => n.id === currentId);
  if (currentIndex >= 0 && currentIndex < nodes.length - 1) return nodes[currentIndex + 1].id;
  return null;
}
