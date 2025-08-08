import type { Element, Parent, Text } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Definition, Link, LinkReference, TableCell } from "mdast";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { u } from "unist-builder";
import { SKIP, visit } from "unist-util-visit";

const BLOCK_TAGS = new Set(["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
const LIST_TAGS = new Set(["li", "ul", "ol"]);
const REMOVABLE_WHEN_EMPTY = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "blockquote",
]);

const SPACES_PATTERN = /&nbsp;|[\u00A0\u2009\u200A\u2007\u2002\u2003\u2004\u2005\u2006\u2008\u2000\u2001]/g;

export async function htmlToMarkdown(html: string): Promise<string> {
  const preprocessedHtml = preprocessHtml(html);

  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypePrepare)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkTableCellCleanup)
    .use(remarkInlineLinksToFootnotes)
    .use(remarkStringify, {
      bullet: "-",
      fences: true,
      tightDefinitions: true,
      emphasis: "_",
      listItemIndent: "one",
    })
    .process(preprocessedHtml);

  return cleanup(String(file));
}

function preprocessHtml(html: string): string {
  const normalizedHtml = html.replace(SPACES_PATTERN, " ");

  return normalizedHtml.replace(/<a([^>]*)>(.*?)<\/a>/gs, (match, attributes, content) => {
    const contentWithExtractedSpaces = content.replace(/<[^>]*>(\s+)<\/[^>]*>/g, "$1");
    const leadingSpaces = contentWithExtractedSpaces.match(/^(\s+)/);
    const trailingSpaces = contentWithExtractedSpaces.match(/(\s+)$/);
    const trimmedContent = contentWithExtractedSpaces.replace(/^\s+|\s+$/g, "");

    if (!trimmedContent) return match;

    const leadingSpace = leadingSpaces ? " " : "";
    const trailingSpace = trailingSpaces ? " " : "";
    return `${leadingSpace}<a${attributes}>${trimmedContent}</a>${trailingSpace}`;
  });
}

function rehypePrepare() {
  return (tree: any) => {
    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent) => {
      if (!parent || typeof index !== "number") {
        if (node.tagName === "li" && Array.isArray(node.children)) {
          node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        }
        if (isTableCell(node) && Array.isArray(node.children)) {
          node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
          compressTextWhitespace(node.children);
        }
        return;
      }

      if (node.tagName === "img" || node.tagName === "svg") {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }

      if (node.tagName === "a" && Array.isArray(node.children)) {
        return processLinkElement(node, index, parent);
      }

      if (node.tagName === "li" && Array.isArray(node.children)) {
        node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        if (shouldRemoveEmptyElement(node)) {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
        return;
      }

      if (isTableCell(node) && Array.isArray(node.children)) {
        node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        compressTextWhitespace(node.children);
        return;
      }

      if (shouldRemoveEmptyElement(node)) {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
    });
  };
}

function remarkTableCellCleanup() {
  return (tree: any) => {
    visit(tree, "tableCell", (cell: TableCell) => {
      const textContent = extractTextContent(cell);
      if (textContent) {
        const cleaned = textContent.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
        cell.children = cleaned ? [{ type: "text", value: cleaned }] : [];
      }
    });
  };
}

function remarkInlineLinksToFootnotes() {
  return (tree: any) => {
    const urlToId = new Map<string, string>();
    let nextId = 1;

    visit(tree, "definition", (node: Definition) => {
      const n = parseInt(node.identifier, 10);
      if (!Number.isNaN(n)) nextId = Math.max(nextId, n + 1);
      if (node.url && !urlToId.has(node.url)) urlToId.set(node.url, node.identifier);
    });

    visit(tree, "link", (node: Link, index: number | undefined, parent: Parent) => {
      if (!parent || typeof index !== "number") return;
      const url = node.url || "";
      if (!url) return;

      const linkText = extractTextContent(node);
      if (!linkText) {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }

      let id = urlToId.get(url);
      if (!id) {
        id = String(nextId++);
        urlToId.set(url, id);
      }

      parent.children.splice(index, 1, {
        type: "linkReference",
        identifier: id,
        referenceType: "full",
        children: node.children || [],
      } as LinkReference as any);

      if (!tree.data) tree.data = {};
      if (!tree.data.__defs) tree.data.__defs = new Map();
      const defs: Map<string, { url: string; title: string | null }> = tree.data.__defs;
      if (!defs.has(id)) defs.set(id, { url, title: node.title || null });
    });

    const defs: Map<string, { url: string; title: string | null }> = (tree.data && tree.data.__defs) || new Map();
    if (defs.size > 0) {
      const defNodes = Array.from(defs.entries()).map(([identifier, { url, title }]) =>
        (u as any)("definition", { identifier, url, title: title || null }),
      );
      if (!Array.isArray(tree.children)) tree.children = [];
      tree.children.push(...defNodes);
    }
  };
}

function cleanup(s: string): string {
  return s
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCharCode(parseInt(decimal, 10)))
    .trim();
}

function isElement(node: any): node is Element {
  return node && node.type === "element";
}

function isTableCell(node: Element): boolean {
  return node.tagName === "td" || node.tagName === "th";
}

function unwrapChildren(children: any[], shouldUnwrap: (child: any) => boolean): any[] {
  return children.flatMap((child) => {
    if (isElement(child) && shouldUnwrap(child)) {
      return Array.isArray(child.children) ? child.children : [];
    }
    return [child];
  });
}

function compressTextWhitespace(children: any[]): void {
  for (const ch of children) {
    if (ch?.type === "text" && typeof ch.value === "string") {
      ch.value = ch.value.replace(/\s+/g, " ").trim();
    }
  }
}

function processLinkElement(node: Element, index: number, parent: Parent): [typeof SKIP, number] | void {
  node.children = unwrapChildren(node.children!, (c) => BLOCK_TAGS.has(c.tagName) || LIST_TAGS.has(c.tagName));
  const text = (hastToString as any)(node).replace(/\s+/g, " ").trim();
  const href = node.properties?.href;

  if (!href || (typeof href === "string" && !href.trim())) {
    if (text) {
      parent.children.splice(index, 1, { type: "text", value: text });
    } else {
      parent.children.splice(index, 1);
    }
    return [SKIP, index];
  }

  if (text) {
    node.children = [{ type: "text", value: text }];
  } else {
    parent.children.splice(index, 1);
    return [SKIP, index];
  }
}

function shouldRemoveEmptyElement(node: Element): boolean {
  if (!REMOVABLE_WHEN_EMPTY.has(node.tagName)) return false;
  const text = (hastToString as any)(node).replace(/\s+/g, " ");
  return !text;
}

function extractTextContent(node: any): string {
  const parts: string[] = [];
  visit(node, "text", (n: Text) => {
    parts.push(n.value || "");
  });
  return parts.join("").trim();
}
