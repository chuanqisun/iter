import { useEffect, useState } from "react";
import type { ChatNode } from "./chat-tree";
/**
 * @returns nodeId -> html preview of markdown text
 */
export function usePreviewStore(nodes: ChatNode[], compile: (input: string) => string | Promise<string>): Record<string, string> {
  const [state, setState] = useState<{ highlighted: Record<string, string>; pending: string[] }>({ highlighted: {}, pending: [] });

  const resolveHighlight = (id: string, highlighted: string) =>
    setState((state) => {
      // if there is no pending, we don't need to do anything
      if (!state.pending.includes(id)) return state;

      const pending = state.pending.filter((pending) => pending !== id);
      return {
        highlighted: {
          ...state.highlighted,
          [id]: highlighted,
        },
        pending,
      };
    });

  const requestHighlights = (nodes: ChatNode[]) =>
    setState((state) => {
      const inputIds = nodes.map((node) => node.id);
      const inputIdSet = new Set(inputIds);
      const highlightSet = new Set(Object.keys(state.highlighted));

      const newPending = inputIdSet.difference(new Set(...state.pending, ...highlightSet));
      newPending.forEach(async (nodeId) => {
        const node = nodes.find((node) => node.id === nodeId);
        if (!node) return;
        resolveHighlight(node.id, await compile(node.content));
      });

      const removedPending = new Set(...state.pending).difference(inputIdSet);
      const removedHighlights = new Set(highlightSet).difference(inputIdSet);

      const highlighted = removedHighlights.size
        ? Object.fromEntries(Object.entries(state.highlighted).filter(([input]) => !removedHighlights.has(input)))
        : state.highlighted;

      return {
        highlighted,
        pending: [...new Set(state.pending).union(newPending).difference(removedPending)],
      };
    });

  useEffect(() => {
    requestHighlights(nodes);
  }, [nodes]);

  return state.highlighted;
}
