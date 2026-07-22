import { memo, useRef, useState } from "react";
import { getDisplayType } from "./attachment";
import "./attachment-preview.css";
import { getReadableFileSize } from "./file-size";
import type { Attachment } from "./tree-store";

export interface AttachmentPreviewProps {
  nodeId: string;
  attachment: Attachment;
  onDownloadAttachment: (nodeId: string, attachmentId: string) => void;
  onRenameAttachment: (nodeId: string, attachmentId: string) => void;
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
    <div className="c-attachment-preview" key={attachment.id}>
      {attachment.type === "embedded" && file.type?.startsWith("image/") ? (
        <img className="media" src={attachment.file.url} />
      ) : null}
      <div className="heading">
        <button
          className="file-name"
          title={`Rename ${file.name}`}
          onClick={() => props.onRenameAttachment(nodeId, attachment.id)}
        >
          {file.name}
        </button>
        <div className="file-size">{getReadableFileSize(file.size)}</div>
      </div>
      <div className="footer">
        <button
          className="action"
          title="Toggle file mode"
          onClick={() => props.onToggleAttachmentType(nodeId, attachment.id)}
        >
          {getDisplayType(attachment)}
        </button>
        <span> · </span>
        <button className="action" title="Delete file" onClick={() => props.onRemoveAttachment(nodeId, attachment.id)}>
          Delete
        </button>
        <span> · </span>
        <button
          className="action"
          title="Download file"
          onClick={() => props.onDownloadAttachment(nodeId, attachment.id)}
        >
          Download
        </button>
        <span> · </span>
        <button className="action" title="Copy as message part" onClick={handleCopy}>
          {isCopying ? "✅ Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
