import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { MarkdownPreview } from "./markdown-preview/markdown-preview";
import { markdownToHtml, skipWhenBusy } from "./markdown-preview/worker-proxy";
import type { ChatNode } from "./tree-store";

export interface StreamingPreviewProps {
  node: ChatNode;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onDoubleClick: (e: MouseEvent) => void;
  collapsedHeight?: number;
}

export function StreamingPreivew(props: StreamingPreviewProps) {
  // stream content into markdown preview
  const [html, setHtml] = useState<string>(props.node.cachedPreviewHtml?.value ?? "");

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

  return (
    <MarkdownPreview
      tabIndex={0}
      className="js-focusable"
      onKeyDown={(e) => props.onKeyDown(e)}
      onDoubleClick={(e) => props.onDoubleClick(e)}
      id={props.node.id}
      $maxHeight={props.node.isCollapsed ? props.collapsedHeight : undefined}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}
