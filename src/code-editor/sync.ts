import { Annotation, Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

// Reference: https://codemirror.net/examples/split/
const syncAnnotation = Annotation.define<boolean>();
export function syncDispatch(tr: Transaction, view: EditorView, other: EditorView) {
  view.update([tr]);
  if (!tr.changes.empty && !tr.annotation(syncAnnotation)) {
    let annotations: Annotation<any>[] = [syncAnnotation.of(true)];
    let userEvent = tr.annotation(Transaction.userEvent);
    if (userEvent) annotations.push(Transaction.userEvent.of(userEvent));
    other.dispatch({ changes: tr.changes, annotations });
  }
}
