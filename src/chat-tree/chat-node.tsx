import styled from "styled-components";
import type { ChatNode } from "./chat-tree";
import { getReadableFileSize } from "./file-size";
import { tableStyles } from "./table";
import type { OutputMap } from "./use-node-content-transform-store";

const roleIcon = {
  system: "⚙️",
  user: "👤",
  assistant: "🤖",
};

const COLLAPSED_HEIGHT = 72;

export interface ChatNodeProps {
  node: ChatNode;
  handleToggleShowMore: (id: string, options?: { toggleAll?: boolean }) => void;
  handleDelete: (id: string) => void;
  handleDeleteBelow: (id: string) => void;
  handleToggleViewFormat: (id: string) => void;
  handleTextChange: (id: string, value: string) => void;
  handleRunNode: (id: string) => void;
  handleKeydown: (id: string, e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => void;
  handlePaste: (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleUploadFiles: (id: string) => void;
  handleRemoveAttachment: (id: string, name: string, url: string) => void;
  handleRemoveFile: (id: string, name: string) => void;
  handleCodeBlockChange: (id: string, current: string, index: number) => void;
  handleAbort: (id: string) => void;
  handlePreviewDoubleClick: (id: string, e: React.MouseEvent) => void;
  previews: OutputMap;
}

export function ChatNode(props: ChatNodeProps) {
  const {
    node,
    handleToggleShowMore,
    handleDelete,
    handleDeleteBelow,
    handleToggleViewFormat,
    handleTextChange,
    handleRunNode,
    handleKeydown,
    handlePaste,
    handleUploadFiles,
    handleRemoveAttachment,
    handleCodeBlockChange,
    handleAbort,
    handlePreviewDoubleClick,
    handleRemoveFile,
    previews,
  } = props;

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
                    <AttachmentPreview key={file.name} onClick={(_) => handleRemoveFile(node.id, file.name)}>
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
