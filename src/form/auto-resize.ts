import styled from "styled-components";

export const AutoResize = styled.div<{ $maxHeight?: number }>`
  display: grid;

  textarea {
    grid-area: 1 / 1 / 2 / 2;
    white-space: pre-wrap;
    overflow: hidden;
    padding: var(--input-padding-block) var(--input-padding-inline);
    border-width: var(--input-border-width);
    resize: none;
    ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  &::after {
    white-space: pre-wrap;
    grid-area: 1 / 1 / 2 / 2;
    content: attr(data-resize-textarea-content) " ";
    visibility: hidden;
    padding: var(--input-padding-block) var(--input-padding-inline);
    border-width: var(--input-border-width);
    border-style: solid;
    border-color: transparent;
    overflow-y: auto;
    scrollbar-gutter: stable;
    ${(props) => props.$maxHeight && `max-height: ${props.$maxHeight}px;`}
  }
`;
