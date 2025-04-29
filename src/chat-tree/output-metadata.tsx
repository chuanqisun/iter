import { useEffect, useRef } from "react";
import type { BehaviorSubject } from "rxjs";
import { getReadableNumber } from "./get-readable-number";
import type { ChatNodeMetadata } from "./tree-store";

export interface OutputMetadataProps {
  metadata$: BehaviorSubject<ChatNodeMetadata>;
}
export function OutputMetadata(props: OutputMetadataProps) {
  const dataViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subscription = props.metadata$.subscribe((metadata) => {
      if (!dataViewRef.current) return;
      const { tokensPerSecond, totalOutputTokens } = metadata;
      const tps = tokensPerSecond ? getReadableNumber(tokensPerSecond) : "";

      const hasData = !!tokensPerSecond && !!totalOutputTokens;
      dataViewRef.current.toggleAttribute("data-active", hasData);

      if (hasData) {
        dataViewRef.current.querySelector("[data-tps]")!.textContent = `${tps}/s`;
        dataViewRef.current.querySelector("[data-total]")!.textContent =
          `${getReadableNumber(totalOutputTokens) ?? "0"} ${totalOutputTokens === 1 ? "token" : "tokens"}`;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [props.metadata$]);

  return (
    <span className="c-usage-metadata" ref={dataViewRef}>
      <span className="c-usage-metric" title="total output tokens">
        <span data-total></span>
      </span>
      <span> · </span>
      <span className="c-usage-metric" title="tokens per second">
        <span data-tps></span>
      </span>
    </span>
  );
}
