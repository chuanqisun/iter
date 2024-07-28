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
  onMatchLanguage(lang: string): boolean {
    return ["html", "xml", "svg"].includes(lang);
  }

  onRun({ trigger, code }: ArtifactContext) {
    runIframe(trigger, code);
  }

  onSave({ lang, code }: ArtifactContext) {
    saveTextFile(extensionToMimeType[lang], lang, code);
  }
}
