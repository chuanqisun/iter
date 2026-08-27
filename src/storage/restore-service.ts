import { delMany, get, set } from "idb-keyval";
import { ensureTrailingUserNode } from "../chat-tree/tree-helper";
import type { ChatNode } from "../chat-tree/tree-store";
import {
  AUTOSAVE_MANIFEST_KEY,
  createEmptyManifest,
  removeInstanceFromManifest,
  type AutoSaveManifest,
} from "./auto-save-history";
import { parseChat } from "./format";
import { downloadFile } from "./use-file-hooks";

export interface CheckpointPreviewMessage {
  role: string;
  content: string;
}

export interface CheckpointPreview {
  messages: CheckpointPreviewMessage[];
}

export async function getManifest(): Promise<AutoSaveManifest> {
  const manifest = await get<AutoSaveManifest>(AUTOSAVE_MANIFEST_KEY);
  return manifest ?? createEmptyManifest();
}

export async function getCheckpointRaw(storageKey: string): Promise<string | undefined> {
  return await get<string | undefined>(storageKey);
}

export async function getCheckpointPreview(storageKey: string): Promise<CheckpointPreview> {
  const raw = await getCheckpointRaw(storageKey);
  if (!raw) {
    return { messages: [] };
  }

  const dom = new DOMParser().parseFromString(raw, "text/html");
  const sections = [...dom.querySelectorAll<HTMLElement>("[data-role]")];

  const messages = sections.map((sec) => {
    const role = sec.dataset.role || sec.getAttribute("data-role") || "user";
    const paragraphs = [...sec.querySelectorAll("p")];
    const content = paragraphs.map((p) => p.textContent ?? "").join("\n\n");
    return { role, content };
  });

  return { messages };
}

export async function downloadCheckpointFile(storageKey: string, filename?: string): Promise<void> {
  const raw = await getCheckpointRaw(storageKey);
  if (!raw) {
    throw new Error(`Checkpoint not found for storage key: ${storageKey}`);
  }

  const cleanName = filename ?? `checkpoint-${Date.now()}.html`;
  const file = new File([raw], cleanName, { type: "text/html" });
  downloadFile(file);
}

export async function restoreCheckpointNodes(storageKey: string): Promise<ChatNode[]> {
  const raw = await getCheckpointRaw(storageKey);
  if (!raw) {
    throw new Error(`Checkpoint not found for storage key: ${storageKey}`);
  }

  const nodes = await parseChat(raw);
  return ensureTrailingUserNode(nodes);
}

export async function deleteInstance(instanceId: string): Promise<AutoSaveManifest> {
  const currentManifest = await getManifest();
  const { manifest: updatedManifest, evictedStorageKeys } = removeInstanceFromManifest(currentManifest, instanceId);

  await set(AUTOSAVE_MANIFEST_KEY, updatedManifest);
  if (evictedStorageKeys.length > 0) {
    await delMany(evictedStorageKeys);
  }

  return updatedManifest;
}
