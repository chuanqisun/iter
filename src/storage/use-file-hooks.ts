import { get, set } from "idb-keyval";
import { useCallback } from "react";
import type { ChatNode } from "../chat-tree/chat-tree";
import { parseChat, stringifyChat } from "./codec";

export function useFileHooks(treeNodes: ChatNode[], setTreeNodes: (value: React.SetStateAction<ChatNode[]>) => void) {
  const saveChat = useCallback(async () => {
    const raw = await stringifyChat(treeNodes);
    await set("iter.draft", raw);
    console.log(`[file] saved`);
  }, [treeNodes]);

  const exportChat = useCallback(async () => {
    const raw = await stringifyChat(treeNodes);

    const timestamp = new Date()
      .toISOString()
      .split(".")[0]
      .replace(/[-T:.]/g, "");
    const htmlFile = new File([raw], `iter-${timestamp}`, { type: "text/html" });
    downloadFile(htmlFile);
    console.log(`[file] exported`);
    return htmlFile;
  }, [treeNodes]);

  const loadChat = useCallback(async () => {
    const raw = await get<string | undefined>("iter.draft");
    if (!raw) {
      console.log(`[file] No draft found`);
      return;
    }

    const tree = await parseChat(
      raw,
      treeNodes.slice(0, 2).map((i) => i.id)
    );
    console.log(`[file] loaded`, tree);

    setTreeNodes(() => tree);
  }, []);

  const importChat = useCallback(async () => {
    const uploadedFile = (await uploadFiles()).at(0);
    if (!uploadedFile) throw new Error("No file uploaded");
    const tree = await parseChat(
      await uploadedFile.text(),
      treeNodes.slice(0, 2).map((i) => i.id)
    );

    if (tree.length < 2) throw new Error("Invalid chat file");
    console.log(`[file] imported`, tree);
    setTreeNodes(() => tree);
    return uploadedFile;
  }, []);

  return { saveChat, exportChat, loadChat, importChat };
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function uploadFiles(options?: { multiple?: boolean }): Promise<File[]> {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = options?.multiple ?? false;
  input.click();
  return new Promise((resolve) => (input.onchange = () => resolve([...(input.files ?? [])])));
}
