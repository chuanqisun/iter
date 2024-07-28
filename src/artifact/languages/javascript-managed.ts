import { ScriptArtifact } from "./script";

export class JavascriptManagedArtifact extends ScriptArtifact {
  onResolveLanguage(lang: string): string | undefined {
    return lang === "javascript-app" ? "tsx" : undefined;
  }
}

export interface InterpreterConfig {
  injectFSApi?: boolean;
}

export const getInterpreterSystemMessage = (options?: InterpreterConfig) =>
  `
First reason about user's goal. Then write single file javascript app to meet user's goal.

Instructions:
${[
  "Any browser compatible npm package is already installed. Just import and use.",
  '<div id="root"> is already in the <body>.',
  ...(options?.injectFSApi ? ['You can access uploaded files with a special `readonlyFS.readFileAsync("/workspace/filename.ext")` API'] : []),
  "JSX or TypeScript syntax are supported",
]
  .map((rule) => `- ${rule}`)
  .join("\n")}

Respond in this format:

Your reasoning here...

\`\`\`javascript-app
// implementation
\`\`\`
`.trim();

export function getInterpreterFileUploadMessage(filename: string) {
  return `(File uploaded to \`/workspace/${filename}\`)`;
}
