import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { Observable, tap } from "rxjs";
import { markdownToHtml } from "../artifact/artifact";
import { MarkdownPreview } from "./markdown-preview";
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
              .finally(() => {
                setTimeout(() => {
                  isBusy = false;
                }, 10); // HACK: give some time for async task to digest
              });
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

/**
 * emit the stream when isBusy is false, skip the value when isBusy is true
 * however, when the stream completes, make sure to emit the last value
 */
function skipWhenBusy<T>(stream: Observable<T>, isBusy: () => boolean): Observable<T> {
  return new Observable<T>((subscriber) => {
    let lastSkippedValue: T | undefined;
    const subscription = stream.subscribe({
      next: (value) => {
        if (isBusy()) {
          lastSkippedValue = value;
        } else {
          subscriber.next(value);
          lastSkippedValue = undefined;
        }
      },
      error: (err) => subscriber.error(err),
      complete: () => {
        if (lastSkippedValue !== undefined) {
          subscriber.next(lastSkippedValue);
        }
        subscriber.complete();
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  });
}
