import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useAccountContext } from "../account/account-context";
import { ConnectionSetupDialog } from "../account/connection-setup-form";
import { AutoResize } from "../form/auto-resize";
import { BasicFormButton } from "../form/form";
import { getChatStream, type ChatMessage, type OpenAIChatPayload } from "../openai/chat";
import { isSucceeded, listDeployments, type ModelDeployment } from "../openai/management";
import { useDialog } from "../shell/dialog";

export interface ChatNode {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  childIds?: string[];
  isLocked?: boolean;
  isCollapsed?: boolean;
  isEntry?: boolean;
  isEditing?: boolean;
  isNextFocus?: boolean;
  abortController?: AbortController;
  errorMessage?: string;
}

const INITIAL_USER_NODE = getUserNode(crypto.randomUUID());
const INITIAL_SYSTEM_NODE: ChatNode = {
  id: crypto.randomUUID(),
  role: "system",
  content: "",
  isEntry: true,
  isEditing: true,
  childIds: [INITIAL_USER_NODE.id],
};
const INITIAL_NODES = [INITIAL_SYSTEM_NODE, INITIAL_USER_NODE];

function getUserNode(id: string, configOverrides?: Partial<ChatNode>): ChatNode {
  return {
    id,
    role: "user",
    content: "",
    isEditing: true,
    isNextFocus: true,
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

  const { azureOpenAIConnection } = useAccountContext();
  const [modelOptions, setModelOptions] = useState<ModelDeployment[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<Partial<OpenAIChatPayload>>({ temperature: 0.7, max_tokens: 200 });

  const chat = useCallback(
    async (messages: ChatMessage[], abortSignal?: AbortSignal) => {
      if (!azureOpenAIConnection || !selectedModelId) throw new Error("Chat endpoint not available");
      const endpoint = `${azureOpenAIConnection.endpoint}openai/deployments/${selectedModelId}/chat/completions?api-version=2023-03-15-preview`;
      return getChatStream(azureOpenAIConnection.apiKey, endpoint, messages, modelConfig, abortSignal);
    },
    [azureOpenAIConnection, selectedModelId, modelConfig]
  );

  useEffect(() => {
    if (azureOpenAIConnection) {
      listDeployments(azureOpenAIConnection.apiKey, azureOpenAIConnection.endpoint).then((deployments) => {
        const validModels = deployments.filter(isSucceeded).filter((maybeModel) => ["gpt-35-turbo", "gpt-4", "gpt-4-32k"].includes(maybeModel.model));
        setModelOptions(validModels);
        setSelectedModelId(validModels[0]?.id ?? null);
      });
    }
  }, [azureOpenAIConnection]);

  const focusById = useCallback((nodeId: string) => {
    setTimeout(() => {
      document.getElementById(nodeId)?.focus();
      (document.getElementById(nodeId) as HTMLTextAreaElement)?.select();
    }, 0);
  }, []);

  useEffect(() => {
    const needFocusNodes = treeNodes.filter((node) => node.isNextFocus);
    if (!needFocusNodes.length) return;

    focusById(needFocusNodes.at(-1)!.id);

    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.isNextFocus === true, { isNextFocus: false })));
  }, [treeNodes]);

  const handleTextChange = useCallback((nodeId: string, content: string) => {
    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { content })));
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    handleAbort(nodeId);
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
    // insert a new user node before the forked node
    const newUserNode: ChatNode = getUserNode(crypto.randomUUID(), { content: baseContent });

    setTreeNodes((nodes) => {
      const newNodes = [...nodes, newUserNode];
      const parentNode = newNodes.find((node) => node.childIds?.includes(siblingId))!; // safe assert: the top most user node is under the system node
      const allSiblingIds = [...(parentNode?.childIds || [])];
      const siblingIndex = allSiblingIds.findIndex((id) => id === siblingId);
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

  const handleStartEdit = useCallback((nodeId: string) => {
    setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { isEditing: true, isNextFocus: true })));
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
          content: node.content,
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

  const handleKeydown = useCallback(
    async (nodeId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const targetNode = treeNodes.find((node) => node.id === nodeId);
      if (targetNode?.role !== "user") return;

      if (e.key === "Escape") {
        setTreeNodes((nodes) => nodes.map(patchNode((node) => node.id === nodeId, { isEditing: false })));
        return;
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "Enter") {
        e.preventDefault();

        const messages = getMessageChain(nodeId);

        const abortController = new AbortController();

        const newAssistantNode: ChatNode = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          isLocked: true,
        };

        setTreeNodes((nodes) => {
          const newNodes = [...nodes, newAssistantNode];
          const targetNodeIndex = newNodes.findIndex((node) => node.id === nodeId);

          const previousChildIds = new Set(...(newNodes[targetNodeIndex].childIds ?? []));

          newNodes[targetNodeIndex] = {
            ...newNodes[targetNodeIndex],
            childIds: [newAssistantNode.id],
            abortController,
          };
          return newNodes.filter((node) => !previousChildIds.has(node.id)); // ensure the previous assistant node is removed
        });

        try {
          const stream = await chat(messages, abortController.signal);
          for await (const item of stream) {
            console.log(item.choices[0].delta.content);
            setTreeNodes((nodes) =>
              nodes.map(
                patchNode(
                  (node) => node.id === newAssistantNode.id,
                  (node) => ({ content: node.content + (item.choices[0].delta.content ?? "") })
                )
              )
            );
          }

          setTreeNodes((nodes) => {
            const newUserNode = getUserNode(crypto.randomUUID());
            const newNodes = [...nodes, newUserNode];
            const targetNodeIndex = newNodes.findIndex((node) => node.id === nodeId);
            const assistantNodeIndex = newNodes.findIndex((node) => node.id === newAssistantNode.id);

            newNodes[targetNodeIndex] = {
              ...newNodes[targetNodeIndex],
              abortController: undefined,
              isEditing: false,
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
            const targetNodeIndex = newNodes.findIndex((node) => node.id === nodeId);
            const assistantNodeIndex = newNodes.findIndex((node) => node.id === newAssistantNode.id);

            newNodes[targetNodeIndex] = {
              ...newNodes[targetNodeIndex],
              abortController: undefined,
              isEditing: true,
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
                <AutoResize data-resize-textarea-content={node.content}>
                  <textarea
                    id={node.id}
                    value={node.content}
                    rows={1}
                    onKeyDown={(e) => handleKeydown(node.id, e)}
                    onChange={(e) => handleTextChange(node.id, e.target.value)}
                    placeholder={node.role === "user" ? "Ctrl + Enter to send, Esc to cancel" : "System message"}
                  />
                </AutoResize>
              ) : (
                <Message draft={!node.isLocked && !node.isEditing && !node.isEditing ? "true" : undefined}>
                  {node.content}
                  {node.errorMessage ? (
                    <ErrorMessage>
                      <br />
                      ️❌
                      {node.errorMessage}
                    </ErrorMessage>
                  ) : null}
                </Message>
              )}
              <MessageActions>
                {node.role === "user" ? (
                  <>
                    {" "}
                    {node.abortController ? (
                      <>
                        <button onClick={() => handleAbort(node.id)}>Stop</button>
                        <span> · </span>
                      </>
                    ) : null}
                    {node.isEditing || node.isLocked ? null : (
                      <>
                        <button onClick={() => handleStartEdit(node.id)}>Edit</button>
                        <span> · </span>
                      </>
                    )}
                    <button onClick={() => handleFork(node.id, node.content)}>Fork</button>
                    <span> · </span>
                    <button onClick={() => handleDelete(node.id)}>Delete</button>
                  </>
                ) : null}
              </MessageActions>
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
        <ModelSelector>
          <BasicFormButton onClick={handleConnectionsButtonClick}>Connections</BasicFormButton>
          <DialogComponent>{isDialogOpened ? <ConnectionSetupDialog onClose={close} /> : null}</DialogComponent>
          <label>
            Model
            <select value={selectedModelId ?? ""} onChange={(e) => setSelectedModelId(e.target.value)}>
              {modelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.model}
                </option>
              ))}
            </select>
          </label>
          <label>
            Temperature
            <input
              type="number"
              min={0}
              max={1}
              value={modelConfig.temperature}
              step={0.05}
              onChange={(e) => setModelConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            />
          </label>
          <label>
            Max tokens
            <input
              type="number"
              min={0}
              max={32000}
              step={100}
              value={modelConfig.max_tokens}
              onChange={(e) => setModelConfig((prev) => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
            />
          </label>
        </ModelSelector>
      </div>
      <MessageList ref={treeRootRef}>{treeNodes.filter((node) => node.isEntry).map((node) => renderNode(node))}</MessageList>
    </ChatAppLayout>
  );
}

const ChatAppLayout = styled.div`
  display: grid;
  gap: 16px;
`;

const ModelSelector = styled.menu`
  padding: 0;
  display: flex;
  gap: 12px;
  padding-left: 32px;
  flex-wrap: wrap;

  label {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input,
  select {
    padding: 2px 4px;
  }
`;

const Thread = styled.div<{ showrail?: "true" }>`
  display: grid;
  gap: 8px;
  margin-left: ${(props) => (props.showrail ? "14px" : "0")};
  padding-left: ${(props) => (props.showrail ? "13px" : "0")};
  border-left: 1px solid ${(props) => (props.showrail ? "#aaa" : "transparent")};
`;

const MessageList = styled.div`
  display: grid;
  gap: 16px;
`;

const MessageActions = styled.span`
  padding: 0 5px;

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

const Message = styled.span<{ draft?: "true" }>`
  padding: 4px 2px;
  border: 1px solid transparent;
  white-space: pre-wrap;
  &::before {
    content: ${(props) => (props.draft ? '"*"' : "")};
  }
`;

const ErrorMessage = styled.span`
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
  border-radius: 2px;
  cursor: pointer;
  font-size: 20px;
  width: 28px;
  display: flex;
  align-items: baseline;
  justify-content: center;

  &:hover {
    background-color: white;
  }
`;

const AvatarIcon = styled.span`
  width: 24px;
`;
