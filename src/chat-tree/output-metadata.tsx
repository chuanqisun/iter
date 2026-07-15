import { useEffect, useRef } from "react";
import type { BehaviorSubject } from "rxjs";
import { getReadableLatency, getReadableNumber } from "./get-readable-number";
import type { ChatNodeMetadata } from "./tree-store";

export interface OutputMetadataProps {
  metadata$: BehaviorSubject<ChatNodeMetadata>;
}
export function OutputMetadata(props: OutputMetadataProps) {
  const dataViewRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const subscription = props.metadata$.subscribe((metadata) => {
      if (!dataViewRef.current) return;
      const { tokensPerSecond, totalOutputTokens } = metadata;
      const values = {
        total: totalOutputTokens
          ? `${getReadableNumber(totalOutputTokens)} ${totalOutputTokens === 1 ? "token" : "tokens"}`
          : "",
        cache: metadata.cachedInputTokens ? `${getReadableNumber(metadata.cachedInputTokens)} cache` : "",
        tps: tokensPerSecond ? `${getReadableNumber(tokensPerSecond)}/s` : "",
        latency: metadata.latencyMs !== undefined ? getReadableLatency(metadata.latencyMs) : "",
      };

      dataViewRef.current.toggleAttribute("data-active", Object.values(values).some(Boolean));
      for (const [field, value] of Object.entries(values)) {
        dataViewRef.current.querySelector(`[data-${field}]`)!.textContent = value;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [props.metadata$]);

  return (
    <span className="c-usage-metadata" ref={dataViewRef}>
      <span className="c-usage-metric" data-total title="total output tokens"></span>
      <span className="c-usage-separator"> · </span>
      <span className="c-usage-metric" data-cache title="cache read"></span>
      <span className="c-usage-separator"> · </span>
      <span className="c-usage-metric" data-tps title="tokens per second"></span>
      <span className="c-usage-separator"> · </span>
      <span className="c-usage-metric" data-latency title="latency"></span>
    </span>
  );
}
