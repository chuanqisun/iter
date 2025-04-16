import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { markdownToHtml, useArtifactActions } from "../artifact/artifact";
import { getFileAccessPostscript, respondFileAccess, respondFileList } from "../artifact/lib/file-access";
import type { CodeEditorElement } from "../code-editor/code-editor-element";
import { BasicFormButton, BasicFormInput, BasicSelect } from "../form/form";
import { type GenericMessage } from "../providers/base";
import { useRouteCache } from "../router/use-route-cache";
import { useRouteParameter } from "../router/use-route-parameter";
import { useConnections } from "../settings/use-connections";
import { showToast } from "../shell/toast";
import { textToDataUrl } from "../storage/codec";
import { uploadFiles, useFileHooks } from "../storage/use-file-hooks";
import { speech, type WebSpeechResult } from "../voice/speech-recognition";
import { setChatInstance } from "./chat-instance";
import { getParts } from "./clipboard";
import { dictateToTextarea } from "./dictation";
import { getReadableFileSize } from "./file-size";
import { autoFocusNthInput } from "./focus";
import { getCombo } from "./keyboard";
import { tableStyles } from "./table";
import { useNodeContentTransformStore } from "./use-node-content-transform-store";

export interface ChatNode {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  parts?: ChatPart[];
  files?: File[]; // Files for interpreter
  isViewSource?: boolean;
  isLocked?: boolean;
  isListening?: boolean;
  isCollapsed?: boolean;
  isEntry?: boolean;
  abortController?: AbortController;
  errorMessage?: string;
  lastSubmittedContent?: string;
}

export interface ChatPart {
  name: string;
  type: string;
  url: string;
  size: number;
}

const INITIAL_USER_NODE = getUserNode(crypto.randomUUID());
const INITIAL_SYSTEM_NODE: ChatNode = {
  id: crypto.randomUUID(),
  role: "system",
  content: "",
  isEntry: true,
};
const INITIAL_NODES = [INITIAL_SYSTEM_NODE, INITIAL_USER_NODE];

const COLLAPSED_HEIGHT = 72;

function getUserNode(id: string, configOverrides?: Partial<ChatNode>): ChatNode {
  return {
    id,
    role: "user",
    content: "",
    ...configOverrides,
  };
}

function patchNode(
  predicate: (node: ChatNode) => boolean,
  patch: Partial<ChatNode> | ((node: ChatNode) => Partial<ChatNode>),
) {
  return (candidateNode: ChatNode) => {
    if (predicate(candidateNode)) {
      const patched = patch instanceof Function ? patch(candidateNode) : patch;
      return { ...candidateNode, ...patched };
    } else {
      return candidateNode;
    }
  };
}

const roleIcon = {
  system: "⚙️",
  user: "👤",
  assistant: "🤖",
};

function getPrevId(currentId: string, nodes: ChatNode[]): string | null {
  const idx = nodes.findIndex((n) => n.id === currentId);
  if (idx > 0) return nodes[idx - 1].id;
  return null;
}

function getNextId(currentId: string, nodes: ChatNode[]): string | null {
  const idx = nodes.findIndex((n) => n.id === currentId);
  if (idx >= 0 && idx < nodes.length - 1) return nodes[idx + 1].id;
  return null;
}

