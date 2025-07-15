import type { MouseEvent } from "react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { markdownToHtml, preloadPreviewWorker } from "../workers/worker-proxy";
import { getCombo } from "./keyboard";
import { MarkdownPreview } from "./markdown-preview";
import { skipWhenBusy } from "./skip-when-busy";
import type { ChatNode } from "./tree-store";

export interface StreamingPreviewProps {
  node: ChatNode;
  onAbort: () => void;
  onEdit: () => void;
  onDoubleClick: (e: MouseEvent) => void;
  collapsedHeight?: number;
}

// memoize based on the relevant properties of the node
export const StreamingPreview = memo(StreamingPreviewInternal, (prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.content === nextProps.node.content &&
    prevProps.node.content$ === nextProps.node.content$ &&
    prevProps.node.cachedPreviewHtml?.key === nextProps.node.cachedPreviewHtml?.key &&
    prevProps.node.isCollapsed === nextProps.node.isCollapsed &&
    prevProps.collapsedHeight === nextProps.collapsedHeight
  );
});

export function StreamingPreviewInternal(props: StreamingPreviewProps) {
  // stream content into markdown preview
  const [html, setHtml] = useState<string>(props.node.cachedPreviewHtml?.value ?? "");

  useEffect(() => void preloadPreviewWorker(), []);

  useEffect(() => {
    const cacheKey = props.node.cachedPreviewHtml?.key;
    if (!props.node.content$) {
      if (cacheKey === props.node.content) return;
      // full cache hit, no need to re-render

      markdownToHtml(props.node.content).then((html) => {
        setHtml(html);
        props.node.cachedPreviewHtml = {
          key: props.node.content,
          value: html,
        };
      });
      return;
    }

    const subscription = skipWhenBusy(props.node.content$, (content) =>
      markdownToHtml(content.snapshot).then((html) => {
        setHtml(html);
        props.node.cachedPreviewHtml = {
          key: content.snapshot,
          value: html,
        };
      }),
    ).subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [props.node.content$, props.node.content]);

  const handleKeyDown = useCallback<React.KeyboardEventHandler>((e) => {
    const combo = getCombo(e as any as KeyboardEvent);
    if (combo === "escape") {
      props.onAbort();
    } else if (combo === "enter") {
      // Enter the entire message
      if ((e.target as HTMLElement).classList.contains("js-focusable")) {
        props.onEdit();
      }

      // Enter a code block
      if ((e.target as HTMLElement).closest("artifact-source")) {
        e.preventDefault(); // Otherwise, the dialog will immediately close

        (e.target as HTMLElement)
          .closest("artifact-element")
          ?.querySelector<HTMLButtonElement>(`[data-action="edit"]`)
          ?.click();
      }
    }
  }, []);

  return (
    <MarkdownPreview
      tabIndex={0}
      className="js-focusable"
      onKeyDown={handleKeyDown}
      onDoubleClick={(e) => props.onDoubleClick(e)}
      id={props.node.id}
      $maxHeight={props.node.isCollapsed ? props.collapsedHeight : undefined}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}
