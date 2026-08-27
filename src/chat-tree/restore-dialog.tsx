import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutoSaveManifest } from "../storage/auto-save-history";
import { formatTimestampSlug } from "../storage/codec";
import {
  deleteInstance,
  downloadCheckpointFile,
  getCheckpointPreview,
  getManifest,
  type CheckpointPreview,
} from "../storage/restore-service";
import { getRoleIcon } from "./role-metadata";
import "./restore-dialog.css";

export interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (storageKey: string) => Promise<void> | void;
}

export function RestoreDialog({ isOpen, onClose, onRestore }: RestoreDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [manifest, setManifest] = useState<AutoSaveManifest>({ instances: [] });
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0);
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number>(0);
  const [preview, setPreview] = useState<CheckpointPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Load manifest when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    getManifest().then((data) => {
      if (isSubscribed) {
        setManifest(data);
        setSelectedInstanceIndex(0);
        setSelectedCheckpointIndex(0);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  // Sync native dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const currentInstance = useMemo(() => {
    return manifest.instances[selectedInstanceIndex];
  }, [manifest.instances, selectedInstanceIndex]);

  const currentCheckpoint = useMemo(() => {
    return currentInstance?.checkpoints[selectedCheckpointIndex];
  }, [currentInstance, selectedCheckpointIndex]);

  // Fetch preview when currentCheckpoint changes
  useEffect(() => {
    if (!currentCheckpoint) {
      setPreview(null);
      return;
    }

    let isSubscribed = true;
    setLoadingPreview(true);

    getCheckpointPreview(currentCheckpoint.storageKey)
      .then((data) => {
        if (isSubscribed) {
          setPreview(data);
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setLoadingPreview(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentCheckpoint]);

  const handlePrevCheckpoint = useCallback(() => {
    setSelectedCheckpointIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextCheckpoint = useCallback(() => {
    if (!currentInstance) return;
    setSelectedCheckpointIndex((prev) => Math.min(currentInstance.checkpoints.length - 1, prev + 1));
  }, [currentInstance]);

  const handleExport = useCallback(async () => {
    if (!currentCheckpoint) return;
    try {
      const timestamp = formatTimestampSlug(currentCheckpoint.timestamp);
      await downloadCheckpointFile(currentCheckpoint.storageKey, `autosave-${timestamp}.html`);
    } catch (err) {
      console.error("[restore] Failed to download checkpoint file:", err);
    }
  }, [currentCheckpoint]);

  const handleLoad = useCallback(() => {
    if (!currentCheckpoint) return;
    dialogRef.current?.close(currentCheckpoint.storageKey);
  }, [currentCheckpoint]);

  const handleDelete = useCallback(async () => {
    if (!currentInstance) return;
    try {
      const updatedManifest = await deleteInstance(currentInstance.instanceId);
      setManifest(updatedManifest);
      setSelectedInstanceIndex((prev) => Math.max(0, Math.min(prev, updatedManifest.instances.length - 1)));
      setSelectedCheckpointIndex(0);
    } catch (err) {
      console.error("[restore] Failed to delete instance:", err);
    }
  }, [currentInstance]);

  const totalCheckpoints = currentInstance?.checkpoints.length ?? 0;

  return (
    <dialog
      ref={dialogRef}
      className="c-restore-dialog"
      onClose={(e) => {
        const storageKey = e.currentTarget.returnValue;
        e.currentTarget.returnValue = "";
        onClose();
        if (storageKey) {
          onRestore(storageKey);
        }
      }}
      onCancel={() => {
        onClose();
      }}
    >
      {isOpen && (
        <div className="restore-layout">
          <div className="instance-pane">
            <div className="instance-list">
              {manifest.instances.map((instance, index) => {
                const dateStr = new Date(instance.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isSelected = index === selectedInstanceIndex;
                return (
                  <button
                    key={instance.instanceId}
                    type="button"
                    className="instance-item"
                    data-active={isSelected}
                    onClick={() => {
                      setSelectedInstanceIndex(index);
                      setSelectedCheckpointIndex(0);
                    }}
                  >
                    <div className="instance-title">{dateStr}</div>
                    <div className="instance-meta">
                      {instance.checkpoints.length} save point
                      {instance.checkpoints.length !== 1 ? "s" : ""}
                    </div>
                  </button>
                );
              })}
              {manifest.instances.length === 0 && <div className="preview-empty">No saved sessions</div>}
            </div>
          </div>

          <div className="detail-pane">
            <div className="checkpoint-nav">
              <div className="nav-controls">
                <button
                  type="button"
                  onClick={handleNextCheckpoint}
                  disabled={selectedCheckpointIndex >= totalCheckpoints - 1}
                >
                  Older
                </button>
                <button type="button" onClick={handlePrevCheckpoint} disabled={selectedCheckpointIndex <= 0}>
                  Newer
                </button>
                <span className="checkpoint-info">
                  {totalCheckpoints > 0 ? `${selectedCheckpointIndex + 1}/${totalCheckpoints}` : "0/0"}
                </span>
              </div>
              {currentCheckpoint && (
                <div className="checkpoint-info">{new Date(currentCheckpoint.timestamp).toLocaleTimeString()}</div>
              )}
            </div>

            <div className="preview-content">
              {loadingPreview && <div className="preview-empty">Loading preview...</div>}
              {!loadingPreview && (!preview || preview.messages.length === 0) && (
                <div className="preview-empty">No message preview available</div>
              )}
              {!loadingPreview &&
                preview &&
                preview.messages.map((msg, idx) => (
                  <div key={idx} className="preview-message-row">
                    <div className="preview-avatar" title={msg.role}>
                      {getRoleIcon(msg.role)}
                    </div>
                    <div className="preview-message">
                      <div className="message-body">{msg.content || "(empty message)"}</div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="detail-actions">
              <div className="action-group">
                <button type="button" onClick={handleLoad} disabled={!currentCheckpoint}>
                  Load
                </button>
                <button type="button" onClick={handleExport} disabled={!currentCheckpoint}>
                  Export
                </button>
                <button type="button" onClick={() => dialogRef.current?.close()}>
                  Cancel
                </button>
              </div>
              <button type="button" onClick={handleDelete} disabled={!currentInstance}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
