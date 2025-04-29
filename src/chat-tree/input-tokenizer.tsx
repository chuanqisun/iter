import { useEffect, useRef } from "react";
import { debounceTime, distinctUntilChanged, merge, share, Subject, switchMap, tap, throttleTime } from "rxjs";
import { getEstimatedTokenCount } from "../workers/worker-proxy";
import type { ChatNode } from "./tree-store";

export interface StreamingPreviewProps {
  node: ChatNode;
}

export function InputTokenizer(props: StreamingPreviewProps) {
  const inputChange = useRef<Subject<string> | null>(null);

  useEffect(() => {
    inputChange.current = new Subject<any>();

    const source = inputChange.current.pipe(distinctUntilChanged(), share());
    const debounced = source.pipe(debounceTime(400)); // ensure latest value is emitted
    const throttled = source.pipe(throttleTime(400)); // ensure leading edge is emitted

    const sub = merge(debounced, throttled)
      .pipe(
        distinctUntilChanged(),
        switchMap(getEstimatedTokenCount),
        distinctUntilChanged(),
        tap((count) => {
          props.node.metadata$.next({
            ...props.node.metadata$.getValue(),
            totalInputTokens: count,
          });
        }),
      )
      .subscribe();

    return () => sub.unsubscribe();
  }, [props.node.metadata$]);

  useEffect(() => {
    inputChange.current?.next(props.node.content);
  }, [props.node.content]);

  return null;
}
