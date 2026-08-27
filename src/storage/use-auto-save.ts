import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatNode } from "../chat-tree/tree-store";
import { hasCheckpoints, isThreadEmpty, saveCheckpoint } from "./auto-save-service";
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

  const save = useCallback(async (nodes: ChatNode[], isNewBranch: boolean = false): Promise<void> => {
    if (isThreadEmpty(nodes)) return;
    if (isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      const result = await saveCheckpoint(instanceIdRef.current, activeCheckpointIdRef.current, isNewBranch, nodes);

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
