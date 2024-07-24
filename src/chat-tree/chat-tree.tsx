import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useAccountContext } from "../account/account-context";
import { ConnectionSetupDialog } from "../account/connection-setup-form";
import { AutoResize } from "../form/auto-resize";
import { BasicFormButton, BasicFormInput, BasicSelect } from "../form/form";
import { getChatStream, type ChatMessage, type OpenAIChatPayload } from "../openai/chat";
import { useRouteParameter } from "../router/use-route-parameter";
import { useDialog } from "../shell/dialog";
import { artifactStyles, markdownToHtml, useArtifactActions } from "./artifact";
import { getFirstImageDataUrl } from "./clipboard";
import { tableStyles } from "./table";
import { useNodeContentTransformStore } from "./use-node-content-transform-store";

export interface ChatNode {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  contentHtml?: string;
  attachments?: string[];
  isViewSource?: boolean;
  childIds?: string[];
  isLocked?: boolean;
  isCollapsed?: boolean;
  isShowFull?: boolean;
  isEntry?: boolean;
  abortController?: AbortController;
  errorMessage?: string;
  lastSubmittedContent?: string;
}

const INITIAL_USER_NODE = getUserNode(crypto.randomUUID());
const INITIAL_SYSTEM_NODE: ChatNode = {
  id: crypto.randomUUID(),
  role: "system",
  content: "",
  isEntry: true,
  childIds: [INITIAL_USER_NODE.id],
};
const INITIAL_NODES = [INITIAL_SYSTEM_NODE, INITIAL_USER_NODE];

function getUserNode(id: string, configOverrides?: Partial<ChatNode>): ChatNode {
  return {
    id,
    role: "user",
    content: "",
    ...configOverrides,
  };
}