export function ChatTree() {
  const [treeNodes, setTreeNodes] = useState(INITIAL_NODES);
  const treeRootRef = useRef<HTMLDivElement>(null);
  const { connections, getChatStreamProxy } = useConnections();
  const { saveChat, exportChat, loadChat, importChat } = useFileHooks(treeNodes, setTreeNodes);

  const handleConnectionsButtonClick = () => document.querySelector("settings-element")?.closest("dialog")?.showModal();

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

  const assistantNodes = useMemo(() => treeNodes.filter((node) => node.role === "assistant"), [treeNodes]);
  const previews = useNodeContentTransformStore(assistantNodes, markdownToHtml);

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

  // expose latest chatStreamingProxy to web components
  useEffect(() => {
    const chatStreamProxy = getChatStreamProxy?.(connectionKey.value ?? "");
    if (!chatStreamProxy) return;

    setChatInstance(chatStreamProxy);
  }, [connectionKey]);

  const groupedConnections = useMemo(() => {
    return Object.entries(Object.groupBy(connections, (connection) => connection.displayGroup));
  }, [connections]);

  // auto resolve mistached connectionKey
  useEffect(() => {
    // already matched, no op
    if (connectionKey.value && connections?.some((connection) => connection.id === connectionKey.value)) return;

    // once every connection is loaded, update connectionKey if it is not present
    const defaultConnection = connections.at(0); // auto load firt connection
    if (!defaultConnection) return;
    connectionKey.replace(defaultConnection.id);
  }, [connectionKey.value, connectionKey.replace, connections]);

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

  const handleDelete = useCallback(
    (nodeId: string) => {
      handleAbort(nodeId);

      // if delete root: only clear its content
      if (treeNodes[0].id === nodeId) {
        setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { content: "" })));
        return;
      }

      setTreeNodes((nodes) => {
        const idx = nodes.findIndex((n) => n.id === nodeId);
        if (idx === -1) return nodes;
        const newNodes = nodes.filter((n) => n.id !== nodeId);

        // If last node is not user, append a user node
        if (newNodes.length && newNodes[newNodes.length - 1].role !== "user") {
          const newUserNode = getUserNode(crypto.randomUUID());
          return [...newNodes, newUserNode];
        }
        return newNodes;
      });
    },
    [treeNodes],
  );

  const handleDeleteBelow = useCallback((nodeId: string) => {
    setTreeNodes((nodes) => {
      const idx = nodes.findIndex((n) => n.id === nodeId);
      if (idx === -1) return nodes;
      const newNodes = nodes.slice(0, idx + 1);

      // Ensure last node is user
      if (newNodes.length && newNodes[newNodes.length - 1].role !== "user") {
        const newUserNode = getUserNode(crypto.randomUUID());
        return [...newNodes, newUserNode];
      }
      return newNodes;
    });
  }, []);

  const getMessageChain = useCallback(
    (id: string) => {
      const idx = treeNodes.findIndex((n) => n.id === id);
      if (idx === -1) return [];
      return treeNodes
        .slice(0, idx + 1)
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
    },
    [treeNodes],
  );

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
  const getActiveUserNodeId = useCallback(
    (currentNode?: ChatNode) => {
      let activeUserNodeId: string | null = null;
      if (currentNode?.role === "system") {
        activeUserNodeId = treeNodes.at(1)?.id ?? null;
      } else if (currentNode?.role === "user") {
        activeUserNodeId = currentNode.id;
      }
      return activeUserNodeId;
    },
    [treeNodes],
  );

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

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      const targetNode = treeNodes.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const activeUserNodeId = getActiveUserNodeId(treeNodes.find((node) => node.id === nodeId));
      if (!activeUserNodeId) return;

      const messages = getMessageChain(activeUserNodeId);

      const abortController = new AbortController();

      handleAbort(activeUserNodeId);

      const newAssistantNode: ChatNode = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isLocked: true,
      };

      setTreeNodes((nodes) => {
        const idx = nodes.findIndex((n) => n.id === activeUserNodeId);
        if (idx === -1) return nodes;

        // Remove all nodes after activeUserNodeId
        const base = nodes.slice(0, idx + 1);
        return [
          ...base.map((n, i) => (i === idx ? { ...n, lastSubmittedContent: targetNode.content, abortController } : n)),
          newAssistantNode,
        ];
      });

      try {
        const stream = chat(messages, abortController.signal);
        for await (const item of stream) {
          setTreeNodes((nodes) =>
            nodes.map(
              patchNode(
                (node) => node.id === newAssistantNode.id,
                (node) => ({ content: node.content + item }),
              ),
            ),
          );
        }

        setTreeNodes((nodes) => {
          const newUserNode = getUserNode(crypto.randomUUID());
          return nodes
            .map((n) => (n.id === activeUserNodeId ? { ...n, abortController: undefined, isLocked: true } : n))
            .concat(newUserNode);
        });
      } catch (e: any) {
        setTreeNodes((nodes) => {
          return nodes.map((n) =>
            n.id === activeUserNodeId
              ? { ...n, abortController: undefined }
              : n.id === newAssistantNode.id
                ? { ...n, errorMessage: `${e?.name} ${(e as any).message}` }
                : n,
          );
        });
      }
    },
    [chat, treeNodes, getMessageChain],
  );

  const handleKeydown = useCallback(
    async (nodeId: string, e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
      const targetNode = treeNodes.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const combo = getCombo(e as any as KeyboardEvent);

      const activeUserNodeId = getActiveUserNodeId(targetNode);

      if (combo === "escape") {
        if (!activeUserNodeId) return;
        e.preventDefault();
        handleAbort(activeUserNodeId);
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
            targetId = getPrevId(nodeId, treeNodes);
          } else if (
            combo === "arrowdown" &&
            (textarea.selectionStart === 0 || textarea.selectionStart === textarea.value.length) &&
            textarea.selectionEnd === textarea.value.length
          ) {
            e.preventDefault();
            targetId = getNextId(nodeId, treeNodes);
          }
        }
      } else if ((e.target as HTMLElement).classList.contains("js-focusable")) {
        if (combo === "arrowup") {
          e.preventDefault();
          targetId = getPrevId(nodeId, treeNodes);
        } else if (combo === "arrowdown") {
          e.preventDefault();
          targetId = getNextId(nodeId, treeNodes);
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
    [treeNodes, handleRunNode],
  );

  const handlePaste = useCallback(
    async (nodeId: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const activeUserNodeId = getActiveUserNodeId(treeNodes.find((node) => node.id === nodeId));
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
    },
    [treeNodes],
  );

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

  const handleUploadFiles = useCallback(
    async (nodeId: string) => {
      const activeUserNodeId = getActiveUserNodeId(treeNodes.find((node) => node.id === nodeId));
      if (!activeUserNodeId) return;

      const files = await uploadFiles({ multiple: true });

      if (!files.length) return;
      setTreeNodes((nodes) =>
        nodes.map(
          patchNode(
            (node) => node.id === activeUserNodeId,
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
    },
    [treeNodes],
  );

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

  // expose file access api
  useEffect(() => {
    const allFiles = treeNodes.flatMap((node) => node.files ?? []);

    // use reverse to keep the last file
    const latestFileMap = new Map(
      allFiles
        .reverse()
        .filter((file, index, self) => self.findIndex((f) => f.name === file.name) === index)
        .reverse()
        .map((file) => [file.name, file]),
    );

    const handleIframeFileAccessRequest = (event: MessageEvent<any>) => {
      respondFileAccess((filename) => latestFileMap.get(filename), event);
      respondFileList(() => [...latestFileMap.values()], event);
    };

    window.addEventListener("message", handleIframeFileAccessRequest);

    return () => window.removeEventListener("message", handleIframeFileAccessRequest);
  }, [treeNodes]);

  // auto focus last textarea on startup
  useEffect(() => {
    autoFocusNthInput(-1);
  }, []);

  const renderNode = useCallback(
    (node: ChatNode) => {
      return (
        <Thread key={node.id}>
          <MessageLayout className="js-message">
            <Avatar onClick={(e) => handleToggleShowMore(node.id, e.ctrlKey ? { toggleAll: true } : undefined)}>
              <AvatarIcon title={node.role}>{roleIcon[node.role]}</AvatarIcon>
            </Avatar>
            <MessageWithActions>
              {node.role === "system" ? (
                <MessageActions>
                  <button onClick={() => handleDelete(node.id)}>Delete</button>
                  <span> · </span>
                  <button onClick={() => handleDeleteBelow(node.id)}>Trim</button>
                  <span> · </span>
                  <button onClick={() => handleToggleViewFormat(node.id)}>{node.isViewSource ? "Chat" : "Code"}</button>
                </MessageActions>
              ) : null}
              {node.role === "user" ? (
                <MessageActions>
                  {node.abortController ? (
                    <>
                      <button onClick={() => handleAbort(node.id)}>Stop</button>
                      <span> · </span>
                    </>
                  ) : null}
                  <button onClick={() => handleDelete(node.id)}>Delete</button>
                  <span> · </span>
                  <button onClick={() => handleDeleteBelow(node.id)}>Trim</button>
                  <span> · </span>
                  <button onClick={() => handleUploadFiles(node.id)}>Upload</button>
                  <span> · </span>
                  <button onClick={() => handleToggleViewFormat(node.id)}>{node.isViewSource ? "Chat" : "Code"}</button>
                </MessageActions>
              ) : null}
              {node.role === "assistant" ? (
                <MessageActions>
                  <button onClick={() => handleDelete(node.id)}>Delete</button>
                  <span> · </span>
                  <button onClick={() => handleDeleteBelow(node.id)}>Trim</button>
                  <span> · </span>
                  <button onClick={() => handleToggleViewFormat(node.id)}>{node.isViewSource ? "View" : "Edit"}</button>
                </MessageActions>
              ) : null}
              <code-block-events
                oncodeblockchange={(e) => handleCodeBlockChange(node.id, e.detail.current, e.detail.index)}
              ></code-block-events>
              {node.role === "user" || node.role === "system" ? (
                <>
                  {node.isViewSource ? (
                    <code-editor-element
                      data-autofocus
                      data-value={node.content}
                      data-lang="md"
                      style={
                        {
                          "--max-height": node.isCollapsed ? `${COLLAPSED_HEIGHT}px` : undefined,
                        } as any
                      }
                      onescape={() => handleToggleViewFormat(node.id)}
                      oncontentchange={(e) => handleTextChange(node.id, e.detail)}
                      onrun={(e) => {
                        handleTextChange(node.id, e.detail);
                        handleRunNode(node.id);
                      }}
                    ></code-editor-element>
                  ) : (
                    <ResizableTextArea
                      $maxHeight={node.isCollapsed ? COLLAPSED_HEIGHT : undefined}
                      className="js-focusable"
                      id={node.id}
                      value={node.content}
                      rows={1}
                      onKeyDown={(e) => handleKeydown(node.id, e)}
                      onPaste={(e) => handlePaste(node.id, e)}
                      onChange={(e) => handleTextChange(node.id, e.target.value)}
                      placeholder={
                        node.role === "user"
                          ? "Ctrl + Enter to send, Esc to cancel, paste images for vision models, Shift + Space to dictate"
                          : "System message"
                      }
                    />
                  )}
                  {node.files?.length || node.parts?.length ? (
                    <AttachmentList>
                      {node.parts
                        ?.filter((part) => part.type.startsWith("image/"))
                        ?.map((part) => (
                          <AttachmentPreview
                            key={part.url}
                            onClick={(_) => handleRemoveAttachment(node.id, part.name, part.url)}
                          >
                            <img key={part.url} src={part.url} alt="attachment" />
                          </AttachmentPreview>
                        ))}

                      {node.parts
                        ?.filter((part) => !part.type.startsWith("image/"))
                        ?.map((part) => (
                          <AttachmentPreview
                            key={part.url}
                            onClick={(_) => handleRemoveAttachment(node.id, part.name, part.url)}
                          >
                            <AttachmentFileName title={`${part.name}${part.type ? ` (${part.type})` : ""}`}>
                              {part.name}
                            </AttachmentFileName>
                            <AttachmentFileSize>{getReadableFileSize(part.size)} inlined</AttachmentFileSize>
                          </AttachmentPreview>
                        ))}

                      {node.files?.map((file) => (
                        <AttachmentPreview key={file.name} onClick={(_) => hanldeRemoveFile(node.id, file.name)}>
                          <AttachmentFileName title={`${file.name}${file.type ? ` (${file.type})` : ""}`}>
                            {file.name}
                          </AttachmentFileName>
                          <AttachmentFileSize>{getReadableFileSize(file.size)} uploaded</AttachmentFileSize>
                        </AttachmentPreview>
                      ))}
                    </AttachmentList>
                  ) : null}
                </>
              ) : (
                <>
                  {node.isViewSource ? (
                    <code-editor-element
                      data-autofocus
                      data-value={node.content}
                      data-lang="md"
                      style={
                        {
                          "--max-height": node.isCollapsed ? `${COLLAPSED_HEIGHT}px` : undefined,
                        } as any
                      }
                      onescape={() => handleToggleViewFormat(node.id)}
                      oncontentchange={(e) => handleTextChange(node.id, e.detail)}
                    ></code-editor-element>
                  ) : (
                    <>
                      <MarkdownPreview
                        tabIndex={0}
                        className="js-focusable"
                        onKeyDown={(e) => handleKeydown(node.id, e)}
                        onDoubleClick={(e) => handlePreviewDoubleClick(node.id, e)}
                        id={node.id}
                        $maxHeight={node.isCollapsed ? COLLAPSED_HEIGHT : undefined}
                        dangerouslySetInnerHTML={{
                          __html: previews[node.id] ?? "",
                        }}
                      />
                    </>
                  )}

                  {node.errorMessage ? (
                    <ErrorMessage>
                      {node.content.length ? <br /> : null}❌ {node.errorMessage}
                    </ErrorMessage>
                  ) : null}
                </>
              )}
            </MessageWithActions>
          </MessageLayout>
        </Thread>
      );
    },
    [handleKeydown, previews],
  );

  return (
    <ChatAppLayout>
      <div>
        <ConfigMenu>
          <BasicFormButton onClick={handleConnectionsButtonClick}>Menu</BasicFormButton>
          {groupedConnections?.length ? (
            <label>
              Model
              <BasicSelect value={connectionKey.value ?? ""} onChange={(e) => connectionKey.replace(e.target.value)}>
                {groupedConnections.map(([key, group]) => (
                  <optgroup key={key} label={key}>
                    {group?.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.displayName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </BasicSelect>
            </label>
          ) : null}
          <label>
            Temperature
            <FixedWidthInput
              type="number"
              min={0}
              max={2}
              value={temperature.value}
              step={0.05}
              onChange={(e) => temperature.replace((e.target as HTMLInputElement).valueAsNumber)}
            />
          </label>
          <label>
            Max tokens
            <FixedWidthInput
              type="number"
              min={0}
              max={32000}
              step={100}
              value={maxTokens.value}
              onChange={(e) => maxTokens.replace((e.target as HTMLInputElement).valueAsNumber)}
            />
          </label>
          <a href="https://github.com/chuanqisun/iter" target="_blank">
            GitHub
          </a>
        </ConfigMenu>
      </div>
      <MessageList ref={treeRootRef}>{treeNodes.map(renderNode)}</MessageList>
    </ChatAppLayout>
  );
}

const ResizableTextArea = styled.textarea<{ $maxHeight?: number }>`
  border-radius: 2px;
  line-height: 18px;
  field-sizing: content;
  white-space: pre-wrap;
  padding: 7px var(--input-padding-inline);
  border-width: var(--input-border-width);
  resize: none;
  ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
  overflow-y: ${(props) => (props.$maxHeight ? "scroll" : "auto")};
  scrollbar-gutter: stable;

  &[data-speaking] {
    color: GrayText;
  }
`;

const ChatAppLayout = styled.div`
  display: grid;
  gap: 16px;
`;

const ConfigMenu = styled.menu`
  padding: 0;
  display: flex;
  gap: 12px;
  padding-left: 32px;
  flex-wrap: wrap;
  align-items: center;

  label {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

const Thread = styled.div`
  display: grid;
  gap: 8px;
  margin-left: 0;
  padding-left: 0;
  border-left: none;
`;

const MessageList = styled.div`
  display: grid;
  gap: 16px;
`;

const MessageActions = styled.span`
  min-height: 30px;
  line-height: 30px;
  display: flex;
  align-items: center;
  gap: 4px;
  position: sticky;
  top: 0;
  background-color: var(--body-background);
  z-index: var(--action-bar-z-index);

  > * {
    opacity: 0.5;
  }
  button {
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
`;

const MessageWithActions = styled.div`
  display: grid;
  align-content: start;
`;

const ErrorMessage = styled.span`
  padding-block: 4px;
  color: red;
`;

const MessageLayout = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px;
`;

const Avatar = styled.button`
  padding-top: 30px;
  font-size: 22px;
  line-height: 30px;
  width: 28px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 2px;

  &:hover {
    background-color: var(--ghost-button-hover-background);
  }
`;

const AvatarIcon = styled.span`
  width: 28px;
  text-align: center;
  position: sticky;
  top: 30px;
`;

const FixedWidthInput = styled(BasicFormInput)`
  width: 72px;
`;

const AttachmentList = styled.div`
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
const AttachmentPreview = styled.button`
  display: grid;
  text-align: start;
  align-content: center;
  height: 48px;

  img {
    min-width: 40px;
    max-width: 60px;
    height: 40px;

    object-fit: contain;
  }
`;

const AttachmentFileName = styled.div`
  font-size: 14px;

  // text longer than 100px will show ...
  // no wrap
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
`;
const AttachmentFileSize = styled.div`
  opacity: 0.625;
  font-size: 12px;
`;

const MarkdownPreview = styled.div<{ $maxHeight?: number }>`
  min-height: 31px; // match that of single line textarea
  overflow: auto;
  ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
  padding: var(--input-padding-block) var(--input-padding-inline);
  line-height: var(--text-line-height);
  border-width: var(--input-border-width);
  border-radius: 2px;
  border-style: solid;
  border-color: var(--readonly-text-border-color);
  border-color: transparent;
  background-color: var(--readonly-text-background);

  & > * + * {
    margin-top: 0.5rem;
  }

  hr {
    border: none;
    border-bottom: 1px solid GrayText;
  }

  code:not(pre > *) {
    background-color: var(--inline-code-background);
    font-family: var(--monospace-font);
    font-size: 14px;
    padding: 0 2px;
  }

  .shiki {
    overflow-x: auto;
    padding: 8px;
    line-height: var(--code-line-height);
    color-scheme: dark;

    code {
      font-size: 14px;
      font-family: var(--monospace-font);
    }
  }

  ${tableStyles}
`;
