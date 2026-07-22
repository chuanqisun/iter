import { memo, useEffect, useRef } from "react";
import { AttachmentPreview } from "./attachment-preview";
import "./chat-node.css";
import { InputMetadata } from "./input-metadata";
import { getCombo } from "./keyboard";
import { OutputMetadata } from "./output-metadata";
import { StreamingEditor } from "./streaming-editor";
import { StreamingPreview } from "./streaming-preview";
import { INITIAL_USER_NODE } from "./tree-helper";
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

export interface ChatNodeProps {
  node: ChatNode;
  onAbort: (id: string) => void;
  onAbortAll: () => void;
  onCodeBlockChange: (id: string, current: string, index: number) => void;
  onDelete: (id: string) => void;
  onDeleteBelow: (id: string) => void;
  onDownloadAttachment: (id: string, attachmentId: string) => void;
  onRenameAttachment: (id: string, attachmentId: string) => void;
  onCopyAttachment: (id: string, attachmentId: string) => void;
  onNavigatePrevious: (id: string) => void;
  onNavigateNext: (id: string) => void;
  onOnly: (id: string) => void;
  onPaste: (id: string, e: ClipboardEvent) => void;
  onPasteTextAsAttachment: (id: string) => void;
  onPreviewDoubleClick: (id: string, e: React.MouseEvent) => void;
  onRemoveAttachment: (id: string, attachmentId: string) => void;
  onRunNode: (id: string) => void;
  onTextChange: (id: string, value: string) => void;
  onToggleAttachmentType: (id: string, attachmentId: string) => void;
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
    onAbortAll,
    onCodeBlockChange,
    onDelete,
    onDeleteBelow,
    onDownloadAttachment,
    onRenameAttachment,
    onCopyAttachment,
    onNavigatePrevious,
    onNavigateNext,
    onOnly,
    onPaste,
    onPasteTextAsAttachment,
    onPreviewDoubleClick,
    onRemoveAttachment,
    onRunNode,
    onTextChange,
    onToggleAttachmentType,
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
    <div key={node.id} data-node-id={node.id} className="c-chat-node">
      <div className="message-layout js-message" ref={tabCyclingContainer}>
        <button
          className="avatar"
          data-managed-focus="message-action"
          onClick={(e) => onToggleShowMore(node.id, e.ctrlKey ? { toggleAll: true } : undefined)}
        >
          <span
            className="avatar-icon"
            title={`${node.isCollapsed ? "Expand" : "Collapse"} ${roleDislayName[node.role]} message`}
          >
            {roleIcon[node.role]}
          </span>
        </button>
        <div className="message-with-actions">
          {node.role === "system" ? (
            <span className="message-actions">
              <button data-managed-focus="message-action">{roleDislayName[node.role]}</button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDelete(node.id)}>
                Delete
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onDeleteBelow(node.id)}>
                Trim
              </button>
              <span className="c-far-group">
                <InputMetadata metadata$={node.metadata$} />
              </span>
            </span>
          ) : null}
          {node.role === "user" || node.role === "assistant" ? (
            <span className="message-actions">
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
              <button data-managed-focus="message-action" onClick={() => onOnly(node.id)}>
                Only
              </button>
              <span> · </span>
              <button data-managed-focus="message-action" onClick={() => onUploadFiles(node.id)}>
                Upload
              </button>
              {node.role === "assistant" ? (
                <>
                  <span> · </span>
                  <button data-managed-focus="message-action" onClick={() => onToggleViewFormat(node.id)}>
                    {node.isViewSource ? "View" : "Edit"}
                  </button>
                </>
              ) : null}
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
            </span>
          ) : null}

          <code-block-events
            oncodeblockchange={(e) => onCodeBlockChange(node.id, e.detail.current, e.detail.index)}
          ></code-block-events>
          <>
            {node.role === "user" || node.role === "system" ? (
              <code-editor-element
                className="js-focusable"
                id={node.id}
                data-autofocus={node.id === INITIAL_USER_NODE.id ? "" : null}
                data-collapsed={node.isCollapsed ? "" : null}
                data-value={node.content}
                data-lang="md"
                data-placeholder={
                  node.role === "user"
                    ? "Ctrl + Enter to send, Esc to cancel, paste images for vision models, Shift + Space to dictate"
                    : "System message"
                }
                onescape={onAbortAll}
                oncontentchange={(e) => onTextChange(node.id, e.detail)}
                onpaste={(e) => onPaste(node.id, e)}
                onpastetextasattachment={() => onPasteTextAsAttachment(node.id)}
                onnavigateprevious={() => onNavigatePrevious(node.id)}
                onnavigatenext={() => onNavigateNext(node.id)}
                onrun={(e) => {
                  onTextChange(node.id, e.detail);
                  onRunNode(node.id);
                }}
              ></code-editor-element>
            ) : node.isViewSource ? (
              <StreamingEditor
                node={node}
                onEscape={() => onToggleViewFormat(node.id)}
                onNavigatePrevious={onNavigatePrevious}
                onNavigateNext={onNavigateNext}
                onTextChange={onTextChange}
              />
            ) : (
              <StreamingPreview
                node={node}
                onAbort={() => onAbort(node.id)}
                onEnter={() => onToggleViewFormat(node.id)}
                onDoubleClick={(e) => onPreviewDoubleClick(node.id, e)}
                onNavigatePrevious={() => onNavigatePrevious(node.id)}
                onNavigateNext={() => onNavigateNext(node.id)}
              />
            )}

            {node.attachments?.length ? (
              <div className="attachment-list">
                {node.attachments.map((attachment) => {
                  return (
                    <AttachmentPreview
                      key={attachment.id}
                      nodeId={node.id}
                      attachment={attachment}
                      onDownloadAttachment={onDownloadAttachment}
                      onRenameAttachment={onRenameAttachment}
                      onToggleAttachmentType={onToggleAttachmentType}
                      onCopyAttachment={onCopyAttachment}
                      onRemoveAttachment={onRemoveAttachment}
                    ></AttachmentPreview>
                  );
                })}
              </div>
            ) : null}
            {node.errorMessage ? <span className="error-message">❌ {node.errorMessage}</span> : null}
          </>
        </div>
      </div>
    </div>
  );
}
