export const AUTOSAVE_MANIFEST_KEY = "iter.autosave.manifest";
export const CHECKPOINT_KEY_PREFIX = "iter.checkpoint.";

export const DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE = 10;
export const DEFAULT_MAX_INSTANCES = 10;

export interface AutoSaveCheckpointMeta {
  id: string;
  timestamp: number;
  storageKey: string;
}

export interface AutoSaveInstanceSummary {
  instanceId: string;
  createdAt: number;
  updatedAt: number;
  checkpoints: AutoSaveCheckpointMeta[];
}

export interface AutoSaveManifest {
  instances: AutoSaveInstanceSummary[];
}

export interface RecordCheckpointOptions {
  instanceId: string;
  checkpointId?: string;
  isNewBranch?: boolean;
  limits?: { maxCheckpoints?: number; maxInstances?: number };
}

export interface PruneResult {
  manifest: AutoSaveManifest;
  activeCheckpointId: string;
  evictedStorageKeys: string[];
}

export function getCheckpointStorageKey(instanceId: string, checkpointId: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${instanceId}.${checkpointId}`;
}

export const createEmptyManifest = (): AutoSaveManifest => ({ instances: [] });

export const createCheckpointMeta = (
  instanceId: string,
  id: string = crypto.randomUUID(),
  timestamp: number = Date.now(),
): AutoSaveCheckpointMeta => ({
  id,
  timestamp,
  storageKey: getCheckpointStorageKey(instanceId, id),
});

export function recordCheckpointInManifest(manifest: AutoSaveManifest, options: RecordCheckpointOptions): PruneResult {
  const { instanceId, checkpointId, isNewBranch, limits } = options;
  const now = Date.now();

  const existingInstance = manifest.instances.find((inst) => inst.instanceId === instanceId);
  const otherInstances = manifest.instances.filter((inst) => inst.instanceId !== instanceId);

  const existingCheckpoint =
    !isNewBranch && checkpointId ? existingInstance?.checkpoints.find((cp) => cp.id === checkpointId) : undefined;

  let activeCheckpointId: string;
  let updatedCheckpoints: AutoSaveCheckpointMeta[];

  if (existingCheckpoint) {
    activeCheckpointId = existingCheckpoint.id;
    updatedCheckpoints = (existingInstance?.checkpoints ?? []).map((cp) =>
      cp.id === activeCheckpointId ? { ...cp, timestamp: now } : cp,
    );
  } else {
    const newCheckpoint = createCheckpointMeta(instanceId, existingInstance ? undefined : checkpointId, now);
    activeCheckpointId = newCheckpoint.id;
    updatedCheckpoints = [newCheckpoint, ...(existingInstance?.checkpoints ?? [])];
  }

  const targetInstance: AutoSaveInstanceSummary = {
    instanceId,
    createdAt: existingInstance?.createdAt ?? now,
    updatedAt: now,
    checkpoints: updatedCheckpoints,
  };

  const { manifest: prunedManifest, evictedStorageKeys } = pruneManifest(
    { instances: [targetInstance, ...otherInstances] },
    limits,
  );

  return {
    manifest: prunedManifest,
    activeCheckpointId,
    evictedStorageKeys,
  };
}

export function pruneManifest(
  manifest: AutoSaveManifest,
  limits?: { maxCheckpoints?: number; maxInstances?: number },
): { manifest: AutoSaveManifest; evictedStorageKeys: string[] } {
  const maxCheckpoints = limits?.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE;
  const maxInstances = limits?.maxInstances ?? DEFAULT_MAX_INSTANCES;

  const keptInstances = manifest.instances.slice(0, maxInstances);
  const droppedInstances = manifest.instances.slice(maxInstances);
  const evictedFromDropped = droppedInstances.flatMap((inst) => inst.checkpoints.map((cp) => cp.storageKey));

  const prunedInstances: AutoSaveInstanceSummary[] = [];
  const evictedFromKept: string[] = [];

  for (const instance of keptInstances) {
    const sortedCheckpoints = [...instance.checkpoints].sort((a, b) => b.timestamp - a.timestamp);
    const kept = sortedCheckpoints.slice(0, maxCheckpoints);
    const dropped = sortedCheckpoints.slice(maxCheckpoints);

    evictedFromKept.push(...dropped.map((cp) => cp.storageKey));
    prunedInstances.push({
      ...instance,
      checkpoints: kept,
    });
  }

  return {
    manifest: { instances: prunedInstances },
    evictedStorageKeys: [...evictedFromDropped, ...evictedFromKept],
  };
}

export function removeInstanceFromManifest(
  manifest: AutoSaveManifest,
  instanceId: string,
): { manifest: AutoSaveManifest; evictedStorageKeys: string[] } {
  const targetInstance = manifest.instances.find((inst) => inst.instanceId === instanceId);
  return {
    manifest: { instances: manifest.instances.filter((inst) => inst.instanceId !== instanceId) },
    evictedStorageKeys: targetInstance?.checkpoints.map((cp) => cp.storageKey) ?? [],
  };
}
