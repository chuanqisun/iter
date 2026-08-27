import { describe, expect, it } from "vitest";
import {
  createEmptyManifest,
  DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE,
  DEFAULT_MAX_INSTANCES,
  getCheckpointStorageKey,
  pruneManifest,
  recordCheckpointInManifest,
  removeInstanceFromManifest,
  type AutoSaveManifest,
} from "./auto-save-history";

describe("auto-save-history", () => {
  it("initializes empty manifest", () => {
    const manifest = createEmptyManifest();
    expect(manifest.instances).toEqual([]);
  });

  it("creates first checkpoint for a new instance", () => {
    const manifest = createEmptyManifest();
    const result = recordCheckpointInManifest(manifest, {
      instanceId: "inst-1",
    });

    expect(result.manifest.instances).toHaveLength(1);
    const instance = result.manifest.instances[0];
    expect(instance.instanceId).toBe("inst-1");
    expect(instance.checkpoints).toHaveLength(1);
    expect(instance.checkpoints[0].id).toBe(result.activeCheckpointId);
    expect(instance.checkpoints[0].storageKey).toBe(getCheckpointStorageKey("inst-1", result.activeCheckpointId));
    expect(result.evictedStorageKeys).toEqual([]);
  });

  it("overwrites existing checkpoint by default without key eviction", () => {
    const manifest = createEmptyManifest();
    const res1 = recordCheckpointInManifest(manifest, {
      instanceId: "inst-1",
    });
    const firstCpId = res1.activeCheckpointId;

    const res2 = recordCheckpointInManifest(res1.manifest, {
      instanceId: "inst-1",
      checkpointId: firstCpId,
      isNewBranch: false,
    });

    expect(res2.activeCheckpointId).toBe(firstCpId);
    expect(res2.manifest.instances).toHaveLength(1);
    expect(res2.manifest.instances[0].checkpoints).toHaveLength(1);
    expect(res2.manifest.instances[0].checkpoints[0].id).toBe(firstCpId);
    expect(res2.evictedStorageKeys).toEqual([]);
  });

  it("creates a new checkpoint when branching", () => {
    const manifest = createEmptyManifest();
    const res1 = recordCheckpointInManifest(manifest, {
      instanceId: "inst-1",
    });
    const firstCpId = res1.activeCheckpointId;

    const res2 = recordCheckpointInManifest(res1.manifest, {
      instanceId: "inst-1",
      checkpointId: firstCpId,
      isNewBranch: true,
    });

    expect(res2.activeCheckpointId).not.toBe(firstCpId);
    expect(res2.manifest.instances[0].checkpoints).toHaveLength(2);
    expect(res2.manifest.instances[0].checkpoints[0].id).toBe(res2.activeCheckpointId);
    expect(res2.manifest.instances[0].checkpoints[1].id).toBe(firstCpId);
    expect(res2.evictedStorageKeys).toEqual([]);
  });

  it("bumps modified instance to the top", () => {
    let manifest = createEmptyManifest();
    manifest = recordCheckpointInManifest(manifest, { instanceId: "inst-1" }).manifest;
    manifest = recordCheckpointInManifest(manifest, { instanceId: "inst-2" }).manifest;

    expect(manifest.instances.map((i) => i.instanceId)).toEqual(["inst-2", "inst-1"]);

    manifest = recordCheckpointInManifest(manifest, { instanceId: "inst-1" }).manifest;
    expect(manifest.instances.map((i) => i.instanceId)).toEqual(["inst-1", "inst-2"]);
  });

  it("prunes checkpoints beyond limit K and collects evicted keys", () => {
    const maxK = 3;
    let manifest = createEmptyManifest();
    const checkpointIds: string[] = [];

    for (let i = 0; i < maxK + 2; i++) {
      const res = recordCheckpointInManifest(manifest, {
        instanceId: "inst-1",
        isNewBranch: true,
        limits: { maxCheckpoints: maxK, maxInstances: DEFAULT_MAX_INSTANCES },
      });
      manifest = res.manifest;
      checkpointIds.push(res.activeCheckpointId);
    }

    const instance = manifest.instances[0];
    expect(instance.checkpoints).toHaveLength(maxK);
    // Oldest checkpoints (index 0 and 1) should have been evicted
    const currentCpIds = instance.checkpoints.map((cp) => cp.id);
    expect(currentCpIds).toEqual([checkpointIds[4], checkpointIds[3], checkpointIds[2]]);

    // Test pruneManifest directly for evicted keys
    const pruned = pruneManifest(
      {
        instances: [
          {
            instanceId: "inst-1",
            createdAt: 100,
            updatedAt: 500,
            checkpoints: checkpointIds.map((id, index) => ({
              id,
              timestamp: 100 + index,
              storageKey: getCheckpointStorageKey("inst-1", id),
            })),
          },
        ],
      },
      { maxCheckpoints: maxK, maxInstances: DEFAULT_MAX_INSTANCES },
    );

    expect(pruned.manifest.instances[0].checkpoints).toHaveLength(maxK);
    expect(pruned.evictedStorageKeys).toEqual([
      getCheckpointStorageKey("inst-1", checkpointIds[1]),
      getCheckpointStorageKey("inst-1", checkpointIds[0]),
    ]);
  });

  it("prunes instances beyond limit P and collects all evicted checkpoint keys", () => {
    const maxP = 2;
    let manifest = createEmptyManifest();

    for (let i = 1; i <= 4; i++) {
      const res = recordCheckpointInManifest(manifest, {
        instanceId: `inst-${i}`,
        limits: { maxCheckpoints: DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE, maxInstances: maxP },
      });
      manifest = res.manifest;
    }

    expect(manifest.instances).toHaveLength(maxP);
    expect(manifest.instances.map((i) => i.instanceId)).toEqual(["inst-4", "inst-3"]);
  });

  it("supports dynamic limit changes cleanly without breaking format", () => {
    let manifest = createEmptyManifest();

    for (let i = 1; i <= 5; i++) {
      manifest = recordCheckpointInManifest(manifest, {
        instanceId: `inst-${i}`,
        limits: { maxCheckpoints: DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE, maxInstances: 5 },
      }).manifest;
    }
    expect(manifest.instances).toHaveLength(5);

    // Now dynamically reduce limit P to 2
    const pruned = pruneManifest(manifest, {
      maxCheckpoints: DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE,
      maxInstances: 2,
    });
    expect(pruned.manifest.instances).toHaveLength(2);
    expect(pruned.evictedStorageKeys).toHaveLength(3); // 3 evicted instances * 1 checkpoint each
  });

  it("removes an instance and evicts its storage keys", () => {
    let manifest: AutoSaveManifest = {
      instances: [
        {
          instanceId: "inst-1",
          createdAt: 100,
          updatedAt: 200,
          checkpoints: [
            { id: "cp-1", timestamp: 200, storageKey: getCheckpointStorageKey("inst-1", "cp-1") },
            { id: "cp-2", timestamp: 100, storageKey: getCheckpointStorageKey("inst-1", "cp-2") },
          ],
        },
        {
          instanceId: "inst-2",
          createdAt: 300,
          updatedAt: 300,
          checkpoints: [{ id: "cp-3", timestamp: 300, storageKey: getCheckpointStorageKey("inst-2", "cp-3") }],
        },
      ],
    };

    const res = removeInstanceFromManifest(manifest, "inst-1");
    expect(res.manifest.instances.map((i) => i.instanceId)).toEqual(["inst-2"]);
    expect(res.evictedStorageKeys).toEqual([
      getCheckpointStorageKey("inst-1", "cp-1"),
      getCheckpointStorageKey("inst-1", "cp-2"),
    ]);
  });
});
