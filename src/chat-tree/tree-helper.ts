import { BehaviorSubject } from "rxjs";
import type { ChatNode } from "./tree-store";

export const INITIAL_USER_NODE = getUserNode(crypto.randomUUID());
export const INITIAL_SYSTEM_NODE: ChatNode = {
  id: crypto.randomUUID(),
  role: "system",
  content: "",
  isViewSource: true,
  metadata$: new BehaviorSubject({}),
};
export const INITIAL_NODES = [INITIAL_SYSTEM_NODE, INITIAL_USER_NODE];

export function getAssistantNode(id: string, patch?: Partial<Omit<ChatNode, "id">>): ChatNode {
  return {
    id,
    role: "assistant",
    content: "",
    metadata$: new BehaviorSubject({}),
    ...patch,
  };
}

export function getUserNode(id: string, patch?: Partial<Omit<ChatNode, "id">>): ChatNode {
  return {
    id,
    role: "user",
    content: "",
    isViewSource: true,
    metadata$: new BehaviorSubject({}),
    ...patch,
  };
}

export function patchNode(
  predicate: (node: ChatNode, index: number) => boolean,
  patch: Partial<Omit<ChatNode, "id">> | ((node: ChatNode) => Partial<Omit<ChatNode, "id">>),
) {
  return (candidateNode: ChatNode, index: number) => {
    if (predicate(candidateNode, index)) {
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
