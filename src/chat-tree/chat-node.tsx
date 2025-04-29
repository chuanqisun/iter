import { memo, useEffect, useRef } from "react";
import styled from "styled-components";
import "./chat-node.css";
import { getReadableFileSize } from "./file-size";
import { InputMetadata } from "./input-metadata";
import { getCombo } from "./keyboard";
import { OutputMetadata } from "./output-metadata";
import { StreamingEditor } from "./streaming-editor";
import { StreamingPreivew } from "./streaming-preview";
import type { ChatNode } from "./tree-store";

const roleIcon = {
  system: "⚙️",
  user: "👤",
  assistant: "🤖",
};

const roleDislayName: Record<string, string> = {
  system: "System",
  developer: "Developer",
  model: "Model",
  assistant: "Assistant",
  user: "User",
  tool: "Tool",
};

const COLLAPSED_HEIGHT = 72;

export interface ChatNodeProps {
  node: ChatNode;
  onAbort: (id: string) => void;
  onCodeBlockChange: (id: string, current: string, index: number) => void;
  onDelete: (id: string) => void;
  onDeleteBelow: (id: string) => void;
  onKeydown: (id: string, e: React.KeyboardEvent<HTMLElement>) => void;
  onPaste: (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onPreviewDoubleClick: (id: string, e: React.MouseEvent) => void;
  onRemoveAttachment: (id: string, name: string, url: string) => void;
  onRemoveFile: (id: string, name: string) => void;
  onRunNode: (id: string) => void;
  onTextChange: (id: string, value: string) => void;
  onToggleRole: (id: string) => void;
  onToggleShowMore: (id: string, options?: { toggleAll?: boolean }) => void;
  onToggleViewFormat: (id: string) => void;
  onUploadFiles: (id: string) => void;
}

export const ChatNodeMemo = memo(ChatNodeInternal);

export function ChatNodeInternal(props: ChatNodeProps) {
  const {
    node,
    onAbort,
    onCodeBlockChange,
    onDelete,
    onDeleteBelow,
    onKeydown,
    onPaste,
    onPreviewDoubleClick,
    onRemoveAttachment,
    onRemoveFile,
    onRunNode,
    onTextChange,
    onToggleRole,
    onToggleShowMore,
    onToggleViewFormat,
    onUploadFiles,
  } = props;

  const tabCyclingContainer = useRef<HTMLDivElement>(null);

  // Manage focus cycling
  useEffect(() => {
    const abortController = new AbortController();

    // assign tabindex -1 to all the elements
    tabCyclingContainer.current
      ?.querySelectorAll<HTMLElement>(`[data-managed-focus="message-action"]`)
      .forEach((el, i) => {
        el.setAttribute("tabindex", i === 0 ? "0" : "-1");
      });

    tabCyclingContainer.current?.addEventListener(
      "keydown",
      (e) => {
        // make sure the event is triggered by some managed focus element
        if (!e.target || !(e.target as HTMLElement).hasAttribute("data-managed-focus")) return;

        const combo = getCombo(e);

        // left/right arrow key only
        if (combo === "arrowleft" || combo === "arrowright") {
          const focusableElements = Array.from(
            tabCyclingContainer.current?.querySelectorAll<HTMLElement>("[data-managed-focus]") ?? [],
          );
          const currentIndex = focusableElements.findIndex((el) => el === document.activeElement);
          const nextIndex = (currentIndex + (combo === "arrowleft" ? -1 : 1)) % focusableElements.length;
          if (nextIndex < 0) {
            focusableElements[focusableElements.length - 1].focus();
          } else {
            focusableElements[nextIndex].focus();
          }
          e.preventDefault();
        }
      },
      {
        signal: abortController.signal,
      },
    );

    return () => abortController.abort();
  }, []);

  return (
    <Thread key={node.id}>
      <MessageLayout className="js-message" ref={tabCyclingContainer}>
        <Avatar
          data-managed-focus="message-action"
          onClick={(e) => onToggleShowMore(node.id, e.ctrlKey ? { toggleAll: true } : undefined)}
        >
          <AvatarIcon title={`${node.isCollapsed ? "Expand" : "Collapse"} ${roleDislayName[node.role]} message`}>
            {roleIcon[node.role]}
          </AvatarIcon>
        </Avatar>
        <MessageWithActions>
          {node.role === "system" ? (
            <MessageActions>
              <button data-managed-focus="message-action">{roleDislayName[node.role]}</button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDelete(node.id)}>
                Delete
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDeleteBelow(node.id)}>
                Trim
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onToggleViewFormat(node.id)}>
                {node.isViewSource ? "Chat" : "Code"}
              </button>
              <span className="c-far-group">
                <InputMetadata metadata$={node.metadata$} />
              </span>
            </MessageActions>
          ) : null}
          {node.role === "user" || node.role === "assistant" ? (
            <MessageActions>
              <button data-managed-focus="message-action" onClick={() => onToggleRole(node.id)}>
                {roleDislayName[node.role]}
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDelete(node.id)}>
                Delete
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDeleteBelow(node.id)}>
                Trim
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onUploadFiles(node.id)}>
                Upload
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onToggleViewFormat(node.id)}>
                {node.role === "user" ? (node.isViewSource ? "Chat" : "Code") : node.isViewSource ? "View" : "Edit"}
              </button>
              {node.abortController ? (
                <>
                  <span> · </span>
                  <button
                    className="c-stop-button"
                    data-managed-focus="message-action"
                    onClick={() => onAbort(node.id)}
                  >
                    Stop
                  </button>
                </>
              ) : null}
              <span className="c-far-group">
                {node.role === "user" ? <InputMetadata metadata$={node.metadata$} /> : null}
                {node.role === "assistant" ? <OutputMetadata metadata$={node.metadata$} /> : null}
                {node.abortController ? <span className="c-spinner" /> : null}
              </span>
            </MessageActions>
          ) : null}

          <code-block-events
            oncodeblockchange={(e) => onCodeBlockChange(node.id, e.detail.current, e.detail.index)}
          ></code-block-events>
          <>
            {node.role === "user" || node.role === "system" ? (
              node.isViewSource ? (
                <code-editor-element
                  data-autofocus
                  data-value={node.content}
                  data-lang="md"
                  style={
                    {
                      "--max-height": node.isCollapsed ? `${COLLAPSED_HEIGHT}px` : undefined,
                    } as any
                  }
                  onescape={() => onToggleViewFormat(node.id)}
                  oncontentchange={(e) => onTextChange(node.id, e.detail)}
                  onrun={(e) => {
                    onTextChange(node.id, e.detail);
                    onRunNode(node.id);
                  }}
                ></code-editor-element>
              ) : (
                <ResizableTextArea
                  $maxHeight={node.isCollapsed ? COLLAPSED_HEIGHT : undefined}
                  className="js-focusable"
                  id={node.id}
                  value={node.content}
                  rows={1}
                  onKeyDown={(e) => onKeydown(node.id, e)}
                  onPaste={(e) => onPaste(node.id, e)}
                  onChange={(e) => onTextChange(node.id, e.target.value)}
                  placeholder={
                    node.role === "user"
                      ? "Ctrl + Enter to send, Esc to cancel, paste images for vision models, Shift + Space to dictate"
                      : "System message"
                  }
                />
              )
            ) : node.isViewSource ? (
              <StreamingEditor
                node={node}
                collapsedHeight={COLLAPSED_HEIGHT}
                onTextChange={onTextChange}
                onToggleViewFormat={onToggleViewFormat}
              />
            ) : (
              <StreamingPreivew
                node={node}
                onKeyDown={(e) => onKeydown(node.id, e)}
                onDoubleClick={(e) => onPreviewDoubleClick(node.id, e)}
                collapsedHeight={COLLAPSED_HEIGHT}
              />
            )}

            {node.files?.length || node.parts?.length ? (
              <AttachmentList>
                {node.parts
                  ?.filter((part) => part.type.startsWith("image/"))
                  ?.map((part) => (
                    <AttachmentPreview key={part.url} onClick={(_) => onRemoveAttachment(node.id, part.name, part.url)}>
                      <img key={part.url} src={part.url} alt="attachment" />
                    </AttachmentPreview>
                  ))}

                {node.parts
                  ?.filter((part) => !part.type.startsWith("image/"))
                  ?.map((part) => (
                    <AttachmentPreview key={part.url} onClick={(_) => onRemoveAttachment(node.id, part.name, part.url)}>
                      <AttachmentFileName title={`${part.name}${part.type ? ` (${part.type})` : ""}`}>
                        {part.name}
                      </AttachmentFileName>
                      <AttachmentFileSize>{getReadableFileSize(part.size)} inlined</AttachmentFileSize>
                    </AttachmentPreview>
                  ))}

                {node.files?.map((file) => (
                  <AttachmentPreview key={file.name} onClick={(_) => onRemoveFile(node.id, file.name)}>
                    <AttachmentFileName title={`${file.name}${file.type ? ` (${file.type})` : ""}`}>
                      {file.name}
                    </AttachmentFileName>
                    <AttachmentFileSize>{getReadableFileSize(file.size)} uploaded</AttachmentFileSize>
                  </AttachmentPreview>
                ))}
              </AttachmentList>
            ) : null}
            {node.errorMessage ? <ErrorMessage>❌ {node.errorMessage}</ErrorMessage> : null}
          </>
        </MessageWithActions>
      </MessageLayout>
    </Thread>
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

const Thread = styled.div`
  display: grid;
  gap: 8px;
  margin-left: 0;
  padding-left: 0;
  border-left: none;
`;

const MessageActions = styled.span`
  min-height: 30px;
  line-height: 30px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  position: sticky;
  top: 0;
  background-color: var(--body-background);
  z-index: var(--action-bar-z-index);

  > * {
    color: var(--action-button-rest-color);
  }
  button {
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    &:hover {
      color: var(--action-button-hover-color);
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
