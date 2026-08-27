import { useCallback, useState } from "react";
import type { ChatNode } from "./tree-store";

export function findLastUserNodeId(nodes: ChatNode[]): string | null {
  const lastUserNode = [...nodes].reverse().find((n) => n.role === "user") ?? nodes.at(-1);
  return lastUserNode?.id ?? null;
}

export function useAutoFocus(initialTargetNodeId: string | null = null) {
  const [focusTargetNodeId, setFocusTargetNodeId] = useState<string | null>(initialTargetNodeId);

  const focusLastNode = useCallback((nodes: ChatNode[]) => {
    setFocusTargetNodeId(findLastUserNodeId(nodes));
  }, []);

  const handleAutoFocus = useCallback(() => {
    setFocusTargetNodeId(null);
  }, []);

  return {
    focusTargetNodeId,
    focusLastNode,
    handleAutoFocus,
  };
}

export function autoFocusNthInput(index: number) {
  const targetInput = [...document.querySelectorAll<HTMLElement>(".js-focusable")].at(index);
  if (!targetInput) return;

  targetInput.focus();
  targetInput.scrollIntoView();
}
