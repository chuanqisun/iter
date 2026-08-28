import { isolateHistory } from "@codemirror/commands";
import type { Extension, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function Clipboard(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const htmlItem = getHtmlClipboardItem(event.clipboardData);
      if (!htmlItem) return;

      const plainText = event.clipboardData?.getData("text/plain") ?? "";
      event.preventDefault();

      (async () => {
        try {
          const [html, { htmlToMarkdown }] = await Promise.all([
            readItemAsString(htmlItem),
            import("./html-to-markdown"),
          ]);
          const markdown = await htmlToMarkdown(html);
          dispatchPaste(view, {
            plainText,
            formattedText: markdown,
          });
        } catch (error) {
          console.warn("Failed to convert HTML to markdown:", error);
          if (plainText) {
            dispatchPaste(view, {
              formattedText: plainText,
            });
          }
        }
      })();

      return true;
    },
  });
}

// Pure helper functions

export interface MultiFormatPastePayload {
  plainText?: string;
  formattedText: string;
}

export function getHtmlClipboardItem(clipboardData?: DataTransfer | null): DataTransferItem | undefined {
  const items = clipboardData?.items;
  if (!items) return undefined;
  for (const item of items) {
    if (item.type === "text/html") {
      return item;
    }
  }
  return undefined;
}

export function readItemAsString(
  item: DataTransferItem | { getAsString: (cb: (data: string) => void) => void },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    item.getAsString((data) => {
      if (data) resolve(data);
      else reject(new Error("No data"));
    });
  });
}

export function createPasteSpecSteps(from: number, to: number, payload: MultiFormatPastePayload): TransactionSpec[] {
  const { plainText, formattedText } = payload;

  if (plainText && formattedText !== plainText) {
    return [
      {
        changes: { from, to, insert: plainText },
        userEvent: "input.paste",
        annotations: isolateHistory.of("full"),
      },
      {
        changes: { from, to: from + plainText.length, insert: formattedText },
        userEvent: "input.paste",
        annotations: isolateHistory.of("full"),
      },
    ];
  }

  return [
    {
      changes: { from, to, insert: formattedText },
      userEvent: "input.paste",
      annotations: isolateHistory.of("before"),
    },
  ];
}

export function dispatchPaste(view: EditorView, payload: MultiFormatPastePayload): void {
  const steps = createPasteSpecSteps(view.state.selection.main.from, view.state.selection.main.to, payload);
  for (const step of steps) {
    view.dispatch(view.state.update(step));
  }
}
