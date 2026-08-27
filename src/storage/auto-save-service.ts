import { delMany, get, set } from "idb-keyval";
import { isNodeEmpty, trimTrailingEmptyNodes } from "../chat-tree/tree-helper";
import type { ChatNode } from "../chat-tree/tree-store";
import {
  AUTOSAVE_MANIFEST_KEY,
  createEmptyManifest,
  getCheckpointMeta,
  getCheckpointStorageKey,
  recordCheckpointInManifest,
  type AutoSaveCheckpointMeta,
  type AutoSaveManifest,
} from "./auto-save-history";
import { computeThreadFingerprints } from "./fingerprint";
import { stringifyChat } from "./format";

export function isThreadEmpty(nodes: ChatNode[]): boolean {
  return !nodes?.length || nodes.every(isNodeEmpty);
}

export async function getManifest(): Promise<AutoSaveManifest> {
  return (await get<AutoSaveManifest>(AUTOSAVE_MANIFEST_KEY)) ?? createEmptyManifest();
}

export async function getActiveCheckpoint(
  instanceId: string,
  checkpointId: string | undefined,
): Promise<AutoSaveCheckpointMeta | undefined> {
  return checkpointId ? getCheckpointMeta(await getManifest(), instanceId, checkpointId) : undefined;
}

export async function hasCheckpoints(): Promise<boolean> {
  const manifest = await get<AutoSaveManifest>(AUTOSAVE_MANIFEST_KEY);
  return Boolean(manifest?.instances?.some(({ checkpoints }) => checkpoints?.length > 0));
}

export async function saveCheckpoint(
  instanceId: string,
  currentCheckpointId: string | undefined,
  isNewBranch: boolean,
  nodes: ChatNode[],
  fingerprintsOrLimits?: string[] | { maxCheckpoints?: number; maxInstances?: number },
  limitsOption?: { maxCheckpoints?: number; maxInstances?: number },
): Promise<{ checkpointId: string } | null> {
  const trimmedNodes = trimTrailingEmptyNodes(nodes);
  if (isThreadEmpty(trimmedNodes)) return null;

  const fingerprints = Array.isArray(fingerprintsOrLimits) ? fingerprintsOrLimits : undefined;
  const limits = Array.isArray(fingerprintsOrLimits) ? limitsOption : fingerprintsOrLimits;

  const nodeFingerprints = fingerprints ?? (await computeThreadFingerprints(trimmedNodes));
  const rawHtml = await stringifyChat(trimmedNodes);
  const currentManifest = await getManifest();

  const { manifest, activeCheckpointId, evictedStorageKeys } = recordCheckpointInManifest(currentManifest, {
    instanceId,
    checkpointId: currentCheckpointId,
    isNewBranch,
    fingerprints: nodeFingerprints,
    limits,
  });

  const checkpointKey = getCheckpointStorageKey(instanceId, activeCheckpointId);

  await set(checkpointKey, rawHtml);
  await set(AUTOSAVE_MANIFEST_KEY, manifest);

  if (evictedStorageKeys.length > 0) {
    await delMany(evictedStorageKeys);
  }

  return { checkpointId: activeCheckpointId };
}
