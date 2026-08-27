import { useCallback, useEffect, useRef, useState } from "react";
import { trimTrailingEmptyNodes } from "../chat-tree/tree-helper";
import type { ChatNode } from "../chat-tree/tree-store";
import { getActiveCheckpoint, hasCheckpoints, isThreadEmpty, saveCheckpoint } from "./auto-save-service";
import { isAppendingOnCheckpoint } from "./branch-detection";
import { computeThreadFingerprints } from "./fingerprint";
import { restoreCheckpointNodes } from "./restore-service";

export function useAutoSave() {
  const instanceIdRef = useRef<string>(crypto.randomUUID());
  const activeCheckpointIdRef = useRef<string | undefined>(undefined);
  const isSavingRef = useRef<boolean>(false);
  const [hasRecoveryData, setHasRecoveryData] = useState<boolean>(false);

  const refreshRecoveryData = useCallback(async () => {
    try {
      const exists = await hasCheckpoints();
      setHasRecoveryData(exists);
    } catch {
      setHasRecoveryData(false);
    }
  }, []);

  useEffect(() => {
    refreshRecoveryData();
  }, [refreshRecoveryData]);

  const save = useCallback(async (nodes: ChatNode[], forceNewBranch?: boolean): Promise<void> => {
    const trimmedNodes = trimTrailingEmptyNodes(nodes);
    if (isThreadEmpty(trimmedNodes)) return;
    if (isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      const t0 = performance.now();
      const currentFingerprints = await computeThreadFingerprints(trimmedNodes);
      const t1 = performance.now();

      const activeCheckpoint = await getActiveCheckpoint(instanceIdRef.current, activeCheckpointIdRef.current);
      const isAppending = isAppendingOnCheckpoint(activeCheckpoint?.fingerprints, currentFingerprints);
      const t2 = performance.now();

      const isNewBranch = forceNewBranch ?? !isAppending;

      console.log(
        `[auto-save:perf] Fingerprint: ${(t1 - t0).toFixed(2)}ms | Branch check: ${(t2 - t1).toFixed(2)}ms | Result: ${isNewBranch ? "new-branch" : "overwrite"}`,
      );

      const result = await saveCheckpoint(
        instanceIdRef.current,
        activeCheckpointIdRef.current,
        isNewBranch,
        trimmedNodes,
        currentFingerprints,
      );

      if (result?.checkpointId) {
        activeCheckpointIdRef.current = result.checkpointId;
        setHasRecoveryData(true);
      }
    } catch (error) {
      console.error("[auto-save] Failed to save checkpoint:", error);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const restore = useCallback(async (storageKey: string): Promise<ChatNode[]> => {
    const nodes = await restoreCheckpointNodes(storageKey);
    // After restoring a save point, do NOT auto-save the newly restored state
    // until the user submits or AI finishes responding.
    // Active checkpoint for this instance remains unset or resets until user interaction.
    activeCheckpointIdRef.current = undefined;
    return nodes;
  }, []);

  return {
    instanceId: instanceIdRef.current,
    hasRecoveryData,
    save,
    restore,
    refreshRecoveryData,
  };
}
