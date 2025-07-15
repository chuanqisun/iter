import type { DOMAttributes } from "react";
import type { CodeEditorElement } from "../code-editor/code-editor-element";

type CustomElement<T> = Partial<T & DOMAttributes<T> & { children: any }>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "code-editor-element": CustomElement<CodeEditorElement> & {
        "data-lang"?: string | undefined;
        "data-value"?: string | undefined;
        "data-readonly"?: string | undefined;
        "data-tab-indent"?: string | undefined;
        "data-placeholder"?: string | undefined;
        onescape?: (event: Event) => void;
        onenterreadonly?: (event: Event) => void;
        onnavigateprevious?: (event: Event) => void;
        onnavigatenext?: (event: Event) => void;
        oncontentchange?: (event: CustomEvent<string>) => void;
        onrun?: (event: CustomEvent<string>) => void;
        ref?: RefObject<CodeEditorElement | null>;
      };
      "code-block-events": CustomElement<HTMLElement> & {
        oncodeblockchange?: (
          event: CustomEvent<{
            index: number;
            previous: string;
            current: string;
          }>,
        ) => void;
      };
    }
  }
}
