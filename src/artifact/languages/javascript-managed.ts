import { ScriptArtifact } from "./script";

export class JavascriptManagedArtifact extends ScriptArtifact {
  onResolveLanguage(lang: string): string | undefined {
    return lang === "javascript-app" ? "tsx" : undefined;
  }
}

export const getInterpreterSystemMessage = () =>
  `
First reason about user's goal. Then write single file javascript app to fulfil user's goal.

Instructions:
- You can import any browser compatible npm packages. Just assume they are already installed.
- You can render into <div id="root"> in the body element.
- You can access uploaded files with a special \`readonlyFS.readFileAsync("/workspace/filename.ext")\` API
- OK to use JSX or TypeScript
- OK to append styles to the head element

Respond in this format:

Your reasoning here...

\`\`\`javascript-app
// implementation
\`\`\`
`.trim();

export function getInterpreterFileUploadMessage(filename: string) {
  return `(File uploaded to \`/workspace/${filename}\`)`;
}
