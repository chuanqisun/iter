import { h } from "hastscript";
import type { ShikiTransformer } from "shiki";
import { css } from "styled-components";

/**
 * Adapted from github.com/joshnuss/shiki-transformer-copy-button
 * Converted to typescript
 * Author: Joshnuss
 */
export function codeBlockAction(): ShikiTransformer {
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

export const copyActionStyles = css`
  [data-copy] {
    font-size: 12px;
    padding: 0 4px;
    position: absolute;
    top: 6px;
    right: 6px;
    opacity: 0.5;
    cursor: pointer;

    &:not(.copied) {
      &:hover {
        opacity: 1;
      }
      .success {
        display: none;
      }
    }
    &.copied {
      opacity: 1;

      .ready {
        display: none;
      }
    }
  }
`;

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
