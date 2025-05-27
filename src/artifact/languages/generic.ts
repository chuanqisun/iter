import { bundledLanguages } from "shiki/bundle/web";
import { saveTextFile } from "../lib/save-text-file";
import type { ArtifactContext, ArtifactSupport } from "./type";

const supportedLanguages = Object.keys(bundledLanguages);

export interface ArtifactEvents {
  attach: { lang: string; code: string; nodeId: string; filename?: string };
}

export class GenericArtifact implements ArtifactSupport {
  onResolveLanguage(lang: string): string | undefined {
    return supportedLanguages.includes(lang) ? lang : "text";
  }

  onSave({ lang, code }: ArtifactContext) {
    saveTextFile(`text/plain`, lang, code);
  }

  onAttach({ lang, code, nodeId, filename }: ArtifactContext) {
    if (!nodeId) throw new Error("No node ID found");

    window.dispatchEvent(
      new CustomEvent<ArtifactEvents["attach"]>("attach", { detail: { lang, code, nodeId, filename } }),
    );
  }
}
