import React, { useCallback, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useArtifactActions } from "../artifact/artifact";
import { getFileAccessPostscript, respondFileAccess, respondFileList } from "../artifact/lib/file-access";
import type { CodeEditorElement } from "../code-editor/code-editor-element";
import { type GenericMessage } from "../providers/base";
import { useRouteCache } from "../router/use-route-cache";
import { useRouteParameter } from "../router/use-route-parameter";
import { useConnections } from "../settings/use-connections";
import { showToast } from "../shell/toast";
import { textToDataUrl } from "../storage/codec";
import { uploadFiles, useFileHooks } from "../storage/use-file-hooks";
import { speech, type WebSpeechResult } from "../voice/speech-recognition";
import { ChatConfigMemo } from "./chat-config";
import { setChatInstance } from "./chat-instance";
import { ChatNodeMemo } from "./chat-node";
import { getParts } from "./clipboard";
import { dictateToTextarea } from "./dictation";
import { getReadableFileSize } from "./file-size";
import { autoFocusNthInput } from "./focus";
import { getCombo } from "./keyboard";
import { getAssistantNode, getNextId, getPrevId, getUserNode, INITIAL_NODES, patchNode } from "./tree-helper";
import { useTreeNodes, type ChatNode } from "./tree-store";

export function ChatTree() {
  const { treeNodes, setTreeNodes, treeNodes$, createWriter } = useTreeNodes({ initialNodes: INITIAL_NODES });
  const treeRootRef = useRef<HTMLDivElement>(null);
  const { connections, getChatStreamProxy } = useConnections();
  const { saveChat, exportChat, loadChat, importChat } = useFileHooks(treeNodes, setTreeNodes);

  const handleConnectionsButtonClick = useCallback(
    () => document.querySelector("settings-element")?.closest("dialog")?.showModal(),
    [],
  );

  const connectionKey = useRouteParameter({
    name: "connection",
    initial: null as null | string,
    encode: String,
    decode: String,
  });
  const temperature = useRouteParameter({
    name: "temperature",
    initial: 0,
    encode: String,
    decode: Number,
  });
  const maxTokens = useRouteParameter({
    name: "max_tokens",
    initial: 200,
    encode: String,
    decode: Number,
  });

  useArtifactActions();
  useRouteCache({ parameters: ["connection", "temperature", "max_tokens"] });

  const chat = useCallback(
    (messages: GenericMessage[], abortSignal?: AbortSignal) => {
      const chatStreamProxy = getChatStreamProxy?.(connectionKey.value ?? "");
      if (!chatStreamProxy) throw new Error(`API connection is not set up`);

      return chatStreamProxy({
        temperature: temperature.value,
        maxTokens: maxTokens.value,
        messages,
        abortSignal,
      });
    },
    [connectionKey.value, getChatStreamProxy, temperature.value, maxTokens.value],
  );

  const groupedConnections = useMemo(() => {
    return Object.entries(Object.groupBy(connections, (connection) => connection.displayGroup));
  }, [connections]);

  // expose latest chatStreamingProxy to web components
  useEffect(() => {
    const chatStreamProxy = getChatStreamProxy?.(connectionKey.value ?? "");
    if (!chatStreamProxy) return;

    setChatInstance(chatStreamProxy);
  }, [connectionKey]);

  // auto resolve mistached connectionKey
  useEffect(() => {
    // already matched, no op
    if (connectionKey.value && connections?.some((connection) => connection.id === connectionKey.value)) return;

    // once every connection is loaded, update connectionKey if it is not present
    const defaultConnection = connections.at(0); // auto load firt connection
    if (!defaultConnection) return;
    connectionKey.replace(defaultConnection.id);
  }, [connectionKey.value, connectionKey.replace, connections]);

  // Speech to text
  useEffect(() => {
    const onResult = (e: Event) => {
      const dictationTarget = document.activeElement as HTMLTextAreaElement;

      if (dictationTarget.tagName === "TEXTAREA") {
        // Textarea for System/User message
        // Textarea for Inline chat
        const { fullText } = dictateToTextarea(dictationTarget, (e as CustomEvent<WebSpeechResult>).detail);

        // System/User message
        if (dictationTarget.matches(".js-focusable")) {
          handleTextChange(dictationTarget.id, fullText);
        }
      } else {
        // code-editor-element
        const codeEditor = dictationTarget?.closest<CodeEditorElement>("code-editor-element");
        if (!codeEditor) return;

        codeEditor.appendSpeech((e as CustomEvent<WebSpeechResult>).detail);
      }
    };

    speech.addEventListener("result", onResult);

    return () => speech.removeEventListener("result", onResult);
  }, []);

  // global keyboard
  useEffect(() => {
    const abortController = new AbortController();

    const passthroughtBrowserNativeKey = async (e: KeyboardEvent) => {
      const combo = getCombo(e);
      switch (combo) {
        case "ctrl+shift+k":
          e.stopPropagation();
          return;
      }
    };

    const handleGlobalKeydown = async (e: KeyboardEvent) => {
      const combo = getCombo(e);
      let matched = true;
      switch (combo) {
        case "ctrl+s":
          saveChat()
            .then(() => showToast("✅ Saved"))
            .catch((e) => showToast(`❌ Error ${e?.message}`));
          break;
        case "ctrl+shift+e":
        case "ctrl+shift+s":
          exportChat()
            .then((file) => showToast(`✅ Exported ${file.name} (${getReadableFileSize(file.size)})`))
            .catch((e) => showToast(`❌ Error ${e?.message}`));
          break;
        case "ctrl+o":
          loadChat()
            .then(() => autoFocusNthInput(0))
            .then(() => showToast("✅ Loaded"))
            .catch((e) => showToast(`❌ Error ${e?.message}`));
          break;
        case "ctrl+shift+o":
          importChat()
            .then((file) => showToast(`✅ Imported ${file.name} ${getReadableFileSize(file.size)}`))
            .then(() => autoFocusNthInput(0))
            .catch((e) => showToast(`❌ Error ${e?.message}`));
          break;

        // Hold Shift + Space to talk
        case "shift+space":
          e.preventDefault();
          if (!speech.start()) return;

          const targetElement = document.activeElement as HTMLTextAreaElement;
          if (targetElement) {
            targetElement.toggleAttribute("data-speaking", true);
          }
          break;

        default:
          matched = false;
      }

      if (matched) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleGlobalKeyup = async (e: KeyboardEvent) => {
      const combo = getCombo(e);
      let matched = true;
      switch (combo) {
        // In case user releases Shift first
        case "shift": {
          const targetElement = document.activeElement as HTMLTextAreaElement;
          if (targetElement.hasAttribute("data-speaking")) {
            targetElement.toggleAttribute("data-speaking", false);
            speech.stop();
          }
          // Do NOT match. We want to continue processing shift keyup
          break;
        }

        // Hold Shift + Space to talk
        case "shift+space": {
          e.preventDefault();

          speech.stop();

          const targetElement = document.activeElement as HTMLTextAreaElement;
          if (targetElement) {
            targetElement.toggleAttribute("data-speaking", false);
          }
          break;
        }

        default:
          matched = false;
      }

      if (matched) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown, {
      capture: true,
      signal: abortController.signal,
    });
    window.addEventListener("keydown", passthroughtBrowserNativeKey, {
      capture: true,
      signal: abortController.signal,
    });
    window.addEventListener("keyup", handleGlobalKeyup, {
      capture: true,
      signal: abortController.signal,
    });

    return () => abortController.abort();
  }, [exportChat, importChat]);

  // expose file access api
  useEffect(() => {
    const handleIframeFileAccessRequest = (event: MessageEvent<any>) => {
      const allFiles = treeNodes$.value.flatMap((node) => node.files ?? []);

      // use reverse to keep the last file
      const latestFileMap = new Map(
        allFiles
          .reverse()
          .filter((file, index, self) => self.findIndex((f) => f.name === file.name) === index)
          .reverse()
          .map((file) => [file.name, file]),
      );

      respondFileAccess((filename) => latestFileMap.get(filename), event);
      respondFileList(() => [...latestFileMap.values()], event);
    };

    window.addEventListener("message", handleIframeFileAccessRequest);

    return () => window.removeEventListener("message", handleIframeFileAccessRequest);
  }, []);

  // auto focus last textarea on startup
  useEffect(() => {
    autoFocusNthInput(-1);
  }, []);

  const handleTextChange = useCallback((nodeId: string, content: string) => {
    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { content })));
  }, []);

  const handleCodeBlockChange = useCallback((nodeId: string, code: string, blockIndex: number) => {
    const multilineTrippleTickCodeBlockPattern = /```.*\n([\s\S]*?)\n```/g;

    const replaceNthMatch = (str: string, regex: RegExp, replacement: string, n: number) => {
      let i = -1;
      return str.replace(regex, (match, group1) => {
        i++;
        if (i === n) {
          return match.replace(group1, replacement);
        }
        return match;
      });
    };

    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => {
            const replaced = replaceNthMatch(node.content, multilineTrippleTickCodeBlockPattern, code, blockIndex);
            return { content: replaced };
          },
        ),
      ),
    );
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    handleAbort(nodeId);

    // if delete root: only clear its content
    if (treeNodes$.value[0].id === nodeId) {
      setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { content: "" })));
      return;
    }

    setTreeNodes((nodes) => {
      const targetIndex = nodes.findIndex((n) => n.id === nodeId);
      if (targetIndex === -1) return nodes;
      const newNodes = nodes.filter((n) => n.id !== nodeId);

      // If last node is not user, append a user node
      if (newNodes.length && newNodes[newNodes.length - 1].role !== "user") {
        const newUserNode = getUserNode(crypto.randomUUID());
        return [...newNodes, newUserNode];
      }
      return newNodes;
    });
  }, []);

  const handleDeleteBelow = useCallback((nodeId: string) => {
    setTreeNodes((nodes) => {
      const targetIndex = nodes.findIndex((n) => n.id === nodeId);
      if (targetIndex === -1) return nodes;
      const newNodes = nodes.slice(0, targetIndex + 1);

      // Ensure last node is user
      if (newNodes.length && newNodes[newNodes.length - 1].role !== "user") {
        const newUserNode = getUserNode(crypto.randomUUID());
        return [...newNodes, newUserNode];
      }
      return newNodes;
    });
  }, []);

  const getMessageChain = useCallback((id: string) => {
    const targetIndex = treeNodes$.value.findIndex((n) => n.id === id);
    if (targetIndex === -1) return [];
    return treeNodes$.value
      .slice(0, targetIndex + 1)
      .map((node) => {
        const filePostScript = getFileAccessPostscript(node.files ?? []);
        const rawContentDataUrl = textToDataUrl(`${node.content}${filePostScript}`);

        const message: GenericMessage = {
          role: node.role,
          content: [
            ...(node.parts ?? []).map((part) => ({
              name: part.name,
              type: part.type as any,
              url: part.url,
            })),
            ...(node.content ? ([{ type: "text/plain", url: rawContentDataUrl }] as const) : []),
          ],
        };

        return message;
      })
      .filter((message) => message.content.length);
  }, []);

  const handleAbortSensible = useCallback((nodeId: string) => {
    const isTargetNodeAbortable = treeNodes$.value.find((node) => node.id === nodeId)?.abortController;
    if (!isTargetNodeAbortable) handleAbortAll();
    else handleAbort(nodeId);
  }, []);

  const handleAbortAll = useCallback(() => {
    setTreeNodes((nodes) =>
      nodes.map((node) => {
        if (node?.abortController) {
          node.abortController.abort();
          return { ...node, abortController: undefined };
        }
        return node;
      }),
    );
  }, []);

  const handleAbort = useCallback((nodeId: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => {
            if (!node?.abortController) return {};
            node.abortController.abort();

            return { abortController: undefined };
          },
        ),
      ),
    );
  }, []);

  // Nearest user message that can be submitted/stopped
  const getActiveUserNodeId = useCallback((currentNode?: ChatNode) => {
    let activeUserNodeId: string | null = null;
    if (currentNode?.role === "system") {
      activeUserNodeId = treeNodes$.value.at(1)?.id ?? null;
    } else if (currentNode?.role === "user") {
      activeUserNodeId = currentNode.id;
    }
    return activeUserNodeId;
  }, []);

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      const targetNode = treeNodes$.value.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const activeUserNodeId = getActiveUserNodeId(treeNodes$.value.find((node) => node.id === nodeId));
      if (!activeUserNodeId) return;

      const messages = getMessageChain(activeUserNodeId);

      const abortController = new AbortController();

      handleAbortAll();

      const newAssistantNode = getAssistantNode(crypto.randomUUID(), { abortController });
      const newUserNode = getUserNode(crypto.randomUUID());

      setTreeNodes((nodes) => {
        const activeUserNodeIndex = nodes.findIndex((n) => n.id === activeUserNodeId);
        if (activeUserNodeIndex === -1) return nodes;

        // Remove all nodes after activeUserNodeId
        const base = nodes.slice(0, activeUserNodeIndex + 1);
        return [...base, newAssistantNode, newUserNode];
      });

      try {
        const stream = chat(messages, abortController.signal);
        const writer = createWriter(newAssistantNode.id);

        try {
          for await (const item of stream) writer.write(item);
        } finally {
          writer.close();
        }

        // mark as done
        setTreeNodes((nodes) =>
          nodes.map((n) => (n.id === newAssistantNode.id ? { ...n, abortController: undefined } : n)),
        );
      } catch (e: any) {
        setTreeNodes((nodes) =>
          nodes.map((node) =>
            node.id === newAssistantNode.id
              ? { ...node, abortController: undefined, errorMessage: `${e?.name} ${(e as any).message}` } // Mark assistant node as error
              : node,
          ),
        );
      }
    },
    [chat, getMessageChain],
  );

  const handleKeydown = useCallback(
    async (nodeId: string, e: React.KeyboardEvent<HTMLElement>) => {
      const targetNode = treeNodes$.value.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const combo = getCombo(e as any as KeyboardEvent);

      const activeUserNodeId = getActiveUserNodeId(targetNode);

      if (combo === "escape") {
        if (!activeUserNodeId) return;
        e.preventDefault();
        handleAbortSensible(activeUserNodeId);
      }

      // Enter to activate edit mode
      if (targetNode.role === "assistant" && combo === "enter") {
        // Enter the entire message
        if ((e.target as HTMLElement).classList.contains("js-focusable")) {
          setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { isViewSource: true })));
        }

        // Enter a code block
        if ((e.target as HTMLElement).closest("artifact-source")) {
          (e.target as HTMLElement)
            .closest("artifact-element")
            ?.querySelector<HTMLButtonElement>(`[data-action="edit"]`)
            ?.click();
        }
        return;
      }

      // up/down arrow
      let targetId: null | string = null;
      if ((e.target as HTMLElement).tagName === "TEXTAREA") {
        if (combo === "arrowup" || combo === "arrowdown") {
          const textarea = e.target as HTMLTextAreaElement;

          if (
            combo === "arrowup" &&
            textarea.selectionStart === 0 &&
            (textarea.selectionEnd === 0 || textarea.selectionEnd === textarea.value.length)
          ) {
            e.preventDefault();
            targetId = getPrevId(nodeId, treeNodes$.value);
          } else if (
            combo === "arrowdown" &&
            (textarea.selectionStart === 0 || textarea.selectionStart === textarea.value.length) &&
            textarea.selectionEnd === textarea.value.length
          ) {
            e.preventDefault();
            targetId = getNextId(nodeId, treeNodes$.value);
          }
        }
      } else if ((e.target as HTMLElement).classList.contains("js-focusable")) {
        if (combo === "arrowup") {
          e.preventDefault();
          targetId = getPrevId(nodeId, treeNodes$.value);
        } else if (combo === "arrowdown") {
          e.preventDefault();
          targetId = getNextId(nodeId, treeNodes$.value);
        }
      }

      if (targetId) {
        const targetElement = document.getElementById(targetId) as HTMLTextAreaElement | null;
        targetElement?.focus();
      }

      // submit message
      if (combo === "ctrl+enter") {
        if (!activeUserNodeId) return;
        e.preventDefault();
        handleRunNode(activeUserNodeId);
      }
    },
    [handleRunNode],
  );

  const handlePaste = useCallback(async (nodeId: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const activeUserNodeId = getActiveUserNodeId(treeNodes$.value.find((node) => node.id === nodeId));
    if (!activeUserNodeId) return;

    // if has files, prevent default
    if (e.clipboardData?.files.length) e.preventDefault();

    const parts = await getParts(e.clipboardData);
    if (!parts.length) return;

    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === activeUserNodeId,
          (node) => ({
            parts: [...(node.parts ?? []), ...parts].filter(
              (part, index, self) =>
                self.findIndex((existing) => existing.name === part.name && existing.url === part.url) === index,
            ),
          }),
        ),
      ),
    );
  }, []);

  const handleRemoveAttachment = useCallback((nodeId: string, name: string, url: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({
            parts: node.parts?.filter((existingPart) => existingPart.name !== name || existingPart.url !== url),
          }),
        ),
      ),
    );
  }, []);

  const handleUploadFiles = useCallback(async (nodeId: string) => {
    const files = await uploadFiles({ multiple: true });

    if (!files.length) return;
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => {
            const existingFileMap = new Map(node.files?.map((file) => [file.name, file]));
            files.forEach((file) => {
              existingFileMap.delete(file.name);
              existingFileMap.set(file.name, file);
            });
            const newFiles = [...existingFileMap.values()];
            return { files: newFiles };
          },
        ),
      ),
    );
  }, []);

  const hanldeRemoveFile = useCallback((nodeId: string, fileName: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({
            files: node.files?.filter((file) => file.name !== fileName),
          }),
        ),
      ),
    );
  }, []);

  const handleToggleViewFormat = useCallback((nodeId: string) => {
    setTreeNodes((nodes) => {
      const isExitEditing = nodes.find((node) => node.id === nodeId)?.isViewSource;
      if (isExitEditing) {
        if (document.activeElement?.closest("code-editor-element")) {
          setTimeout(() => {
            // programmatically focus the textarea if transitioning from text editor
            document.getElementById(nodeId)?.focus();
          }, 0);
        }
      }
      return nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({ isViewSource: !node.isViewSource }),
        ),
      );
    });
  }, []);

  const handleToggleRole = useCallback((nodeId: string) => {
    handleAbort(nodeId);

    // only toggle between user and assistant. Ignore toggling from system
    // ensure last node is a user node. If not, append one
    setTreeNodes((nodes) => {
      const targetIndex = nodes.findIndex((n) => n.id === nodeId);
      if (targetIndex === -1) return nodes;
      const newNodes = nodes.flatMap((node, i, arr) => {
        if (i === targetIndex && node.role !== "system") {
          const newRole = node.role === "user" ? "assistant" : "user";
          if (i === arr.length - 1) {
            return [{ ...node, role: newRole } satisfies ChatNode, getUserNode(crypto.randomUUID())];
          } else {
            return { ...node, role: newRole } satisfies ChatNode;
          }
        }
        return node;
      });
      return newNodes;
    });
  }, []);

  const handleToggleShowMore = useCallback((nodeId: string, options?: { toggleAll?: boolean }) => {
    setTreeNodes((nodes) => {
      const currentNode = nodes.find((node) => node.id === nodeId);
      const newState = !currentNode?.isCollapsed;

      return nodes.map(
        patchNode(
          (node) => options?.toggleAll ?? node.id === nodeId,
          (_node) => ({ isCollapsed: newState }),
        ),
      );
    });
  }, []);

  const handlePreviewDoubleClick = useCallback((nodeId: string, e: React.SyntheticEvent) => {
    const artifactElement = (e.target as HTMLElement)?.closest("artifact-element");
    if (artifactElement) {
      if (!(e.target as HTMLElement)?.closest("artifact-source")) return;
      artifactElement.querySelector<HTMLButtonElement>(`[data-action="edit"]`)?.click();
    } else {
      handleToggleViewFormat(nodeId);
    }
  }, []);

  return (
    <ChatAppLayout>
      <ChatConfigMemo
        onConnectionsButtonClick={handleConnectionsButtonClick}
        groupedConnections={groupedConnections}
        connectionKey={connectionKey}
        temperature={temperature}
        maxTokens={maxTokens}
      />
      <MessageList ref={treeRootRef}>
        {treeNodes.map((node) => (
          <ChatNodeMemo
            key={node.id}
            node={node}
            onTextChange={handleTextChange}
            onCodeBlockChange={handleCodeBlockChange}
            onDelete={handleDelete}
            onDeleteBelow={handleDeleteBelow}
            onRunNode={handleRunNode}
            onKeydown={handleKeydown}
            onPaste={handlePaste}
            onUploadFiles={handleUploadFiles}
            onRemoveAttachment={handleRemoveAttachment}
            onRemoveFile={hanldeRemoveFile}
            onToggleRole={handleToggleRole}
            onToggleViewFormat={handleToggleViewFormat}
            onToggleShowMore={handleToggleShowMore}
            onPreviewDoubleClick={handlePreviewDoubleClick}
            onAbort={handleAbort}
          />
        ))}
      </MessageList>
    </ChatAppLayout>
  );
}

const ChatAppLayout = styled.div`
  display: grid;
  gap: 16px;
`;

const MessageList = styled.div`
  display: grid;
  gap: 16px;
`;
