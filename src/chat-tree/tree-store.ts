import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { BehaviorSubject, map, scan, Subject } from "rxjs";

export interface ChatNode {
  id: string;
  /** Not implemented */
  order?: number;
  role: "system" | "user" | "assistant";
  content: string;
  parts?: ChatPart[];
  files?: File[]; // Files for interpreter
  isViewSource?: boolean;
  isListening?: boolean;
  isCollapsed?: boolean;
  abortController?: AbortController;
  errorMessage?: string;
}

export interface ChatPart {
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface NodeChange {
  /** If put and remove both exist, put persist */
  putNodes?: ChatNode[];
  /** If the ID doesn't exist, the effect will be ignored */
  removeNodes?: string[];
}

interface CreateStoreOptions {
  initialNodes?: ChatNode[];
}
function createStore(options?: CreateStoreOptions) {
  const treeNodeChanges$ = new Subject<NodeChange>();
  const treeNodes$ = new BehaviorSubject<ChatNode[]>(options?.initialNodes ?? []);

  treeNodeChanges$
    .pipe(
      scan((acc, change) => {
        let result = acc;

        if (change.removeNodes) {
          const removeIds = new Set(change.removeNodes);
          result = acc.filter((node) => !removeIds.has(node.id));
        }

        if (change.putNodes) {
          const putIds = new Set(change.putNodes.map((node) => node.id));
          const remainingNodes = result.filter((node) => !putIds.has(node.id));
          const allNodes = [...remainingNodes, ...change.putNodes];
          result = allNodes;
        }

        return result;
      }, [] as ChatNode[]),
      map((nodes) => nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))),
    )
    .subscribe(treeNodes$);

  function setTreeNodes(updateFn: (previousNodes: ChatNode[]) => ChatNode[]) {
    const currentNodes = treeNodes$.getValue();
    const currentIds = new Set(currentNodes.map((node) => node.id));
    const remainingNodes = updateFn(currentNodes);
    const remainingIds = new Set(remainingNodes.map((node) => node.id));
    const removeIds = currentIds.difference(remainingIds);
    treeNodeChanges$.next({ putNodes: remainingNodes, removeNodes: [...removeIds] });
  }

  return {
    treeNodes$,
    setTreeNodes,
  };
}

export interface TreeNodesOptions {
  initialNodes?: ChatNode[];
}

export function useTreeNodes(options?: TreeNodesOptions) {
  const [store] = useState(() => createStore({ initialNodes: options?.initialNodes }));
  const [treeNodes, setTreeNodesInternal] = useState<ChatNode[]>(() => store.treeNodes$.getValue());

  useEffect(() => {
    const sub = store.treeNodes$.subscribe(setTreeNodesInternal);
    return () => sub.unsubscribe();
  }, []);

  const setTreeNodes = useCallback<Dispatch<SetStateAction<ChatNode[]>>>((valueOrFunc) => {
    if (valueOrFunc instanceof Function) {
      store.setTreeNodes(valueOrFunc);
    } else {
      store.setTreeNodes(() => valueOrFunc);
    }
  }, []);

  return {
    treeNodes,
    setTreeNodes,
  };
}
