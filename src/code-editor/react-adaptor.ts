import type { DOMAttributes } from "react";
import type { CodeEditorElement } from "../code-editor/code-editor-element";

type CustomElement<T> = Partial<T & DOMAttributes<T> & { children: any }>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "code-editor-element": CustomElement<CodeEditorElement> & {
        "data-value"?: string | undefined;
        "data-lang"?: string | undefined;
        onescape?: (event: Event) => void;
        oncontentchange?: (event: CustomEvent<string>) => void;
        onrun?: (event: CustomEvent<string>) => void;
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
