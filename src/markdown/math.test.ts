import { Marked } from "marked";
import { describe, expect, it } from "vitest";
import { markedMathML } from "./math";

describe("markedMathML", () => {
  it("renders inline LaTeX as MathML within Markdown paragraphs", async () => {
    const marked = new Marked().use(markedMathML());

    const html = await marked.parse("The value is $x + 1$.");

    expect(html).toContain('<p>The value is <span class="katex"><math');
    expect(html).toContain("<mi>x</mi><mo>+</mo><mn>1</mn>");
    expect(html).toContain('<annotation encoding="application/x-tex">x + 1</annotation>');
    expect(html).toContain("</math></span>.</p>");
  });

  it("renders block LaTeX as display MathML between Markdown blocks", async () => {
    const marked = new Marked().use(markedMathML());

    const html = await marked.parse("Before\n\n$$\nx^2\n$$\n\nAfter");

    expect(html).toContain("<p>Before</p>");
    expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
    expect(html).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain("<p>After</p>");
  });

  it("renders inline LaTeX using \\(...\\) delimiters", async () => {
    const marked = new Marked().use(markedMathML());

    const html = await marked.parse("The value is \\(x + 1\\).");

    expect(html).toContain('<p>The value is <span class="katex"><math');
    expect(html).toContain("<mi>x</mi><mo>+</mo><mn>1</mn>");
    expect(html).toContain('<annotation encoding="application/x-tex">x + 1</annotation>');
    expect(html).toContain("</math></span>.</p>");
  });

  it("renders block LaTeX using \\[...\\] delimiters", async () => {
    const marked = new Marked().use(markedMathML());

    const html = await marked.parse("Before\n\n\\[\nx^2\n\\]\n\nAfter");

    expect(html).toContain("<p>Before</p>");
    expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
    expect(html).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain("<p>After</p>");
  });

  it("does not treat underscores or asterisks inside \\(...\\) math as emphasis", async () => {
    const marked = new Marked().use(markedMathML());

    const html = await marked.parse("Value \\(a_b * c\\) end");

    expect(html).not.toContain("<em>");
    expect(html).toContain('<annotation encoding="application/x-tex">a_b * c</annotation>');
  });
});
