import { useEffect, useRef } from "react";
import type { BehaviorSubject } from "rxjs";
import { getReadableNumber } from "./get-readable-number";
import type { ChatNodeMetadata } from "./tree-store";

export interface InputMetadataProps {
  metadata$: BehaviorSubject<ChatNodeMetadata>;
}
export function InputMetadata(props: InputMetadataProps) {
  const dataViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subscription = props.metadata$.subscribe((metadata) => {
      if (!dataViewRef.current) return;
      const { totalInputTokens } = metadata;
      const hasData = totalInputTokens !== undefined && totalInputTokens > 0;
      dataViewRef.current.toggleAttribute("data-active", hasData);

      if (totalInputTokens !== undefined && totalInputTokens > 0) {
        dataViewRef.current.querySelector("[data-input]")!.textContent =
          `${getReadableNumber(totalInputTokens)} ${totalInputTokens > 1 ? "tokens" : "token"}`;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [props.metadata$]);

  return (
    <span className="c-usage-metadata" ref={dataViewRef}>
      <span className="c-usage-metric" title="token count based on o200k tokenizer">
        <span data-input></span>
      </span>
    </span>
  );
}
