import type { ArtifactContext, ArtifactSupport } from "./type";

const timers = new WeakMap<Element, number>();

export class GenericArtifact implements ArtifactSupport {
  onMatchLanguage(_lang: string) {
    return true;
  }

  onCopy({ trigger, code }: ArtifactContext) {
    navigator.clipboard.writeText(code);
    trigger.classList.add("copied");
    const previousTimer = timers.get(trigger);
    if (previousTimer) clearTimeout(previousTimer);

    timers.set(
      trigger,
      setTimeout(() => trigger.classList.remove("copied"), 3000)
    );
  }
}
