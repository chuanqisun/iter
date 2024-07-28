import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import type { ArtifactContext } from "./type";

const extensionToMimeType: Record<string, string> = {
  html: "text/html",
  xml: "text/xml",
  svg: "image/svg+xml",
};

export class XmlArtifact extends GenericArtifact {
  onResolveLanguage(lang: string) {
    return ["html", "xml", "svg"].includes(lang) ? lang : undefined;
  }

  onRun({ trigger, code }: ArtifactContext) {
    runIframe(trigger, code);
  }

  onSave({ lang, code }: ArtifactContext) {
    saveTextFile(extensionToMimeType[lang], lang, code);
  }
}
