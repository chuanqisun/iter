import { createESPlayDocument } from "../lib/create-esplay-document";
import { embedFileAccessToDocument, injectIframeFileAccessToDocument } from "../lib/file-access";
import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { scriptingLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

export class ScriptArtifact extends GenericArtifact {
  onResolveLanguage(lang: string): string | undefined {
    return scriptingLanguages.includes(lang) ? lang : undefined;
  }

  onRun({ trigger, code }: ArtifactContext) {
    runIframe(trigger, injectIframeFileAccessToDocument(createESPlayDocument(code)));
  }

  async onSave({ code }: ArtifactContext) {
    saveTextFile("text/html", "html", await embedFileAccessToDocument(createESPlayDocument(code)));
  }
}
