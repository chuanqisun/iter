import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { tap } from "rxjs";
import { MarkdownPreview } from "./markdown-preview";
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
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    if (!props.node.content$) {
      markdownToHtml(props.node.content).then(setHtml);
      return;
    }

    let isBusy = false;
    const bufferedContent$ = skipWhenBusy(props.node.content$, () => isBusy);

    const subscription = bufferedContent$
      .pipe(
        tap({
          next: async (content) => {
            isBusy = true;
            markdownToHtml(content.snapshot)
              .then(setHtml)
              .finally(() => (isBusy = false));
          },
        }),
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [props.node.content$]);

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
