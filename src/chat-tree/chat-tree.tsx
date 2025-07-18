import React, { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useArtifactActions } from "../artifact/artifact";
import type { ArtifactEvents } from "../artifact/languages/generic";
import {
  getCodeInterpreterPrompt,
  getEditMessages,
  getReadonlyFileAccessPostscript,
  parseDirectives,
  respondListFiles,
  respondReadContent,
  respondReadFile,
  respondWriteContent,
  respondWriteFile,
  streamToText,
} from "../artifact/lib/directives";
import type { CodeEditorElement } from "../code-editor/code-editor-element";
import { type GenericMessage, type GenericMetadata } from "../providers/base";
import { useRouteCache } from "../router/use-route-cache";
import { useRouteParameter } from "../router/use-route-parameter";
import { useConnections } from "../settings/use-connections";
import { showToast } from "../shell/toast";
import {
  fileExtensionToLanguage,
  filenameToMimeType,
  languageToFileExtension,
  mimeTypeToFileExtension,
  textToDataUrl,
} from "../storage/codec";
import { uploadFiles, useFileHooks } from "../storage/use-file-hooks";
import { speech, type WebSpeechResult } from "../voice/speech-recognition";
import {
  castToFile,
  createAttachmentFromChatPart,
  createAttacchmentFromFile as createAttachmentFromFile,
  downloadAttachment,
  getAttachmentEmbeddedFiles,
  getAttachmentExternalFiles,
  getAttachmentTextContent,
  getToggledAttachment,
  getValidAttachmentFileName,
  removeAttachment,
  replaceAttachment,
  upsertAttachments,
} from "./attachment";
import { ChatConfigMemo } from "./chat-config";
import { setChatInstance } from "./chat-instance";
import { ChatNodeMemo } from "./chat-node";
import { getParts } from "./clipboard";
import { dictateToTextarea } from "./dictation";
import { getReadableFileSize } from "./file-size";
import { getFilename } from "./filename-dialog";
import { autoFocusNthInput } from "./focus";
import { InputTokenizer } from "./input-tokenizer";
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
  const reasoningEffort = useRouteParameter({
    name: "reasoning_effort",
    initial: "medium" as string,
    encode: String,
    decode: String,
  });
  const thinkingBudget = useRouteParameter({
    name: "thinking_budget",
    initial: 0,
    encode: String,
    decode: Number,
  });

  useArtifactActions();
  useRouteCache({ parameters: ["connection", "temperature", "max_tokens", "reasoning_effort", "thinking_budget"] });

  const chat = useCallback(
    (messages: GenericMessage[], abortSignal?: AbortSignal, onMetadata?: (metadata: GenericMetadata) => void) => {
      const chatStreamProxy = getChatStreamProxy?.(connectionKey.value ?? "");
      if (!chatStreamProxy) throw new Error(`API connection is not set up`);

      return chatStreamProxy({
        temperature: temperature.value,
        maxTokens: maxTokens.value,
        reasoningEffort: reasoningEffort.value,
        thinkingBudget: thinkingBudget.value,
        messages,
        abortSignal,
        onMetadata,
      });
    },
    [
      connectionKey.value,
      getChatStreamProxy,
      temperature.value,
      maxTokens.value,
      reasoningEffort.value,
      thinkingBudget.value,
    ],
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

  // handle file system runtime API requests from iframes
  useEffect(() => {
    const handledTypes = [
      "readFileRequest",
      "writeFileRequest",
      "listFilesRequest",
      "readContentRequest",
      "writeContentRequest",
    ];

    const handleIframeFileAccessRequest = (event: MessageEvent<any>) => {
      if (!handledTypes.includes(event.data?.type)) return;

      const allFiles = treeNodes$.value.flatMap((item) => [
        ...getAttachmentEmbeddedFiles(item),
        ...getAttachmentExternalFiles(item),
      ]);

      // use reverse to keep the last file
      const latestFileMap = new Map(
        allFiles
          .reverse()
          .filter((file, index, self) => self.findIndex((f) => f.name === file.name) === index)
          .reverse()
          .map((file) => [file.name, file]),
      );

      respondReadFile((filename) => castToFile(latestFileMap.get(filename)), event);
      respondListFiles(
        () => Promise.all([...latestFileMap.values().map(castToFile)]).then((files) => files.filter(Boolean) as File[]),
        event,
      );

      respondReadContent(() => {
        // find the nearest assistant node to sourceNode
        const sourceNodeId = [...document.querySelectorAll("iframe")]
          .find((iframe) => iframe.contentWindow === event.source)
          ?.closest(`[data-node-id]`)
          ?.getAttribute("data-node-id");
        if (!sourceNodeId) return "";

        const sourceNodeIndex = treeNodes$.value.findIndex((node) => node.id === sourceNodeId);
        const nearestAssistantNodeBeforeSourceNode = treeNodes$.value
          .slice(0, sourceNodeIndex)
          .reverse()
          .find((node) => node.role === "assistant");

        const content = nearestAssistantNodeBeforeSourceNode?.content ?? "";
        return content;
      }, event);

      respondWriteContent((content) => {
        const sourceNodeId = [...document.querySelectorAll("iframe")]
          .find((iframe) => iframe.contentWindow === event.source)
          ?.closest(`[data-node-id]`)
          ?.getAttribute("data-node-id");
        if (!sourceNodeId) return;

        // insert an assistant node after the source node, also ensure the entire thread would end with a user node
        const sourceIndex = treeNodes$.value.findIndex((node) => node.id === sourceNodeId);
        if (sourceIndex === -1) return;

        const newAssistantNode = getAssistantNode(crypto.randomUUID(), { content });

        setTreeNodes((nodes) => {
          const base = nodes.slice(0, sourceIndex + 1);
          const rest = nodes.slice(sourceIndex + 1);
          const newNodes = [...base, newAssistantNode, ...rest];

          // Ensure last node is user
          if (newNodes[newNodes.length - 1]?.role !== "user") {
            const newUserNode = getUserNode(crypto.randomUUID());
            newNodes.push(newUserNode);
          }

          return newNodes;
        });

        showToast(`✅ Wrote content`);
      }, event);

      // when writing a file, we treat it as uploading a file to the chat message as attachment
      respondWriteFile((name, data) => {
        const mimeType = filenameToMimeType(name);
        const file = new File([data], name, { type: mimeType });
        const sourceIframe = [...document.querySelectorAll("iframe")].find(
          (iframe) => iframe.contentWindow === event.source,
        );
        const sourceNodeId = sourceIframe?.closest(`[data-node-id]`)?.getAttribute("data-node-id");
        const newAttachment = createAttachmentFromFile(file);

        setTreeNodes((nodes) =>
          nodes.map(patchNode((node) => node.id === sourceNodeId, upsertAttachments(newAttachment))),
        );
        showToast(`✅ Created file ${name} (${getReadableFileSize(file.size)})`);
      }, event);
    };

    window.addEventListener("message", handleIframeFileAccessRequest);

    return () => window.removeEventListener("message", handleIframeFileAccessRequest);
  }, []);

  // handle prompt runtime API requests from iframes
  const promptAPIAbortControllersRef = useRef<AbortController[]>([]);
  const handleAbortPromptAPI = useCallback(() => {
    const taskCount = promptAPIAbortControllersRef.current.length;
    if (!taskCount) return;
    promptAPIAbortControllersRef.current.forEach((controller) => controller.abort());
    promptAPIAbortControllersRef.current = [];
    showToast(`⚠️ Aborted ${taskCount} prompt API requests`);
  }, []);

  useEffect(() => {
    const handledTypes = ["llmPromptRequest", "llmAbortAllRequest"];

    const handlePromptRequest = async (event: MessageEvent<any>) => {
      if (!handledTypes.includes(event.data?.type)) return;

      if (event.data.type === "llmPromptRequest") {
        const abortController = new AbortController();
        const prompt = event.data.prompt;
        promptAPIAbortControllersRef.current.push(abortController);
        try {
          const response = await streamToText(chat([{ role: "user", content: prompt }], abortController.signal));
          event.source?.postMessage({ type: "llmPromptResponse", requestId: event.data.requestId, response });
        } finally {
          promptAPIAbortControllersRef.current = promptAPIAbortControllersRef.current.filter(
            (controller) => controller !== abortController,
          );
        }
      }

      if (event.data.type === "llmAbortAllRequest") handleAbortPromptAPI();
    };

    window.addEventListener("message", handlePromptRequest);

    return () => window.removeEventListener("message", handlePromptRequest);
  }, [chat]);

  // artifact-attachment conversion
  useEffect(() => {
    const ac = new AbortController();

    window.addEventListener("attach", async (e) => {
      const context = (e as CustomEvent<ArtifactEvents["attach"]>).detail;
      console.log("Will attach code:", context);
      const ext = languageToFileExtension(context.lang);
      const pickedFilename = await getFilename({ placeholder: `filename.${ext}`, initalValue: context.filename });
      if (!pickedFilename) return;

      const validFilename = getValidAttachmentFileName(pickedFilename);
      const mediaType = filenameToMimeType(validFilename);
      const attachment = createAttachmentFromFile(new File([context.code], validFilename, { type: mediaType }));
      setTreeNodes((nodes) =>
        nodes.map(patchNode((node) => node.id === context.nodeId, upsertAttachments(attachment))),
      );
    });

    return () => ac.abort();
  }, [chat]);

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
    handleAbortBelow(nodeId);

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

    const relevantMessages = treeNodes$.value.slice(0, targetIndex + 1).reduce((acc, node, i, array) => {
      const directives = parseDirectives(node.content);

      if (directives.edit) {
        if (!node.content) return acc;
        // Edit mode: special handling
        const messages = getEditMessages(array.at(i - 1)?.content ?? "", node.content);
        return messages;
      }

      // Normal mode: build content with postscripts
      const embeddedFiles = getAttachmentEmbeddedFiles(node);
      const filePostScript = getReadonlyFileAccessPostscript([...embeddedFiles, ...getAttachmentExternalFiles(node)]);
      const codeInterpreterPostScript = directives.run
        ? getCodeInterpreterPrompt({ llm: directives.llm, fs: true })
        : "";

      const fullContent = `${node.content}${filePostScript}${codeInterpreterPostScript}`;
      const contentUrl = fullContent ? textToDataUrl(fullContent) : null;

      const attachments = embeddedFiles.map((part) => ({ name: part.name, type: part.type, url: part.url }));

      // attachments are user's inputs (before content) and assistant's outputs (after content)
      const message: GenericMessage = {
        role: node.role,
        content: [
          ...(node.role === "user" ? attachments : []),
          ...(contentUrl ? ([{ type: "text/plain", url: contentUrl }] as const) : []),
          ...(node.role === "assistant" ? attachments : []),
        ],
      };

      if (!message.content.length) return acc;

      return [...acc, message];
    }, [] as GenericMessage[]);

    return relevantMessages;
  }, []);

  const handleAbortBelow = useCallback((nodeId: string) => {
    const targetIndex = treeNodes$.value.findIndex((node) => node.id === nodeId);
    if (targetIndex === -1) return;
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (_node, index) => index > targetIndex,
          (node) => {
            if (!node?.abortController) return {};
            node.abortController.abort();
            return { abortController: undefined };
          },
        ),
      ),
    );
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

      handleClearAllErrors();

      const newAssistantNode = getAssistantNode(crypto.randomUUID(), {
        abortController,
      });
      const newUserNode = getUserNode(crypto.randomUUID());

      setTreeNodes((nodes) => {
        const activeUserNodeIndex = nodes.findIndex((n) => n.id === activeUserNodeId);
        if (activeUserNodeIndex === -1) return nodes;

        // Remove all nodes after activeUserNodeId
        const base = nodes.slice(0, activeUserNodeIndex + 1);
        return [...base, newAssistantNode, newUserNode];
      });

      const patchMetadata = (metadata: GenericMetadata) => {
        const metadata$ = newAssistantNode.metadata$;

        metadata$.next({
          ...metadata$.value,
          totalOutputTokens: metadata.totalOutputTokens,
          tokensPerSecond: (1000 * (metadata.totalOutputTokens ?? 0)) / (metadata.durationMs ?? 1),
        });
      };

      try {
        const stream = chat(messages, abortController.signal, patchMetadata);
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

  const handleNavigatePrevious = useCallback((nodeId: string) => {
    const targetId = getPrevId(nodeId, treeNodes$.value);
    if (targetId) {
      const targetElement = document.getElementById(targetId) as HTMLTextAreaElement | null;
      targetElement?.focus();
    }
  }, []);

  const handleNavigateNext = useCallback((nodeId: string) => {
    const targetId = getNextId(nodeId, treeNodes$.value);
    if (targetId) {
      const targetElement = document.getElementById(targetId) as HTMLTextAreaElement | null;
      targetElement?.focus();
    }
  }, []);

  const handleOnly = useCallback((nodeId: string) => {
    handleAbortAll();

    setTreeNodes((nodes) => {
      const systemNode = nodes[0]; // First node is always the system node
      const targetNode = nodes.find((n) => n.id === nodeId);

      if (!targetNode) return nodes;

      // Keep system node and the selected node
      const newNodes = [systemNode, targetNode];

      // Ensure last node is a user node
      if (targetNode.role !== "user") {
        newNodes.push(getUserNode(crypto.randomUUID()));
      }

      return newNodes;
    });
  }, []);

  const handlePaste = useCallback(
    async (nodeId: string, e: ClipboardEvent | React.ClipboardEvent<HTMLTextAreaElement>) => {
      const activeUserNodeId = getActiveUserNodeId(treeNodes$.value.find((node) => node.id === nodeId));
      if (!activeUserNodeId) return;

      // if has files, prevent default
      if (e.clipboardData?.files.length) e.preventDefault();

      const parts = e.clipboardData ? await getParts(e.clipboardData) : [];
      if (!parts.length) return;

      const pastedAttachments = parts.map(createAttachmentFromChatPart);

      setTreeNodes((nodes) =>
        nodes.map(patchNode((node) => node.id === activeUserNodeId, upsertAttachments(...pastedAttachments))),
      );
    },
    [],
  );

  const handleRemoveAttachment = useCallback((nodeId: string, attachmentId: string) => {
    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, removeAttachment(attachmentId))));
  }, []);

  const handleUploadFiles = useCallback(async (nodeId: string) => {
    const files = await uploadFiles({ multiple: true });
    const uploadedAttachments = files.map(createAttachmentFromFile);

    if (!files.length) return;
    setTreeNodes((nodes) =>
      nodes.map(patchNode((node) => node.id === nodeId, upsertAttachments(...uploadedAttachments))),
    );
  }, []);

  const handleDownloadAttachment = useCallback((nodeId: string, attachmentId: string) => {
    const targetNode = treeNodes$.value.find((node) => node.id === nodeId);
    if (!targetNode) return;

    downloadAttachment(targetNode, attachmentId);
  }, []);

  const handleCopyAttachment = useCallback(async (nodeId: string, attachmentId: string) => {
    const targetNode = treeNodes$.value.find((node) => node.id === nodeId);
    if (!targetNode) return;

    const attachment = targetNode.attachments?.find((att) => att.id === attachmentId);
    if (!attachment) return showToast(`❌ Attachment ${attachmentId} not found`);

    const namedExt = attachment.file.name.split(".").pop();
    const finalExt = namedExt ? namedExt : mimeTypeToFileExtension(attachment.file.type);
    const lang = fileExtensionToLanguage(finalExt);

    // append the text content of the attachment into the node as a code block
    const textContent = await getAttachmentTextContent(attachment);
    const codeBlock = `\`\`\`${lang} filename=${getValidAttachmentFileName(attachment.file.name)}\n${textContent}\n\`\`\``;

    // write to clickboard
    await navigator.clipboard.write([
      new ClipboardItem({ "text/plain": new Blob([codeBlock], { type: "text/plain" }) }),
    ]);
  }, []);

  const handleToggleAttachmentType = useCallback(async (nodeId: string, attachmentId: string) => {
    const targetNode = treeNodes$.value.find((node) => node.id === nodeId);
    if (!targetNode) return;

    const attachment = targetNode.attachments?.find((att) => att.id === attachmentId);
    if (!attachment) return showToast(`❌ Attachment ${attachmentId} not found`);

    const newAttachment = await getToggledAttachment(targetNode, attachmentId);
    if (!newAttachment) return showToast(`❌ Attachment ${attachmentId} not found`);

    setTreeNodes((nodes) =>
      nodes.map(patchNode((node) => node.id === nodeId, replaceAttachment(attachment.id, newAttachment))),
    );
  }, []);

  const handleToggleViewFormat = useCallback((nodeId: string) => {
    const isExitEditing =
      treeNodes$.value.find((node) => node.id === nodeId)?.isViewSource &&
      document.activeElement?.closest("code-editor-element");

    setTreeNodes((nodes) => {
      return nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({ isViewSource: !node.isViewSource }),
        ),
      );
    });

    if (isExitEditing) {
      // HACK it is unclear how much timeout is needed for react to re-render
      setTimeout(() => {
        // programmatically focus the textarea if transitioning from text editor
        document.getElementById(nodeId)?.focus();
      }, 1);
    }
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

  const handleClearAllErrors = useCallback(() => {
    setTreeNodes((nodes) =>
      nodes.map((node) => {
        if (node.errorMessage) {
          return { ...node, errorMessage: undefined };
        }
        return node;
      }),
    );
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
        reasoningEffort={reasoningEffort}
        thinkingBudget={thinkingBudget}
        maxTokens={maxTokens}
      />
      <MessageList ref={treeRootRef}>
        {treeNodes.map((node) => (
          <Fragment key={node.id}>
            <InputTokenizer node={node} />
            <ChatNodeMemo
              node={node}
              onAbort={handleAbort}
              onAbortAll={handleAbortAll}
              onCodeBlockChange={handleCodeBlockChange}
              onDelete={handleDelete}
              onDeleteBelow={handleDeleteBelow}
              onDownloadAttachment={handleDownloadAttachment}
              onCopyAttachment={handleCopyAttachment}
              onNavigatePrevious={handleNavigatePrevious}
              onNavigateNext={handleNavigateNext}
              onOnly={handleOnly}
              onPaste={handlePaste}
              onPreviewDoubleClick={handlePreviewDoubleClick}
              onRemoveAttachment={handleRemoveAttachment}
              onRunNode={handleRunNode}
              onTextChange={handleTextChange}
              onToggleAttachmentType={handleToggleAttachmentType}
              onToggleRole={handleToggleRole}
              onToggleShowMore={handleToggleShowMore}
              onToggleViewFormat={handleToggleViewFormat}
              onUploadFiles={handleUploadFiles}
            />
          </Fragment>
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
