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

export function createEmptyManifest(): AutoSaveManifest {
  return { instances: [] };
}

export function recordCheckpointInManifest(manifest: AutoSaveManifest, options: RecordCheckpointOptions): PruneResult {
  const maxCheckpoints = options.limits?.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE;
  const maxInstances = options.limits?.maxInstances ?? DEFAULT_MAX_INSTANCES;
  const now = Date.now();

  const existingInstanceIndex = manifest.instances.findIndex((inst) => inst.instanceId === options.instanceId);

  let activeCheckpointId: string;
  let targetInstance: AutoSaveInstanceSummary;
  const otherInstances = manifest.instances.filter((inst) => inst.instanceId !== options.instanceId);

  if (existingInstanceIndex === -1) {
    activeCheckpointId = options.checkpointId ?? crypto.randomUUID();
    const newCheckpoint: AutoSaveCheckpointMeta = {
      id: activeCheckpointId,
      timestamp: now,
      storageKey: getCheckpointStorageKey(options.instanceId, activeCheckpointId),
    };
    targetInstance = {
      instanceId: options.instanceId,
      createdAt: now,
      updatedAt: now,
      checkpoints: [newCheckpoint],
    };
  } else {
    const existingInstance = manifest.instances[existingInstanceIndex];
    const isBranch = Boolean(options.isNewBranch);
    const existingCheckpoint = options.checkpointId
      ? existingInstance.checkpoints.find((cp) => cp.id === options.checkpointId)
      : undefined;

    if (!isBranch && existingCheckpoint) {
      activeCheckpointId = existingCheckpoint.id;
      const updatedCheckpoints = existingInstance.checkpoints.map((cp) =>
        cp.id === activeCheckpointId ? { ...cp, timestamp: now } : cp,
      );
      targetInstance = {
        ...existingInstance,
        updatedAt: now,
        checkpoints: updatedCheckpoints,
      };
    } else {
      activeCheckpointId = crypto.randomUUID();
      const newCheckpoint: AutoSaveCheckpointMeta = {
        id: activeCheckpointId,
        timestamp: now,
        storageKey: getCheckpointStorageKey(options.instanceId, activeCheckpointId),
      };
      targetInstance = {
        ...existingInstance,
        updatedAt: now,
        checkpoints: [newCheckpoint, ...existingInstance.checkpoints],
      };
    }
  }

  // Active instance is bumped to the top
  const unprunedManifest: AutoSaveManifest = {
    instances: [targetInstance, ...otherInstances],
  };

  const { manifest: prunedManifest, evictedStorageKeys } = pruneManifest(unprunedManifest, {
    maxCheckpoints,
    maxInstances,
  });

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
  const evictedStorageKeys: string[] = [];

  const prunedInstances: AutoSaveInstanceSummary[] = [];

  manifest.instances.forEach((instance, index) => {
    if (index >= maxInstances) {
      // Entire instance is evicted
      for (const cp of instance.checkpoints) {
        evictedStorageKeys.push(cp.storageKey);
      }
      return;
    }

    // Sort checkpoints newest first
    const sortedCheckpoints = [...instance.checkpoints].sort((a, b) => b.timestamp - a.timestamp);
    const keptCheckpoints = sortedCheckpoints.slice(0, maxCheckpoints);
    const droppedCheckpoints = sortedCheckpoints.slice(maxCheckpoints);

    for (const cp of droppedCheckpoints) {
      evictedStorageKeys.push(cp.storageKey);
    }

    prunedInstances.push({
      ...instance,
      checkpoints: keptCheckpoints,
    });
  });

  return {
    manifest: {
      instances: prunedInstances,
    },
    evictedStorageKeys,
  };
}

export function removeInstanceFromManifest(
  manifest: AutoSaveManifest,
  instanceId: string,
): { manifest: AutoSaveManifest; evictedStorageKeys: string[] } {
  const evictedStorageKeys: string[] = [];
  const instances: AutoSaveInstanceSummary[] = [];

  for (const inst of manifest.instances) {
    if (inst.instanceId === instanceId) {
      for (const cp of inst.checkpoints) {
        evictedStorageKeys.push(cp.storageKey);
      }
    } else {
      instances.push(inst);
    }
  }

  return {
    manifest: { instances },
    evictedStorageKeys,
  };
}
