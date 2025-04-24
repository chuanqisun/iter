import { bundledLanguages } from "shiki/bundle/web";
import { saveTextFile } from "../lib/save-text-file";
import type { ArtifactContext, ArtifactSupport } from "./type";

const supportedLanguages = Object.keys(bundledLanguages);
const timers = new WeakMap<Element, number>();

export class GenericArtifact implements ArtifactSupport {
  onResolveLanguage(lang: string): string | undefined {
    return supportedLanguages.includes(lang) ? lang : "text";
  }

  onCopy({ trigger, code }: ArtifactContext) {
    navigator.clipboard.writeText(code);
    trigger.classList.add("copied");
    const previousTimer = timers.get(trigger);
    if (previousTimer) clearTimeout(previousTimer);

    timers.set(
      trigger,
      window.setTimeout(() => trigger.classList.remove("copied"), 3000),
    );
  }

  onSave({ lang, code }: ArtifactContext) {
    saveTextFile(`text/plain`, lang, code);
  }
}
