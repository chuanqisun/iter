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

export async function htmlToMarkdown(html: string): Promise<string> {
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
      listItemIndent: "one",
    })
    .process(html);

  return cleanup(String(file));
}

const BLOCK_TAGS = new Set(["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
const LIST_TAGS = new Set(["li", "ul", "ol"]);

function isElement(node: any): node is { type: "element"; tagName: string; children?: any[] } {
  return node && node.type === "element";
}

function unwrapChildren(children: any[], shouldUnwrap: (child: any) => boolean): any[] {
  return children.flatMap((child) => {
    if (isElement(child) && shouldUnwrap(child)) {
      return Array.isArray(child.children) ? child.children : [];
    }
    return [child];
  });
}

function compressTextChildrenWhitespace(children: any[]): void {
  for (const ch of children) {
    if (ch?.type === "text" && typeof ch.value === "string") {
      ch.value = ch.value.replace(/\s+/g, " ").trim();
    }
  }
}

function rehypePrepare() {
  return (tree: any) => {
    // Replace non-breaking spaces in text nodes
    visit(tree, "text", (node: Text) => {
      if (typeof node.value === "string") {
        node.value = node.value.replace(/\u00A0|&nbsp;/g, " ");
      }
    });

    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent) => {
      if (!parent || typeof index !== "number") {
        // For operations below we only act when parent/index are available.
        // Still traverse into children for further matches.
        if (node.tagName === "li" && Array.isArray(node.children)) {
          node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        }
        if (node.tagName === "a" && Array.isArray(node.children)) {
          node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName) || LIST_TAGS.has(c.tagName));
          const text = (hastToString as any)(node).replace(/\s+/g, " ").trim();
          node.children = text ? [{ type: "text", value: text }] : [];
        }
        if ((node.tagName === "td" || node.tagName === "th") && Array.isArray(node.children)) {
          node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
          compressTextChildrenWhitespace(node.children);
        }
        return;
      }

      // Remove <img> and <svg>
      if (node.tagName === "img" || node.tagName === "svg") {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }

      // Inline block elements inside <li> to compress lists
      if (node.tagName === "li" && Array.isArray(node.children)) {
        node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        return;
      }

      // Inline block or list elements inside <a> and compress link text whitespace
      if (node.tagName === "a" && Array.isArray(node.children)) {
        node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName) || LIST_TAGS.has(c.tagName));
        const text = (hastToString as any)(node).replace(/\s+/g, " ").trim();
        node.children = text ? [{ type: "text", value: text }] : [];
        return;
      }

      // Tidy table cell content: unwrap blocks and compress whitespace
      if ((node.tagName === "td" || node.tagName === "th") && Array.isArray(node.children)) {
        node.children = unwrapChildren(node.children, (c) => BLOCK_TAGS.has(c.tagName));
        compressTextChildrenWhitespace(node.children);
      }
    });
  };
}

function remarkTableCellCleanup() {
  return (tree: any) => {
    visit(tree, "tableCell", (cell: TableCell) => {
      const parts: string[] = [];
      visit(cell, "text", (n: Text) => {
        parts.push(n.value || "");
      });
      if (parts.length > 0) {
        const combined = parts.join(" ").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
        cell.children = combined ? [{ type: "text", value: combined }] : [];
      }
    });
  };
}

function getLinkText(node: Link): string {
  const parts: string[] = [];
  visit(node, "text", (n: Text) => {
    parts.push(n.value || "");
  });
  return parts.join("").trim();
}

function remarkInlineLinksToFootnotes() {
  return (tree: any) => {
    const urlToId = new Map<string, string>();
    let nextId = 1;

    // Collect existing definitions to avoid id collisions
    visit(tree, "definition", (node: Definition) => {
      const n = parseInt(node.identifier, 10);
      if (!Number.isNaN(n)) nextId = Math.max(nextId, n + 1);
      if (node.url && !urlToId.has(node.url)) urlToId.set(node.url, node.identifier);
    });
    visit(tree, "link", (node: Link, index: number | undefined, parent: Parent) => {
      if (!parent || typeof index !== "number") return;
      const url = node.url || "";
      if (!url) return;

      // Check if link has meaningful text content
      const linkText = getLinkText(node);
      if (!linkText) {
        // Remove empty links entirely
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

    // Append definitions at end
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
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
