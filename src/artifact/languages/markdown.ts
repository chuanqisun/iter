import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { markdownLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

export class MarkdownArtifact extends GenericArtifact {
  onResolveLanguage(lang: string) {
    return markdownLanguages.includes(lang) ? lang : undefined;
  }

  async onRun({ preview, code }: ArtifactContext) {
    return runIframe(preview, await this.markdownToHtml(code));
  }

  async onSave({ code }: ArtifactContext) {
    saveTextFile("text/markdown", "md", code);
    saveTextFile("text/html", "html", await this.markdownToHtml(code));
    return;
  }

  async markdownToHtml(code: string) {
    const { marked } = await import("marked");
    const coreHTML = marked.parse(code);
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markdown Preview</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css" />
  <style>
body {
  padding: 1rem;
}
  </style>
</head>
<body class="markdown-body">
${coreHTML}
</body>
</html>
    `.trim();
  }
}
