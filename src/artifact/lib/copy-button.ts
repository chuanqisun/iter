const timers = new WeakMap<Element, number>();

export async function copy(trigger: HTMLElement, code: string) {
  return navigator.clipboard.writeText(code).then(() => {
    trigger.classList.add("copied");
    const previousTimer = timers.get(trigger);
    if (previousTimer) clearTimeout(previousTimer);

    timers.set(
      trigger,
      window.setTimeout(() => trigger.classList.remove("copied"), 3000),
    );
  });
}
