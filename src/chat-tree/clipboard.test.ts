import { describe, expect, it, vi } from "vitest";
import { readClipboardTextAttachment } from "./clipboard";

function clipboardItem(data: Record<string, string>): ClipboardItem {
  return {
    types: Object.keys(data),
    getType: vi.fn(async (type: string) => new Blob([data[type]], { type })),
  } as unknown as ClipboardItem;
}

function mockClipboard(...items: ClipboardItem[]) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { read: vi.fn(async () => items) } },
  });
}

describe("readClipboardTextAttachment", () => {
  it("prefers Markdown content", async () => {
    mockClipboard(clipboardItem({ "text/plain": "plain", "text/html": "<b>html</b>", "text/markdown": "**md**" }));

    await expect(readClipboardTextAttachment()).resolves.toEqual({ filename: "filename.md", text: "**md**" });
  });

  it("uses the plain representation of HTML", async () => {
    mockClipboard(clipboardItem({ "text/plain": "formatted text", "text/html": "<b>formatted text</b>" }));

    await expect(readClipboardTextAttachment()).resolves.toEqual({ filename: "filename.md", text: "formatted text" });
  });

  it("reads plain-text-only content", async () => {
    mockClipboard(clipboardItem({ "text/plain": "plain" }));

    await expect(readClipboardTextAttachment()).resolves.toEqual({ filename: "filename.txt", text: "plain" });
  });

  it("returns nothing for empty or unsupported content", async () => {
    mockClipboard(clipboardItem({ "text/plain": "" }));
    await expect(readClipboardTextAttachment()).resolves.toBeUndefined();

    mockClipboard(clipboardItem({ "image/png": "image" }));
    await expect(readClipboardTextAttachment()).resolves.toBeUndefined();
  });
});
