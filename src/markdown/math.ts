// marked-mathml.js
import katex, { type KatexOptions } from "katex";
import type { MarkedExtension, RendererExtension, TokenizerExtension } from "marked";

// This allowlist mirrors the MathML emitted by KaTeX with `output: "mathml"`.
// Element names come from KaTeX's `MathNodeType` in `src/mathMLTree.ts`, while
// attributes come from its `MathNode#setAttribute()` call sites. When upgrading
// KaTeX, diff those sources and test representative formulas for newly emitted
// markup. Add only presentation attributes here; URL-bearing or style attributes
// such as `href`, `src`, and `style` require separate validation or sanitization.
const mathMLAttributes = [
  "accent",
  "accentunder",
  "class",
  "columnalign",
  "columnlines",
  "columnspacing",
  "depth",
  "display",
  "displaystyle",
  "encoding",
  "fence",
  "height",
  "largeop",
  "linebreak",
  "linethickness",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "maxsize",
  "minsize",
  "notation",
  "rowlines",
  "rowspacing",
  "rspace",
  "scriptlevel",
  "separator",
  "stretchy",
  "valign",
  "voffset",
  "width",
  "xmlns",
];

export const mathMLWhiteList = Object.fromEntries(
  [
    "annotation",
    "math",
    "menclose",
    "mfrac",
    "mglyph",
    "mi",
    "mlabeledtr",
    "mn",
    "mo",
    "mover",
    "mpadded",
    "mphantom",
    "mroot",
    "mrow",
    "mspace",
    "msqrt",
    "mstyle",
    "msub",
    "msubsup",
    "msup",
    "mtable",
    "mtd",
    "mtext",
    "mtr",
    "munder",
    "munderover",
    "semantics",
  ].map((tag) => [tag, mathMLAttributes]),
);

export function markedMathML(options: KatexOptions = {}): MarkedExtension {
  const macros = options.macros ?? {};

  function render(tex: string, displayMode: boolean) {
    return katex.renderToString(tex, {
      ...options,
      macros,
      displayMode,
      output: "mathml",
      throwOnError: options.throwOnError ?? false,
      trust: options.trust ?? false,
    });
  }

  const blockMath: TokenizerExtension & RendererExtension = {
    name: "blockMath",
    level: "block",

    start(src) {
      return src.match(/^\s*\$\$/m)?.index;
    },

    tokenizer(src) {
      const match = /^\s*\$\$[ \t]*\n?([\s\S]*?)\n?[ \t]*\$\$(?:\n|$)/.exec(src);

      if (!match) return;

      return {
        type: "blockMath",
        raw: match[0],
        text: match[1].trim(),
      };
    },

    renderer(token) {
      return `${render(token.text, true)}\n`;
    },
  };

  const inlineMath: TokenizerExtension & RendererExtension = {
    name: "inlineMath",
    level: "inline",

    start(src) {
      return src.indexOf("$");
    },

    tokenizer(src) {
      // Opening $ must not be followed by whitespace.
      // Closing $ must not be preceded by whitespace.
      const match = /^\$(?!\$|\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\$)/.exec(src);

      if (!match) return;

      return {
        type: "inlineMath",
        raw: match[0],
        text: match[1],
      };
    },

    renderer(token) {
      return render(token.text, false);
    },
  };

  return {
    extensions: [blockMath, inlineMath],

    // Prevent _ and * inside math from being treated as Markdown emphasis.
    hooks: {
      emStrongMask(src) {
        return src.replace(/\$\$[\s\S]*?\$\$/g, mask).replace(/\$(?!\$|\s)(?:\\.|[^\\$\n])+?(?<!\s)\$/g, mask);
      },
    },
  };
}

function mask(value: string): string {
  return `[${"a".repeat(Math.max(0, value.length - 2))}]`;
}
