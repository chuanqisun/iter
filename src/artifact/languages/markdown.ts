import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { markdownLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

export class MarkdownArtifact extends GenericArtifact {
  onResolveLanguage(lang: string) {
    return markdownLanguages.includes(lang) ? lang : undefined;
  }

  async onRun({ trigger, preview, code }: ArtifactContext) {
    return runIframe(trigger, preview, await this.markdownToHtml(code));
  }

  async onSave({ code }: ArtifactContext) {
    saveTextFile("text/markdown", "md", code);
    saveTextFile("text/html", "html", await this.markdownToHtml(code));
    return;
  }

  async markdownToHtml(code: string) {
    const { marked } = await import("marked");
    return marked.parse(code);
  }
}
