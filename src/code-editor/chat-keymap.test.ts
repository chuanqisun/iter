import type { EditorView } from "@codemirror/view";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { CodeEditorElement } from "./code-editor-element";
import { chatKeymap } from "./chat-keymap";

function getPasteTextAsAttachmentBinding() {
  const dispatchEvent = vi.fn();
  const eventTarget = { dispatchEvent } as unknown as CodeEditorElement;
  const binding = chatKeymap(eventTarget, new Subject<string>())[0];
  return { binding, dispatchEvent };
}

function createEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    altKey: false,
    ctrlKey: true,
    key: "v",
    metaKey: false,
    repeat: false,
    shiftKey: true,
    ...overrides,
  } as KeyboardEvent;
}

describe("paste text as attachment key binding", () => {
  it("uses CodeMirror's platform-specific Mod-Shift-V bindings", () => {
    const { binding } = getPasteTextAsAttachmentBinding();

    expect(binding.key).toBe("Ctrl-Shift-v");
    expect(binding.mac).toBe("Meta-Shift-v");
  });

  it("dispatches the semantic editor event and handles the key", () => {
    const { binding, dispatchEvent } = getPasteTextAsAttachmentBinding();

    expect(binding.run?.({} as EditorView)).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe("pastetextasattachment");
  });

  it.each([{ ctrlKey: true }, { ctrlKey: false, metaKey: true }])("consumes repeated Mod-Shift-V", (modifiers) => {
    const { binding } = getPasteTextAsAttachmentBinding();

    expect(binding.any?.({} as EditorView, createEvent({ ...modifiers, repeat: true }))).toBe(true);
  });

  it.each([
    { repeat: false },
    { ctrlKey: false },
    { shiftKey: false, repeat: true },
    { altKey: true, repeat: true },
    { key: "x", repeat: true },
  ])("does not consume unrelated key events", (overrides) => {
    const { binding } = getPasteTextAsAttachmentBinding();

    expect(binding.any?.({} as EditorView, createEvent(overrides))).toBe(false);
  });
});
