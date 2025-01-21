import type { WebSpeechResult } from "../voice/speech-recognition";

export interface DictateResult {
  fullText: string;
}
export function dictateToTextarea(textarea: HTMLTextAreaElement, result: WebSpeechResult) {
  // ...existing text | <previous_text_replaced> | <cursor>  | existing text...

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const { replace, previous } = result;
  const allTextBeforeCursor = textarea.value.slice(0, start);
  if (previous && allTextBeforeCursor.endsWith(previous)) {
    const newText = allTextBeforeCursor.slice(0, -previous.length) + replace + textarea.value.slice(end);
    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = start - previous.length + replace.length;
    return {
      fullText: newText,
    };
  } else {
    // if the character before cursor is not a /s character, add a space
    const padding = !allTextBeforeCursor || allTextBeforeCursor.at(-1)?.match(/\s/) ? "" : " ";
    // append at cursor
    const newText = allTextBeforeCursor + padding + replace + textarea.value.slice(end);
    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = start + padding.length + replace.length;
    return {
      fullText: newText,
    };
  }
}
