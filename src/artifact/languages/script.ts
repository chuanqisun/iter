import { createESPlayDocument } from "../lib/create-esplay-document";
import { injectDirectivesRuntimeAPIToDocument, injectDirectivesStaticAPIToDocument } from "../lib/directives";
import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { scriptingLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

export class ScriptArtifact extends GenericArtifact {
  onResolveLanguage(lang: string): string | undefined {
    return scriptingLanguages.includes(lang) ? lang : undefined;
  }

  onRun({ preview, code }: ArtifactContext) {
    runIframe(preview, injectDirectivesRuntimeAPIToDocument(createESPlayDocument(code)));
  }

  async onSave({ code }: ArtifactContext) {
    saveTextFile("text/html", "html", await injectDirectivesStaticAPIToDocument(createESPlayDocument(code)));
  }
}
