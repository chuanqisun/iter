import { useEffect, useRef } from "react";
import { tap } from "rxjs";
import type { CodeEditorElement } from "../code-editor/code-editor-element";
import type { ChatNode } from "./tree-store";

export interface StreamingEditorProps {
  node: ChatNode;
  collapsedHeight?: number;
  onTextChange: (id: string, text: string) => void;
  onToggleViewFormat: (id: string) => void;
}

export function StreamingEditor(props: StreamingEditorProps) {
  const codeEditorRef = useRef<CodeEditorElement>(null);

  // stream content into code editor
  useEffect(() => {
    if (!codeEditorRef.current) return;
    if (!props.node.content$) return; // When not streaming, we are setting the content by jsx props

    const aiCursor = codeEditorRef.current.spawnCursor();
    try {
      let isFirstEvent = true;
      const subscription = props.node.content$
        .pipe(
          tap({
            next: (content) => {
              if (isFirstEvent) {
                aiCursor.replaceAll(content.snapshot);
                isFirstEvent = false;
              } else {
                aiCursor.write(content.delta);
              }
            },
            finalize: () => aiCursor.close(),
          }),
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } catch (e) {
      console.error("Error in streaming editor", e);
      aiCursor.close();
    }
  }, [props.node.content$]);

  return (
    <code-editor-element
      ref={codeEditorRef}
      data-autofocus
      data-value={props.node.content}
      data-lang="md"
      style={
        {
          "--max-height": props.node.isCollapsed ? `${props.collapsedHeight}px` : undefined,
        } as any
      }
      onescape={() => props.onToggleViewFormat(props.node.id)}
      oncontentchange={(e) => props.onTextChange(props.node.id, e.detail)}
    ></code-editor-element>
  );
}