function patchNode(predicate: (node: ChatNode) => boolean, patch: Partial<ChatNode> | ((node: ChatNode) => Partial<ChatNode>)) {
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

function getReachableIds(nodes: ChatNode[], rootId: string): string[] {
  const rootNode = nodes.find((node) => node.id === rootId);
  if (!rootNode) return [];

  return [rootId, ...(rootNode.childIds ?? []).flatMap((childId) => getReachableIds(nodes, childId))];
}

function getPrevId(currentId: string): string | null {
  const allTextAreas = [...document.querySelectorAll<HTMLTextAreaElement>(`.js-focusable`)];
  const currentIndex = allTextAreas.findIndex((item) => item.id === currentId);
  return allTextAreas.at(Math.max(0, currentIndex - 1))?.id ?? null;
}
function getPostId(currentId: string): string | null {
  const allTextAreas = [...document.querySelectorAll<HTMLTextAreaElement>(`.js-focusable`)];
  const currentIndex = allTextAreas.findIndex((item) => item.id === currentId);
  return allTextAreas.at(Math.min((allTextAreas.length - 1, currentIndex + 1)))?.id ?? null;
}

export interface ChatConnection {
  endpoint: string;
  apiKey: string;
}

export function ChatTree() {
  const [treeNodes, setTreeNodes] = useState(INITIAL_NODES);
  const treeRootRef = useRef<HTMLDivElement>(null);

  const { DialogComponent, open, close } = useDialog();
  const [isDialogOpened, setIsDialogOpened] = useState(false);
  const handleConnectionsButtonClick = () => {
    setIsDialogOpened(true);
    open();
  };

  const { connections, getChatEndpoint } = useAccountContext();

  const modelDisplayId = useRouteParameter({ name: "modelId", initial: null as null | string, encode: String, decode: String });
  const temperature = useRouteParameter({ name: "temperature", initial: 0, encode: String, decode: Number });
  const maxTokens = useRouteParameter({ name: "max_tokens", initial: 200, encode: String, decode: Number });

  const previews = useNodeContentTransformStore(treeNodes, markdownToHtml);

  useArtifactActions();

  const chat = useCallback(
    (messages: ChatMessage[], abortSignal?: AbortSignal) => {
      const chatEndpoint = getChatEndpoint?.(modelDisplayId.value ?? "");
      if (!chatEndpoint) throw new Error(`API connection is not set up`);

      const modelConfig: Partial<OpenAIChatPayload> = {
        temperature: temperature.value,
        max_tokens: maxTokens.value,
      };
      return getChatStream(chatEndpoint.apiKey, chatEndpoint.endpoint, messages, modelConfig, abortSignal);
    },
    [modelDisplayId.value, getChatEndpoint, temperature.value, maxTokens.value]
  );

  // intiialize
  useEffect(() => {
    if (modelDisplayId.value && connections?.some((connection) => connection.models?.some((model) => model.displayId === modelDisplayId.value))) return;
    if (connections) {
      const defaultConnection = connections.find((connection) => !!connection.models?.length);
      if (!defaultConnection) return;
      modelDisplayId.replace(defaultConnection.models?.at(0)!.displayId ?? "");
    }
  }, [modelDisplayId.value, modelDisplayId.replace, connections]);

  const handleTextChange = useCallback((nodeId: string, content: string) => {
    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { content })));
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    handleAbort(nodeId);

    // if delete root
    if (treeNodes[0].id === nodeId) {
      setTreeNodes(INITIAL_NODES); // thanks to immutability, we can reuse
      return;
    }

    setTreeNodes((nodes) => {
      // resurvively find all ids to be deleted
      const reachableIds = getReachableIds(nodes, nodeId);

      // filter out the node to be deleted
      const remainingNodes = nodes.filter((node) => !reachableIds.includes(node.id));

      let newUserNodeId = "";

      // make sure all system/assistant nodes have at least one child
      const newNodes = remainingNodes.map((node) => {
        if (node.childIds?.includes(nodeId)) {
          const updated: ChatNode = {
            ...node,
            childIds: node.childIds?.filter((childId) => childId !== nodeId),
          };

          if (updated.role !== "user" && updated.childIds?.length === 0) {
            newUserNodeId = crypto.randomUUID();
            updated.childIds = [newUserNodeId];
          }

          return updated;
        } else {
          return node;
        }
      });

      if (newUserNodeId) {
        newNodes.push(getUserNode(newUserNodeId));
      }

      return newNodes;
    });
  }, []);

  const handleFork = useCallback((siblingId: string, baseContent: string) => {
    // Note: when forking, original node should revert to last submitted content
    // insert a new user node before the forked node
    const newUserNode: ChatNode = getUserNode(crypto.randomUUID(), { content: baseContent });

    setTreeNodes((nodes) => {
      const newNodes = [...nodes, newUserNode];
      const parentNode = newNodes.find((node) => node.childIds?.includes(siblingId))!; // safe assert: the top most user node is under the system node
      const allSiblingIds = [...(parentNode?.childIds || [])];
      const siblingIndex = allSiblingIds.findIndex((id) => id === siblingId);
      // revert to last submitted content
      const originalNodeIndex = newNodes.findIndex((node) => node.id === siblingId)!;
      newNodes[originalNodeIndex] = {
        ...newNodes[originalNodeIndex],
        content: newNodes[originalNodeIndex].lastSubmittedContent ?? newNodes[originalNodeIndex].content,
      };

      allSiblingIds.splice(siblingIndex, 0, newUserNode.id);
      newNodes[newNodes.findIndex((node) => node.id === parentNode.id)!] = {
        ...parentNode,
        childIds: allSiblingIds,
      };

      return newNodes;
    });
  }, []);

  const handleToggleAccordion = useCallback((nodeId: string) => {
    setTreeNodes((nodes) => {
      const targetNode = nodes.find((node) => node.id === nodeId);
      if (!targetNode?.childIds?.length) return nodes;

      const newNodes = [...nodes];
      const targetNodeIndex = newNodes.findIndex((node) => node.id === nodeId);
      newNodes[targetNodeIndex] = {
        ...targetNode,
        isCollapsed: !targetNode.isCollapsed,
      };
      return newNodes;
    });
  }, []);

  const getMessageChain = useCallback(
    (id: string) => {
      const treeDict = new Map(treeNodes.map((node) => [node.id, node]));
      const parentDict = new Map<string, string>();

      treeNodes.forEach((node) => {
        node.childIds?.forEach((childId) => {
          parentDict.set(childId, node.id);
        });
      });

      function getSourcePath(id: string): string[] {
        const parentId = parentDict.get(id);
        if (!parentId) return [id];
        return [...getSourcePath(parentId), id];
      }

      return getSourcePath(id).map((id) => {
        const node = treeDict.get(id);
        if (!node) throw new Error(`Node ${id} not found`);
        const message: ChatMessage = {
          role: node.role,
          content: [{ type: "text", text: node.content }, ...(node.attachments ?? []).map((url) => ({ type: "image_url" as const, image_url: { url } }))],
        };

        return message;
      });
    },
    [treeNodes]
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
          }
        )
      )
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
    [treeNodes]
  );

  const handleKeydown = useCallback(
    async (nodeId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const targetNode = treeNodes.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const activeUserNodeId = getActiveUserNodeId(targetNode);

      if (e.key === "Escape") {
        if (!activeUserNodeId) return;
        e.preventDefault();
        handleAbort(activeUserNodeId);
      }

      // up/down arrow
      if (!e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "PageUp" || e.key === "PageDown")) {
        const textarea = e.target as HTMLTextAreaElement;

        if (
          (e.key === "ArrowUp" || e.key === "PageUp") &&
          textarea.selectionStart === 0 &&
          (textarea.selectionEnd === 0 || textarea.selectionEnd === textarea.value.length)
        ) {
          e.preventDefault();
          const targetId = getPrevId(nodeId);
          if (targetId) {
            const targetTextarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
            targetTextarea?.focus();
          }
        } else if (
          (e.key === "ArrowDown" || e.key === "PageDown") &&
          (textarea.selectionStart === 0 || textarea.selectionStart === textarea.value.length) &&
          textarea.selectionEnd === textarea.value.length
        ) {
          e.preventDefault();
          const targetId = getPostId(nodeId);
          if (targetId) {
            const targetTextarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
            targetTextarea?.focus();
          }
        }
      }

      // submit message
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "Enter") {
        if (!activeUserNodeId) return;
        e.preventDefault();

        const messages = getMessageChain(activeUserNodeId);

        const abortController = new AbortController();

        // clean up all downstream node
        // resurvively find all ids to be deleted
        handleAbort(activeUserNodeId);

        const newAssistantNode: ChatNode = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          isLocked: true,
        };

        setTreeNodes((nodes) => {
          const reachableIds = getReachableIds(nodes, activeUserNodeId);

          // delete all reachable nodes, make sure the node itself remains
          const remainingNodes = nodes.filter((node) => node.id === activeUserNodeId || !reachableIds.includes(node.id));

          const newNodes = [...remainingNodes, newAssistantNode];
          const targetNodeIndex = newNodes.findIndex((node) => node.id === activeUserNodeId);
          newNodes[targetNodeIndex] = {
            ...newNodes[targetNodeIndex],
            childIds: [newAssistantNode.id], // ok to override since we just cloned the node
            lastSubmittedContent: targetNode.content,
            abortController,
          };

          return newNodes;
        });

        try {
          const stream = chat(messages, abortController.signal);
          for await (const item of stream) {
            setTreeNodes((nodes) =>
              nodes.map(
                patchNode(
                  (node) => node.id === newAssistantNode.id,
                  (node) => ({ content: node.content + (item.choices[0]?.delta?.content ?? "") })
                )
              )
            );
          }

          setTreeNodes((nodes) => {
            const newUserNode = getUserNode(crypto.randomUUID());
            const newNodes = [...nodes, newUserNode];
            const targetNodeIndex = newNodes.findIndex((node) => node.id === activeUserNodeId);
            const assistantNodeIndex = newNodes.findIndex((node) => node.id === newAssistantNode.id);

            newNodes[targetNodeIndex] = {
              ...newNodes[targetNodeIndex],
              abortController: undefined,
              isLocked: true,
            };

            newNodes[assistantNodeIndex] = {
              ...newNodes[assistantNodeIndex],
              childIds: [newUserNode.id],
            };

            return newNodes;
          });
        } catch (e: any) {
          setTreeNodes((nodes) => {
            const newNodes = [...nodes];
            const targetNodeIndex = newNodes.findIndex((node) => node.id === activeUserNodeId);
            const assistantNodeIndex = newNodes.findIndex((node) => node.id === newAssistantNode.id);

            newNodes[targetNodeIndex] = {
              ...newNodes[targetNodeIndex],
              abortController: undefined,
            };

            newNodes[assistantNodeIndex] = {
              ...newNodes[assistantNodeIndex],
              errorMessage: `${e?.name} ${(e as any).message}`,
            };

            return newNodes;
          });
        }
      }
    },
    [chat, treeNodes, getMessageChain]
  );

  const handlePaste = useCallback(
    async (nodeId: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const activeUserNodeId = getActiveUserNodeId(treeNodes.find((node) => node.id === nodeId));
      if (!activeUserNodeId) return;

      const imageDataUrl = await getFirstImageDataUrl(e.clipboardData);
      if (!imageDataUrl) return;

      setTreeNodes((nodes) =>
        nodes.map(
          patchNode(
            (node) => node.id === activeUserNodeId,
            (node) => ({ attachments: [...new Set([...(node.attachments ?? []), imageDataUrl])] })
          )
        )
      );
    },
    [treeNodes]
  );

  const handleRemoveAttachment = useCallback((nodeId: string, attachment: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({ attachments: node.attachments?.filter((url) => url !== attachment) })
        )
      )
    );
  }, []);

  const handleToggleViewFormat = useCallback((nodeId: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({ isViewSource: !node.isViewSource })
        )
      )
    );
  }, []);

  const handleToggleShowMore = useCallback((nodeId: string) => {
    setTreeNodes((nodes) =>
      nodes.map(
        patchNode(
          (node) => node.id === nodeId,
          (node) => ({ isShowFull: !node.isShowFull })
        )
      )
    );
  }, []);

  const renderNode = useCallback(
    (node: ChatNode, hasSibling?: boolean) => {
      return (
        <Thread showrail={hasSibling ? "true" : undefined} key={node.id}>
          <MessageLayout>
            <Avatar onClick={() => handleToggleAccordion(node.id)}>
              <AvatarIcon>
                {roleIcon[node.role]} {node.childIds?.length && node.isCollapsed ? "🔽" : null}
              </AvatarIcon>
            </Avatar>
            <MessageWithActions>
              {node.role === "user" || node.role === "system" ? (
                <>
                  <AutoResize data-resize-textarea-content={node.content} $maxHeight={node.isShowFull ? undefined : 400}>
                    <GhostTextArea
                      className="js-focusable"
                      id={node.id}
                      value={node.content}
                      rows={1}
                      onKeyDown={(e) => handleKeydown(node.id, e)}
                      onPaste={(e) => handlePaste(node.id, e)}
                      onChange={(e) => handleTextChange(node.id, e.target.value)}
                      placeholder={node.role === "user" ? "Ctrl + Enter to send, Esc to cancel, paste images as attachments" : "System message"}
                    />
                  </AutoResize>
                  {node.attachments?.length ? (
                    <AttachmentList>
                      {node.attachments.map((url) => (
                        <AttachmentPreview key={url} onClick={(_) => handleRemoveAttachment(node.id, url)}>
                          <img key={url} src={url} alt="attachment" />
                        </AttachmentPreview>
                      ))}
                    </AttachmentList>
                  ) : null}
                </>
              ) : (
                <>
                  {node.isViewSource ? (
                    <AutoResize data-resize-textarea-content={node.content} $maxHeight={node.isShowFull ? undefined : 400}>
                      <GhostTextArea
                        className="js-focusable"
                        id={node.id}
                        value={node.content}
                        rows={1}
                        onKeyDown={(e) => handleKeydown(node.id, e)}
                        onChange={(e) => handleTextChange(node.id, e.target.value)}
                      />
                    </AutoResize>
                  ) : (
                    <MarkdownPreview $maxHeight={node.isShowFull ? undefined : 400} dangerouslySetInnerHTML={{ __html: previews[node.id] ?? "" }} />
                  )}
                  <MessageActions>
                    <button onClick={() => handleToggleViewFormat(node.id)}>{node.isViewSource ? "View" : "Edit"}</button>
                    <span> · </span>
                    <button onClick={() => handleToggleShowMore(node.id)}>{node.isShowFull ? "Scroll" : "Full"}</button>
                  </MessageActions>
                  {node.errorMessage ? (
                    <ErrorMessage>
                      {node.content.length ? <br /> : null}❌ {node.errorMessage}
                    </ErrorMessage>
                  ) : null}
                </>
              )}
              {node.role === "system" ? (
                <MessageActions>
                  <button onClick={() => handleDelete(node.id)}>Delete</button>
                  <span> · </span>
                  <button onClick={() => handleToggleShowMore(node.id)}>{node.isShowFull ? "Scroll" : "Full"}</button>
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
                  <button onClick={() => handleFork(node.id, node.content)}>Fork</button>
                  <span> · </span>
                  <button onClick={() => handleDelete(node.id)}>Delete</button>
                  <span> · </span>
                  <button onClick={() => handleToggleShowMore(node.id)}>{node.isShowFull ? "Scroll" : "Full"}</button>
                </MessageActions>
              ) : null}
            </MessageWithActions>
          </MessageLayout>
          {!!node.childIds?.length ? (
            node.isCollapsed ? null : (
              <MessageList>
                {node.childIds
                  ?.map((id) => treeNodes.find((node) => node.id === id))
                  .filter(Boolean)
                  .map((childNode) => renderNode(childNode as ChatNode, (node?.childIds ?? []).length > 1))}
              </MessageList>
            )
          ) : null}
        </Thread>
      );
    },
    [handleKeydown]
  );

  return (
    <ChatAppLayout>
      <div>
        <ConfigMenu>
          <BasicFormButton onClick={handleConnectionsButtonClick}>Connections</BasicFormButton>
          <DialogComponent>{isDialogOpened ? <ConnectionSetupDialog onClose={close} /> : null}</DialogComponent>
          {connections?.length ? (
            <label>
              Model
              <BasicSelect value={modelDisplayId.value ?? ""} onChange={(e) => modelDisplayId.replace(e.target.value)}>
                {connections.map((connection) => (
                  <optgroup key={connection.id} label={connection.displayName}>
                    {connection.models?.map((model) => (
                      <option key={model.displayId} value={model.displayId}>
                        {model.displayName}
                      </option>
                    ))}
                    {!connection.models?.length ? (
                      <option value="" disabled>
                        No models available
                      </option>
                    ) : null}
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
      <MessageList ref={treeRootRef}>{treeNodes.filter((node) => node.isEntry).map((node) => renderNode(node))}</MessageList>
    </ChatAppLayout>
  );
}

const GhostTextArea = styled.textarea`
  border-radius: 2px;
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

const Thread = styled.div<{ showrail?: "true" }>`
  display: grid;
  gap: 8px;
  margin-left: ${(props) => (props.showrail ? "14px" : "0")};
  padding-left: ${(props) => (props.showrail ? "13px" : "0")};
  border-left: ${(props) => (props.showrail ? "1px solid #aaa" : "none")};
`;

const MessageList = styled.div`
  display: grid;
  gap: 16px;
`;

const MessageActions = styled.span`
  padding: 0 calc(1px + var(--input-padding-inline));
  min-height: 30px;
  line-height: 30px;
  display: flex;
  align-items: center;
  gap: 4px;

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
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--input-border-radius);
  cursor: pointer;
  font-size: 22px;
  line-height: 30px;
  width: 28px;
  display: flex;
  align-items: baseline;
  justify-content: center;

  &:hover {
    border-color: ButtonBorder;
  }
`;

const AvatarIcon = styled.span`
  width: 28px;
  text-align: center;
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
  img {
    height: 40px;
    width: 60px;
    object-fit: contain;
  }
`;

const MarkdownPreview = styled.div<{ $maxHeight?: number }>`
  min-height: 31px; // match that of single line textarea
  ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
  scrollbar-gutter: stable;
  overflow-y: auto;
  padding: var(--input-padding-block) var(--input-padding-inline);
  border-width: var(--input-border-width);
  border-radius: 2px;
  border-style: solid;
  border-color: var(--readonly-text-border-color);
  border-color: transparent;
  background-color: var(--readonly-text-background);

  & > * + * {
    margin-top: 4px;
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
    color-scheme: dark;

    code {
      font-size: 14px;
      font-family: var(--monospace-font);
    }
  }

  ${tableStyles}

  ${artifactStyles}
`;
