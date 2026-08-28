import { history, redo, undo } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Clipboard } from "./clipboard";

let originalDocument: any;
let originalWindow: any;
let originalMutationObserver: any;
let originalWindowConstructor: any;

beforeAll(() => {
  originalDocument = globalThis.document;
  originalWindow = globalThis.window;
  originalMutationObserver = (globalThis as any).MutationObserver;
  originalWindowConstructor = (globalThis as any).Window;

  class MockWindow {}
  (globalThis as any).Window = MockWindow;

  class MockMutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  (globalThis as any).MutationObserver = MockMutationObserver;

  const createMockElement = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      style: {},
      attributes: [],
      setAttribute: vi.fn((name, value) => {
        el.attributes.push({ name, value });
      }),
      getAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      appendChild: vi.fn((child) => child),
      removeChild: vi.fn((child) => child),
      insertBefore: vi.fn((child) => child),
      replaceChild: vi.fn((child) => child),
      remove: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      contains: () => true,
      ownerDocument: mockDoc,
      childNodes: [],
      children: [],
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: () => false,
      },
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      getClientRects: () => [],
    };
    return el;
  };

  const mockDoc: any = {
    createElement: createMockElement,
    createTextNode: (text: string) => ({
      nodeType: 3,
      nodeValue: text,
      textContent: text,
      ownerDocument: mockDoc,
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      getClientRects: () => [],
    }),
    createRange: () => ({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getClientRects: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    hasFocus: () => false,
    nodeType: 9,
    documentElement: {
      style: {},
      ownerDocument: null as any,
    },
    body: {
      style: {},
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      ownerDocument: null as any,
    },
  };
  mockDoc.documentElement = createMockElement("html");
  mockDoc.head = createMockElement("head");
  mockDoc.body = createMockElement("body");
  mockDoc.head.ownerDocument = mockDoc;
  mockDoc.body.ownerDocument = mockDoc;
  mockDoc.documentElement.ownerDocument = mockDoc;
  mockDoc.documentElement.appendChild(mockDoc.head);
  mockDoc.documentElement.appendChild(mockDoc.body);

  const mockWin: any = {
    document: mockDoc,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    getComputedStyle: () => ({
      getPropertyValue: () => "",
    }),
    getSelection: () => ({
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      rangeCount: 0,
      getRangeAt: () => null,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    }),
  };
  mockDoc.defaultView = mockWin;
  mockDoc.getSelection = mockWin.getSelection;

  globalThis.document = mockDoc;
  globalThis.window = mockWin;
});

afterAll(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  (globalThis as any).MutationObserver = originalMutationObserver;
  (globalThis as any).Window = originalWindowConstructor;
});

function getPasteHandler() {
  const ext = Clipboard() as any;
  return ext.domEventHandlers?.paste;
}

function createEditorView(initialDoc = ""): EditorView {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [history()],
  });
  return new EditorView({
    state,
  });
}

function createFakeClipboardEvent(
  plainText: string,
  html?: string,
): { event: any; htmlItem?: { type: string; getAsString: (cb: (data: string) => void) => void } } {
  let htmlItem: { type: string; getAsString: (cb: (data: string) => void) => void } | undefined;
  const items: any[] = [];

  if (html !== undefined) {
    htmlItem = {
      type: "text/html",
      getAsString: (cb: (data: string) => void) => {
        cb(html);
      },
    };
    items.push(htmlItem);
  }

  const clipboardData = {
    items,
    getData: (format: string) => {
      if (format === "text/plain") return plainText;
      if (format === "text/html") return html ?? "";
      return "";
    },
  };

  const event = {
    clipboardData,
    preventDefault: vi.fn(),
  };

  return { event, htmlItem };
}

describe("Clipboard extension paste handler", () => {
  it("should support two-step undo for multi-format paste (markdown !== plainText)", async () => {
    const view = createEditorView("Start: ");
    view.dispatch({ selection: { anchor: 7, head: 7 } });

    const html = "<p>Hello <strong>world</strong>!</p>";
    const plainText = "Hello world!";

    const { event } = createFakeClipboardEvent(plainText, html);
    const pasteHandler = getPasteHandler();

    const handled = pasteHandler(event as any, view);
    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();

    // Allow async microtasks/promises to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // After paste: should contain Markdown
    expect(view.state.doc.toString()).toBe("Start: Hello **world**!");

    // Step 1 undo: should revert to Plain Text
    undo(view);
    expect(view.state.doc.toString()).toBe("Start: Hello world!");

    // Step 2 undo: should revert to initial doc
    undo(view);
    expect(view.state.doc.toString()).toBe("Start: ");

    // Step 1 redo: should redo to Plain Text
    redo(view);
    expect(view.state.doc.toString()).toBe("Start: Hello world!");

    // Step 2 redo: should redo to Markdown
    redo(view);
    expect(view.state.doc.toString()).toBe("Start: Hello **world**!");

    view.destroy();
  });

  it("should support single-step undo when markdown === plainText", async () => {
    const view = createEditorView("Prefix: ");
    view.dispatch({ selection: { anchor: 8, head: 8 } });

    const html = "<p>Simple text</p>";
    const plainText = "Simple text";

    const { event } = createFakeClipboardEvent(plainText, html);
    const pasteHandler = getPasteHandler();

    const handled = pasteHandler(event as any, view);
    expect(handled).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(view.state.doc.toString()).toBe("Prefix: Simple text");

    // Single undo reverts to pre-paste state
    undo(view);
    expect(view.state.doc.toString()).toBe("Prefix: ");

    view.destroy();
  });

  it("createPasteSpecSteps produces single step when markdown matches plain text", async () => {
    const { createPasteSpecSteps } = await import("./clipboard");
    const steps = createPasteSpecSteps(5, 5, { plainText: "same", formattedText: "same" });
    expect(steps).toHaveLength(1);
    expect(steps[0].changes).toEqual({ from: 5, to: 5, insert: "same" });
  });

  it("createPasteSpecSteps produces two steps when markdown differs from plain text", async () => {
    const { createPasteSpecSteps } = await import("./clipboard");
    const steps = createPasteSpecSteps(2, 4, { plainText: "plain text", formattedText: "**plain text**" });
    expect(steps).toHaveLength(2);
    expect(steps[0].changes).toEqual({ from: 2, to: 4, insert: "plain text" });
    expect(steps[1].changes).toEqual({ from: 2, to: 2 + "plain text".length, insert: "**plain text**" });
  });

  it("should ignore paste event when no text/html item is present", async () => {
    const view = createEditorView("Initial");
    const { event } = createFakeClipboardEvent("Plain text only");
    const pasteHandler = getPasteHandler();

    const handled = pasteHandler(event as any, view);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(handled).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe("Initial");

    view.destroy();
  });
});
