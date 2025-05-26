import { memo, useRef, useState } from "react";
import styled from "styled-components";
import { getDisplayType } from "./attachment";
import { getReadableFileSize } from "./file-size";
import type { Attachment } from "./tree-store";

export interface AttachmentPreviewProps {
  nodeId: string;
  attachment: Attachment;
  onDownloadAttachment: (nodeId: string, attachmentId: string) => void;
  onToggleAttachmentType: (nodeId: string, attachmentId: string) => void;
  onCopyAttachment: (nodeId: string, attachmentId: string) => void;
  onRemoveAttachment: (nodeId: string, attachmentId: string) => void;
}

export const AttachmentPreview = memo(AttachmentPreviewInternal, (prevProps, nextProps) => {
  return prevProps.nodeId === nextProps.nodeId && prevProps.attachment === nextProps.attachment;
});

export function AttachmentPreviewInternal(props: AttachmentPreviewProps) {
  const { attachment, nodeId } = props;
  const file = attachment.file;
  const [isCopying, setIsCopying] = useState(false);
  const copyingTimeoutRef = useRef<number | null>(null);

  const handleCopy = () => {
    // flip the copying state for 3 seconds, then flip back. If already copying, restart the timer
    if (copyingTimeoutRef.current) {
      clearTimeout(copyingTimeoutRef.current);
    }
    setIsCopying(true);
    copyingTimeoutRef.current = window.setTimeout(() => {
      setIsCopying(false);
      copyingTimeoutRef.current = null;
    }, 3000);
    props.onCopyAttachment(nodeId, attachment.id);
  };

  return (
    <StyledAttachmentPreview key={attachment.id}>
      {attachment.type === "embedded" && file.type?.startsWith("image/") ? (
        <AttachmentMedia src={attachment.file.url} />
      ) : null}
      <AttachmentHeading>
        <AttachmentFileName
          title={`Download ${file.name}${file.type ? ` (${file.type})` : ""}`}
          onClick={() => props.onDownloadAttachment(nodeId, attachment.id)}
        >
          {file.name}
        </AttachmentFileName>
        <AttachmentFileSize>{getReadableFileSize(file.size)}</AttachmentFileSize>
      </AttachmentHeading>
      <AttachmentFooter>
        <AttachmentAction title="Toggle file mode" onClick={() => props.onToggleAttachmentType(nodeId, attachment.id)}>
          {getDisplayType(attachment)}
        </AttachmentAction>
        <span> · </span>
        <AttachmentAction title="Delete file" onClick={() => props.onRemoveAttachment(nodeId, attachment.id)}>
          Delete
        </AttachmentAction>
        <span> · </span>
        <AttachmentAction title="Copy as message part" onClick={handleCopy}>
          {isCopying ? "✅ Copied!" : "Copy"}
        </AttachmentAction>
      </AttachmentFooter>
    </StyledAttachmentPreview>
  );
}

const StyledAttachmentPreview = styled.div`
  display: grid;
  grid-template:
    "media heading" auto
    "media footer" auto / auto 1fr;
  text-align: start;
  align-content: center;
  height: 48px;
  padding: 0px 8px;
  border: 1px solid var(--button-border-rest-color);
  background-color: var(--button-background-rest-color);
  border-radius: var(--button-border-radius);

  &:hover {
    border: 1px solid var(--button-border-hover-color);
    background-color: var(--button-background-hover-color);
  }

  img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    margin-right: 8px;
  }
`;

const AttachmentHeading = styled.div`
  display: grid;
  grid-area: heading;
  justify-content: start;
  gap: 4px;
  grid-auto-flow: column;
  grid-auto-columns: auto;
  align-items: baseline;
`;

const AttachmentFooter = styled.div`
  display: grid;
  grid-area: footer;
  gap: 0px;
  justify-content: start;
  white-space: pre-wrap;
  grid-auto-flow: column;
  grid-auto-columns: auto;
  color: var(--action-button-rest-color);
  font-size: 12px;
`;

const AttachmentMedia = styled.img`
  grid-area: media;
`;

const AttachmentFileName = styled.button`
  font-size: 14px;
  border: none;
  background: none;
  padding: 0;

  // text longer than 100px will show ...
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
  cursor: pointer;

  &:focus-visible,
  &:hover {
    text-decoration: underline;
  }
`;

const AttachmentFileSize = styled.div`
  opacity: 0.625;
  font-size: 12px;
`;

const AttachmentAction = styled.button`
  border: none;
  background: none;
  padding: 0;
  display: inline;
  cursor: pointer;
  color: var(--action-button-rest-color);

  &:focus-visible,
  &:hover {
    text-decoration: underline;
    color: var(--action-button-hover-color);
  }
`;
