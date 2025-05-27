/* Query and Mutation helpers */

export function $<K extends keyof HTMLElementTagNameMap>(selectors: K): HTMLElementTagNameMap[K] | null;
export function $<K extends keyof SVGElementTagNameMap>(selectors: K): SVGElementTagNameMap[K] | null;
export function $<K extends keyof MathMLElementTagNameMap>(selectors: K): MathMLElementTagNameMap[K] | null;
export function $<E extends Element = HTMLElement>(selectors: string): E | null;
export function $(selector: string) {
  return document.querySelector(selector);
}

export function $$<K extends keyof HTMLElementTagNameMap>(selectors: K): HTMLElementTagNameMap[K][];
export function $$<K extends keyof SVGElementTagNameMap>(selectors: K): SVGElementTagNameMap[K][];
export function $$<K extends keyof MathMLElementTagNameMap>(selectors: K): MathMLElementTagNameMap[K][];
export function $$<E extends Element = HTMLElement>(selectors: string): E[];
export function $$(selectors: string) {
  return Array.from(document.querySelectorAll(selectors));
}

// same to $ but throws error if not found
export function $get<K extends keyof HTMLElementTagNameMap>(selectors: K): HTMLElementTagNameMap[K];
export function $get<K extends keyof SVGElementTagNameMap>(selectors: K): SVGElementTagNameMap[K];
export function $get<K extends keyof MathMLElementTagNameMap>(selectors: K): MathMLElementTagNameMap[K];
export function $get<E extends Element = HTMLElement>(selectors: string): E;
export function $get(selectors: string) {
  const element = document.querySelector(selectors);
  if (element === null) {
    throw new Error(`Element not found: ${selectors}`);
  }
  return element;
}

export function $frag(literal: { raw: readonly string[] | ArrayLike<string> }, ...values: string[]) {
  const template = document.createElement("template");
  template.innerHTML = String.raw(literal, ...values);
  return template.content;
}

interface CreateElement {
  <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes?: Record<string, string>,
    children?: (HTMLElement | string)[],
  ): HTMLElementTagNameMap[K];
  <T extends HTMLElement>(tag: string, attributes?: Record<string, string>, children?: (HTMLElement | string)[]): T;
}

export const $new: CreateElement = (
  tag: string,
  attributes: Record<string, string> = {},
  children: (HTMLElement | string)[] = [],
) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  for (const child of children) {
    element.append(child);
  }
  return element;
};

export function insertAdacentElements(anchor: Element, elements: Element[], position: InsertPosition) {
  let currentAnchor = anchor;
  for (const element of elements) {
    currentAnchor.insertAdjacentElement(position, element);
    currentAnchor = element;
  }
}

/* Event processing */
export interface ParsedCommandEvent {
  event: Event;
  trigger?: HTMLElement;
  command?: string | null;
}

export function parseCommandEvent(e: Event): ParsedCommandEvent {
  const actionTrigger = (e.target as HTMLElement).closest("[data-command]");
  if (!actionTrigger)
    return {
      event: e,
    };

  const command = actionTrigger.getAttribute("data-command");
  return {
    event: e,
    trigger: actionTrigger as HTMLElement,
    command,
  };
}

export function preventDefault(e: Event) {
  e.preventDefault();
}

export function stopPropagation(e: Event) {
  e.stopPropagation();
}

export function getTargetValue(e: Event) {
  return (e.target as HTMLInputElement).value ?? "";
}

export function getEventDetail<T>(e: Event) {
  return (e as CustomEvent<T>).detail;
}

export interface KeyboardShortcut {
  /**
   * format: "[ctrl+][alt+][shift+]<event.key>"
   * event.key is all lowercase and with space spelt out as "space"
   * Reference: https://www.toptal.com/developers/keycode
   */
  combo: string;
  event: KeyboardEvent;
}

const MODIFIERS = ["Control", "Alt", "Shift", "Meta"];
export function isModifierKey(event: KeyboardEvent) {
  return MODIFIERS.includes(event.key);
}

export function parseKeyboardShortcut(event: KeyboardEvent): KeyboardShortcut | null {
  if (isModifierKey(event)) return null;

  const ctrlPrefix = event.metaKey || event.ctrlKey ? "ctrl+" : "";
  const altPrefix = event.altKey ? "alt+" : "";
  const shiftPrefix = event.shiftKey ? "shift+" : "";
  const key = event.key === " " ? "space" : event.key.toLocaleLowerCase();
  const combo = `${ctrlPrefix}${altPrefix}${shiftPrefix}${key}`;

  return { combo, event };
}

/* Shadow DOM */
export function attachShadowHtml(element: HTMLElement, html: string, options?: ShadowRootInit): ShadowRoot {
  const shadow = element.attachShadow(options ?? { mode: "open" });
  shadow.innerHTML = html;
  return shadow;
}
