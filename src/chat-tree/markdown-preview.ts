import styled from "styled-components";
import { tableStyles } from "./table";

export const MarkdownPreview = styled.div<{ $maxHeight?: number }>`
  min-height: 34px; // try match a single line textarea
  overflow-x: auto;
  overflow-y: ${(props) => (props.$maxHeight ? "scroll" : "auto")};
  ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
  padding: var(--input-padding-block) var(--input-padding-inline);
  line-height: var(--text-line-height);
  border-width: var(--input-border-width);
  border-radius: 2px;
  border-style: solid;
  border-color: var(--readonly-text-border-color);
  border-color: transparent;
  background-color: var(--readonly-text-background);

  & > * + * {
    margin-top: 0.5rem;
  }

  hr {
    border: none;
    border-bottom: 1px solid GrayText;
  }

  code:not(pre > *) {
    background-color: var(--inline-code-background);
    font-family: var(--monospace-font);
    font-weight: 600;
    font-size: 12px;
    padding: 2px 4px;
  }

  .shiki {
    min-height: 36px; // preven code from collapsing to 0px
    overflow-x: auto;
    padding: 8px;
    line-height: var(--code-line-height);
    color-scheme: dark;

    code {
      font-size: 14px;
      font-family: var(--monospace-font);
    }
  }

  ${tableStyles}
`;
