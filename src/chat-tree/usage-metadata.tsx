import { useEffect, useRef } from "react";
import type { BehaviorSubject } from "rxjs";
import type { ChatNodeMetadata } from "./tree-store";

export interface UsageMetadataProps {
  metadata$: BehaviorSubject<ChatNodeMetadata>;
}
export function UsageMetadata(props: UsageMetadataProps) {
  const dataViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subscription = props.metadata$.subscribe((metadata) => {
      if (!dataViewRef.current) return;
      const { tokensPerSecond, totalOutputTokens } = metadata;
      const tps = tokensPerSecond
        ? tokensPerSecond > 1
          ? tokensPerSecond.toFixed(0)
          : tokensPerSecond.toFixed(1)
        : "";

      const hasData = !!tokensPerSecond && !!totalOutputTokens;
      dataViewRef.current.toggleAttribute("data-active", hasData);

      if (hasData) {
        dataViewRef.current.querySelector("[data-tps]")!.textContent = `${tps}`;
        dataViewRef.current.querySelector("[data-total]")!.textContent = (totalOutputTokens ?? "").toString();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [props.metadata$]);

  return (
    <span className="c-usage-metadata" ref={dataViewRef}>
      <span className="c-usage-metric" title="tokens per second">
        <span data-tps></span> tps
      </span>
      <span> · </span>
      <span className="c-usage-metric" title="total output tokens">
        <span data-total></span> out
      </span>
    </span>
  );
}
