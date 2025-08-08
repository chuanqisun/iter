import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./html-to-markdown";

describe("htmlToMarkdown", () => {
  it("should convert basic HTML to markdown", async () => {
    const html = "<p>Hello <strong>world</strong>!</p>";
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Hello **world**!");
  });

  it("should handle headings", async () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2>";
    const result = await htmlToMarkdown(html);
    expect(result).toBe("# Title\n\n## Subtitle");
  });

  it("should convert lists", async () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    const result = await htmlToMarkdown(html);
    expect(result).toContain("- Item 1");
    expect(result).toContain("- Item 2");
  });

  it("should handle links and convert to footnotes", async () => {
    const html = '<p>Check out <a href="https://example.com">this link</a></p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("[this link][1]");
    expect(result).toContain("[1]: https://example.com");
  });

  it("should handle tables", async () => {
    const html = "<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>";
    const result = await htmlToMarkdown(html);
    expect(result).toContain("| Header |");
    expect(result).toContain("| Cell   |");
  });

  it("should remove images and SVGs", async () => {
    const html = '<p>Text <img src="test.jpg" alt="test"> more text</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Text more text");
  });

  it("should replace non-breaking spaces", async () => {
    const html = "<p>Text&nbsp;with&nbsp;nbsp</p>";
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Text with nbsp");
  });

  it("should handle empty input", async () => {
    const result = await htmlToMarkdown("");
    expect(result).toBe("");
  });

  it("should clean up excessive newlines", async () => {
    const html = "<p>Para 1</p><br><br><br><p>Para 2</p>";
    const result = await htmlToMarkdown(html);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("should remove links with empty text", async () => {
    const html = '<p>Some text <a href="https://example.com"></a> more text</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Some text more text");
    expect(result).not.toContain("[][1]");
    expect(result).not.toContain("[1]: https://example.com");
  });

  it("should remove links with whitespace-only text", async () => {
    const html = '<p>Some text <a href="https://example.com">   </a> more text</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Some text more text");
    expect(result).not.toContain("[][1]");
    expect(result).not.toContain("[1]: https://example.com");
  });
});
