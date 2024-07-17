import { h } from "hastscript";
import type { ShikiTransformer } from "shiki";

/**
 * Adapted from github.com/joshnuss/shiki-transformer-copy-button
 * Converted to typescript
 * Author: Joshnuss
 */
export function addCopyButton(): ShikiTransformer {
  return {
    name: "shiki-transformer-copy-button",
    pre(node) {
      const button = h(
        "button",
        {
          class: "copy",
          "data-copy": "",
        },
        [h("span", { class: "ready" }, ["Copy"]), h("span", { class: "success" }, ["✅ Copied"])]
      );

      node.children.push(button);
    },
  };
}

const timers = new WeakMap<Element, number>();
export function handleCopyClickEvent(event: MouseEvent) {
  const trigger = (event.target as HTMLElement).closest("[data-copy]");
  const code = trigger?.closest("pre")?.querySelector("code")?.textContent;
  if (code) {
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
