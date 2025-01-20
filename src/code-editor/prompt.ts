import type { GenericMessage } from "../providers/base";

export function getCursorChatMessages(params: { prompt: string; lang: string; fullTextWithCursor: string }): GenericMessage[] {
  const { prompt, lang, fullTextWithCursor } = params;

  return [
    {
      role: "system",
      content: `
You are a text editor assistant. The content of the editor is wrapped in <editor-content>...</editor-content> tags. The curosr and selected text is marked by <cursor>...</cursor> tags.
Now based user's provided goal/instruction wrapped in <user-goal>...</user-goal> tags, replace the content under cursor with <cursor-new>...</cursor-new>
      `,
    },
    {
      role: "user",
      content: `
<editor-content lang="javascript">
function main() {
  <cursor></cursor>
}
</editor-content>

<goal>print hello world</goal>
          `.trim(),
    },
    {
      role: "assistant",
      content: `
<cursor-new>console.log("hello world");</cursor-new>
          `.trim(),
    },
    {
      role: "user",
      content: `
<editor-content lang="text">
Hello, I am <cursor-content>John</cursor-content>.
</editor-content>

<goal>Rename to Mary</goal>
          `.trim(),
    },
    {
      role: "assistant",
      content: `
<cursor-new>Mary</cursor-new>
          `.trim(),
    },
    {
      role: "user",
      content: `
<editor-content lang="${lang}">
${fullTextWithCursor.trim()}
</editor-content>

<goal>${prompt.trim()}</goal>
          `.trim(),
    },
  ];
}
