import { embedFileAccessToDocument, injectIframeFileAccessToDocument } from "../lib/file-access";
import { toggleIframeRun } from "../lib/run-iframe";
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

  onRun({ trigger, code, lang }: ArtifactContext) {
    return lang === "html" ? toggleIframeRun(trigger, injectIframeFileAccessToDocument(code)) : toggleIframeRun(trigger, code);
  }

  async onSave({ lang, code }: ArtifactContext) {
    return lang === "html"
      ? saveTextFile(extensionToMimeType[lang], lang, await embedFileAccessToDocument(code))
      : saveTextFile(extensionToMimeType[lang], lang, code);
  }
}
