import React, { useCallback, useRef } from "react";
import styled from "styled-components";

export function useDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => dialogRef.current?.showModal(), []);
  const close = useCallback(() => dialogRef.current?.close(), []);
  const DialogComponent: React.FC<{ children?: JSX.Element | null }> = useCallback(
    (props) => <StyledDialog ref={dialogRef}>{props.children}</StyledDialog>,
    []
  );

  return {
    open,
    close,
    DialogComponent,
  };
}

const StyledDialog = styled.dialog`
  // adaptive width with clamp
  margin: auto;
  width: clamp(300px, 80vw, 600px);
`;

export const DialogLayout = styled.div`
  display: grid;
  gap: 16px;
`;

export const DialogTitle = styled.h1`
  font-size: 20px;
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
`;

export const DialogTitleButton = styled.button`
  font-size: 16px;

  &:first-of-type {
    margin-left: auto;
  }
`;

export const DialogActionGroup = styled.div`
  display: flex;
  justify-content: end;
  gap: 8px;
`;
