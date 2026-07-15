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

// Block math: $$...$$ or \[...\]
const blockDollarStartRegex = /^\s*\$\$/m;
const blockDollarRegex = /^\s*\$\$[ \t]*\n?([\s\S]*?)\n?[ \t]*\$\$(?:\n|$)/;
const blockBracketStartRegex = /^\s*\\\[/m;
const blockBracketRegex = /^\s*\\\[[ \t]*\n?([\s\S]*?)\n?[ \t]*\\\](?:\n|$)/;

// Inline math: $...$ or \(...\)
// Opening $ must not be followed by whitespace. Closing $ must not be preceded by whitespace.
const inlineDollarRegex = /^\$(?!\$|\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\$)/;
const inlineParenRegex = /^\\\(((?:\\.|[^\\\n])+?)\\\)/;
const inlineStartRegex = /\$|\\\(/;

// Masking regexes used to hide math spans from Markdown's emphasis (_ and *) parsing.
const maskBlockDollarRegex = /\$\$[\s\S]*?\$\$/g;
const maskBlockBracketRegex = /\\\[[\s\S]*?\\\]/g;
const maskInlineDollarRegex = /\$(?!\$|\s)(?:\\.|[^\\$\n])+?(?<!\s)\$/g;
const maskInlineParenRegex = /\\\((?:\\.|[^\\\n])+?\\\)/g;

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
      const dollarIndex = src.match(blockDollarStartRegex)?.index;
      const bracketIndex = src.match(blockBracketStartRegex)?.index;

      if (dollarIndex === undefined) return bracketIndex;
      if (bracketIndex === undefined) return dollarIndex;

      return Math.min(dollarIndex, bracketIndex);
    },

    tokenizer(src) {
      const match = blockDollarRegex.exec(src) ?? blockBracketRegex.exec(src);

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
      return src.match(inlineStartRegex)?.index;
    },

    tokenizer(src) {
      const match = inlineDollarRegex.exec(src) ?? inlineParenRegex.exec(src);

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
        return src
          .replace(maskBlockDollarRegex, mask)
          .replace(maskBlockBracketRegex, mask)
          .replace(maskInlineDollarRegex, mask)
          .replace(maskInlineParenRegex, mask);
      },
    },
  };
}

function mask(value: string): string {
  return `[${"a".repeat(Math.max(0, value.length - 2))}]`;
}
