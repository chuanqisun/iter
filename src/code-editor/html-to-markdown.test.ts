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

  it("should combine multiple nbsp as single regular space", async () => {
    const html = "<p>Word1&nbsp;Word2&nbsp;&nbsp;Word3</p>";
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Word1 Word2 Word3");
    expect(result).not.toContain("&nbsp;");
  });

  it("should handle nested elements with nbsp and whitespace normalization", async () => {
    const html = `<span>ward</span>&nbsp;<em><strong>aletheia</strong></em><span> the anci</span>`;
    const result = await htmlToMarkdown(html);
    expect(result).toBe("ward _**aletheia**_ the anci");
    expect(result).not.toContain("&");
  });

  it("should handle clipboard dirty data", async () => {
    const html = `
<span style="color: rgb(0, 0, 0); font-family: &quot;Times New Roman&quot;; font-size: medium; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; display: inline !important; float: none;">rd</span><span style="color: rgb(0, 0, 0); font-family: &quot;Times New Roman&quot;; font-size: medium; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial;"><em><strong>ale</strong></em></span>
`;
    const result = await htmlToMarkdown(html);
    expect(result).toBe("rd_**ale**_");
    expect(result).not.toContain("&");
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

  it("should remove links that wrap images", async () => {
    const html =
      '<p>Text <a><svg xmlns="http://www.w3.org/2000/svg"></svg></a> and <a><img src="https://placehold.co/400"></a> more text</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Text and more text");
    expect(result).not.toContain("[][1]");
    expect(result).not.toContain("[1]:");
  });

  it("should convert links without href to plain text", async () => {
    const html = "<p>Some text <a>click here</a> more text</p>";
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Some text click here more text");
    expect(result).not.toContain("[click here]");
  });

  it("should convert links with empty href to plain text", async () => {
    const html = '<p>Some text <a href="">click here</a> more text</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Some text click here more text");
    expect(result).not.toContain("[click here]");
  });

  it("should remove headings that wrap only images", async () => {
    const html =
      '<h1><img src="test.jpg" alt="logo"></h1><h2><svg xmlns="http://www.w3.org/2000/svg"></svg></h2><p>Content</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("Content");
    expect(result).not.toContain("#");
  });

  it("should preserve headings with text content even if they contain images", async () => {
    const html = '<h1>Title <img src="test.jpg" alt="logo"> Text</h1><p>Content</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("# Title Text\n\nContent");
  });

  it("should remove various empty elements", async () => {
    const html =
      '<p></p><div></div><strong></strong><em><img src="test.jpg"></em><span>   </span><h2>Real heading</h2>';
    const result = await htmlToMarkdown(html);
    expect(result).toBe("## Real heading");
  });

  it("should preserve spaces in links with nested elements", async () => {
    const html = '<span>see</span> <a href="https://example.com"><span> </span>Sherry</a>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("see [Sherry][1]");
  });

  it("should extract leading and trailing spaces from links", async () => {
    const html = '<p>Before<a href="https://example.com"> link text </a>after</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Before [link text][1] after");
    expect(result).toContain("[1]: https://example.com");
  });

  it("should extract and merge spaces from multiple links", async () => {
    const html =
      '<p>Word1<a href="https://example.com"> link1 </a>middle<a href="https://example2.com"> link2 </a>word2</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Word1 [link1][1] middle [link2][2] word2");
    expect(result).toContain("[1]: https://example.com");
    expect(result).toContain("[2]: https://example2.com");
  });

  it("should handle links with only leading spaces", async () => {
    const html = '<p>Before<a href="https://example.com"> link</a>after</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Before [link][1]after");
    expect(result).toContain("[1]: https://example.com");
  });

  it("should handle links with only leading spaces in &nbsp;", async () => {
    const html = '<p>Before<a href="https://example.com"><span>&nbsp;</span>link</a>after</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Before [link][1]after");
    expect(result).toContain("[1]: https://example.com");
  });

  it("should handle links with only trailing spaces", async () => {
    const html = '<p>Before<a href="https://example.com">link </a>after</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Before[link][1] after");
    expect(result).toContain("[1]: https://example.com");
  });

  it("should handle nested elements within links with spaces", async () => {
    const html = '<p>Text<a href="https://example.com"> <strong>bold</strong> <em>italic</em> </a>more</p>';
    const result = await htmlToMarkdown(html);
    expect(result).toContain("Text [bold italic][1] more");
    expect(result).toContain("[1]: https://example.com");
  });
});
