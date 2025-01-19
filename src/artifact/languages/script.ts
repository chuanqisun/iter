import { createESPlayDocument } from "../lib/create-esplay-document";
import { embedFileAccessToDocument, injectIframeFileAccessToDocument } from "../lib/file-access";
import { toggleIframeRun } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import type { ArtifactContext } from "./type";

export class ScriptArtifact extends GenericArtifact {
  onResolveLanguage(lang: string): string | undefined {
    return ["typescript", "javascript", "jsx", "tsx"].includes(lang) ? lang : undefined;
  }

  onRun({ trigger, code }: ArtifactContext) {
    toggleIframeRun(trigger, injectIframeFileAccessToDocument(createESPlayDocument(code)));
  }

  async onSave({ code }: ArtifactContext) {
    saveTextFile("text/html", "html", await embedFileAccessToDocument(createESPlayDocument(code)));
  }
}
