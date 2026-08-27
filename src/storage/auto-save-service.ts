import { delMany, get, set } from "idb-keyval";
import { isNodeEmpty, trimTrailingEmptyNodes } from "../chat-tree/tree-helper";
import type { ChatNode } from "../chat-tree/tree-store";
import {
  AUTOSAVE_MANIFEST_KEY,
  createEmptyManifest,
  getCheckpointStorageKey,
  recordCheckpointInManifest,
  type AutoSaveManifest,
} from "./auto-save-history";
import { stringifyChat } from "./format";

export function isThreadEmpty(nodes: ChatNode[]): boolean {
  if (!nodes || nodes.length === 0) return true;
  return nodes.every((node) => isNodeEmpty(node));
}

export async function saveCheckpoint(
  instanceId: string,
  currentCheckpointId: string | undefined,
  isNewBranch: boolean,
  nodes: ChatNode[],
  limits?: { maxCheckpoints?: number; maxInstances?: number },
): Promise<{ checkpointId: string } | null> {
  const trimmedNodes = trimTrailingEmptyNodes(nodes);
  if (isThreadEmpty(trimmedNodes)) return null;

  const rawHtml = await stringifyChat(trimmedNodes);
  const currentManifest = (await get<AutoSaveManifest>(AUTOSAVE_MANIFEST_KEY)) ?? createEmptyManifest();

  const pruneResult = recordCheckpointInManifest(currentManifest, {
    instanceId,
    checkpointId: currentCheckpointId,
    isNewBranch,
    limits,
  });

  const checkpointKey = getCheckpointStorageKey(instanceId, pruneResult.activeCheckpointId);

  await set(checkpointKey, rawHtml);
  await set(AUTOSAVE_MANIFEST_KEY, pruneResult.manifest);

  if (pruneResult.evictedStorageKeys.length > 0) {
    await delMany(pruneResult.evictedStorageKeys);
  }

  return { checkpointId: pruneResult.activeCheckpointId };
}

export async function hasCheckpoints(): Promise<boolean> {
  const manifest = await get<AutoSaveManifest>(AUTOSAVE_MANIFEST_KEY);
  return Boolean(manifest?.instances?.some((inst) => inst.checkpoints && inst.checkpoints.length > 0));
}
