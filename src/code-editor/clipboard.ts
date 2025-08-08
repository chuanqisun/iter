import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function Clipboard(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      // Check if clipboard contains HTML
      const items = event.clipboardData?.items;
      if (!items) return;

      let htmlItem = null;
      for (const item of items) {
        if (item.type === "text/html") {
          htmlItem = item;
          break;
        }
      }

      if (!htmlItem) return;

      // Prevent default paste behavior
      event.preventDefault();

      (async () => {
        try {
          // Run HTML extraction and module import concurrently
          const [html, { htmlToMarkdown }] = await Promise.all([
            new Promise<string>((resolve, reject) => {
              htmlItem.getAsString((data) => {
                if (data) resolve(data);
                else reject(new Error("No HTML data"));
              });
            }),
            import("./html-to-markdown"),
          ]);

          // Convert HTML to markdown
          const markdown = await htmlToMarkdown(html);

          // Insert markdown into editor
          const transaction = view.state.update({
            changes: {
              from: view.state.selection.main.from,
              to: view.state.selection.main.to,
              insert: markdown,
            },
          });
          view.dispatch(transaction);
        } catch (error) {
          // If conversion fails, fall back to default paste behavior
          console.warn("Failed to convert HTML to markdown:", error);
        }
      })();

      return true;
    },
  });
}
