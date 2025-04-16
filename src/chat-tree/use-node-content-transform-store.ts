import { useEffect, useState } from "react";
import type { ChatNode } from "./chat-tree";

/** id -> output */
export type OutputMap = Record<string, string>;

/** id -> input */
type InputMap = Record<string, string>;

/**
 * When nodes change, run transform asynchronously and updates the output
 */
export function useNodeContentTransformStore(
  nodes: ChatNode[],
  transform: (input: string) => string | Promise<string>,
): OutputMap {
  // pending stores ids -> input map
  const [state, setState] = useState<{
    outputMap: OutputMap;
    inputMap: InputMap;
  }>({ outputMap: {}, inputMap: {} });

  const resolveHighlight = (id: string, highlighted: string) =>
    setState((state) => {
      // if item is no longer wannted, no-op
      if (state.inputMap[id] === undefined) return state;

      return {
        ...state,
        outputMap: {
          ...state.outputMap,
          [id]: highlighted,
        },
      };
    });

  const requestHighlights = (nodes: ChatNode[]) =>
    setState((state) => {
      const currentIdSet = new Set(nodes.map((node) => node.id));
      const previousIdSet = new Set(Object.keys(state.inputMap));
      const removedIdSet = new Set(previousIdSet).difference(currentIdSet);

      const changedNodes = nodes.filter((node) => {
        const previousInput = state.inputMap[node.id]; // undefined implies new node
        return previousInput !== node.content;
      });

      changedNodes.forEach(async (node) => {
        resolveHighlight(node.id, await transform(node.content));
      });

      // we can only delete here. Updates are made during resolve
      const outputMap = removedIdSet.size
        ? Object.fromEntries(Object.entries(state.outputMap).filter(([id]) => !removedIdSet.has(id)))
        : state.outputMap;

      // reflect changedNodes in status
      const inputMap = changedNodes.length
        ? {
            ...state.inputMap,
            ...Object.fromEntries(changedNodes.map((node) => [node.id, node.content])),
          }
        : state.inputMap;

      return {
        outputMap,
        inputMap,
      };
    });

  useEffect(() => {
    requestHighlights(nodes);
  }, [nodes]);

  return state.outputMap;
}
