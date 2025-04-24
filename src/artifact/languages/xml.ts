import { embedFileAccessToDocument, injectIframeFileAccessToDocument } from "../lib/file-access";
import { runIframe } from "../lib/run-iframe";
import { saveTextFile } from "../lib/save-text-file";
import { GenericArtifact } from "./generic";
import { xmlLanguages } from "./runnable-languages";
import type { ArtifactContext } from "./type";

const extensionToMimeType: Record<string, string> = {
  html: "text/html",
  xml: "text/xml",
  svg: "image/svg+xml",
};

export class XmlArtifact extends GenericArtifact {
  onResolveLanguage(lang: string) {
    return xmlLanguages.includes(lang) ? lang : undefined;
  }

  onRun({ trigger, code, lang }: ArtifactContext) {
    return lang === "html" ? runIframe(trigger, injectIframeFileAccessToDocument(code)) : runIframe(trigger, code);
  }

  async onSave({ lang, code }: ArtifactContext) {
    return lang === "html"
      ? saveTextFile(extensionToMimeType[lang], lang, await embedFileAccessToDocument(code))
      : saveTextFile(extensionToMimeType[lang], lang, code);
  }
}
