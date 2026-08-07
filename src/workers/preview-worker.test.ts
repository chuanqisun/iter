import { Marked } from "marked";
import { describe, expect, it } from "vitest";
import xss, { escapeAttrValue, whiteList } from "xss";
import { mathMLWhiteList } from "../markdown/math";

function sanitize(dirtyHtml: string) {
  return xss(dirtyHtml, {
    whiteList: {
      ...whiteList,
      ...mathMLWhiteList,
      button: ["data-action", "class", "type", "aria-label", "aria-expanded"],
      div: ["class"],
      span: ["class"],
      pre: ["class", "style"],
      ol: ["start"],
      input: ["type", "checked", "disabled", "class", "aria-label", "name", "value", "id"],
    },
    onIgnoreTag: function (tag, html, _options) {
      if (tag.startsWith("artifact-")) return html;
    },
    onIgnoreTagAttr: function (_tag, name, value, _isWhiteAttr) {
      if (name === "style") {
        return name + '="' + escapeAttrValue(value) + '"';
      }
      if (name === "tabindex") {
        return name + '="' + escapeAttrValue(value) + '"';
      }
    },
  });
}

describe("preview HTML sanitization", () => {
  it('allows raw <input type="checkbox"> in preview HTML', async () => {
    const markdown = 'Task: <input type="checkbox"> todo <input type="checkbox" checked>';
    const dirtyHtml = await new Marked().parse(markdown);
    const cleanHtml = sanitize(dirtyHtml);

    expect(cleanHtml).toContain('<input type="checkbox">');
    expect(cleanHtml).toContain('<input type="checkbox" checked');
  });

  it("allows markdown task list checkboxes", async () => {
    const markdown = "- [ ] Unchecked task\n- [x] Checked task";
    const dirtyHtml = await new Marked().parse(markdown);
    const cleanHtml = sanitize(dirtyHtml);

    expect(cleanHtml).toContain('type="checkbox"');
    expect(cleanHtml).toContain("Unchecked task");
    expect(cleanHtml).toContain("Checked task");
  });
});
