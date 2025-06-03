import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from "@codemirror/view";
import type { ArtifactEditorElement } from "../artifact/artifact-editor-element";
import type { ArtifactEvents } from "../artifact/languages/generic";
import { $new } from "../dom/dom";
import "./block-action-widget.css";

export interface BlockEventInit {
  code: string;
  blockStart: number;
  blockEnd: number;
  codeStart: number;
  codeEnd: number;
  lang: string;
}

const timers = new WeakMap<Element, number>();

export const blockActionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = actionBarDecorationSet(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) != syntaxTree(update.state))
        this.decorations = actionBarDecorationSet(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,

    eventHandlers: {
      mousedown: (e) => {
        const trigger = (e.target as HTMLElement).closest(`[data-action]`);
        if (trigger) {
          // prevent cursor movement
          e.preventDefault();
        }
      },
      click: (e, view) => {
        const trigger = (e.target as HTMLElement).closest<HTMLElement>(`[data-action]`);
        if (trigger) {
          const action = trigger.getAttribute("data-action");
          e.stopPropagation();

          const from = parseInt(trigger!.closest("[data-from]")!.getAttribute("data-from")!);
          const to = parseInt(trigger!.closest("[data-to]")!.getAttribute("data-to")!);
          // the content of [from, to] can be either the opening ``` or the lang + attribute string
          const blockStart = Math.max(0, from - 3);
          const remaintingDoc = view.state.sliceDoc(blockStart);
          const markdownBlockPattern = /```(?:[^\n]*)\n([\s\S]*?)```/;
          // if no match, use rest of the document
          const content = remaintingDoc.match(markdownBlockPattern)?.[1] ?? view.state.sliceDoc(to + 1);
          const lang = view.state.sliceDoc(from, to).trim();
          const resolvedLang = lang === "```" ? "txt" : lang.split(" ")[0].trim();
          const props = parseCodeBlockProps(lang.split(" ").slice(1).join(" "));

          // code start is the first line below opening ```
          const codeStartWithInBlock = remaintingDoc.indexOf("\n", 3) + 1;
          const maybeBacktickIndex = remaintingDoc.indexOf("```", codeStartWithInBlock);
          const codeEndWithInBlock = maybeBacktickIndex === -1 ? remaintingDoc.length : maybeBacktickIndex;
          const blockEndWithInBlock = maybeBacktickIndex === -1 ? remaintingDoc.length : maybeBacktickIndex + 3;
          const codeStart = blockStart + codeStartWithInBlock;
          const codeEnd = blockStart + codeEndWithInBlock;
          const blockEnd = blockStart + blockEndWithInBlock;

          switch (action) {
            case "edit": {
              document
                .querySelector<ArtifactEditorElement>("artifact-editor-element")!
                .start({
                  code: content,
                  lang: resolvedLang,
                  trigger,
                })
                .then((updatedValue) => {
                  if (updatedValue === content) return; // no change, do nothing
                  view.dispatch({ changes: { from: codeStart, to: codeEnd, insert: updatedValue } });
                });
              break;
            }
            case "attach": {
              e.preventDefault();
              const lang = resolvedLang;
              const code = content.trim();
              const nodeId = trigger?.closest("[data-node-id]")?.getAttribute("data-node-id");
              if (!nodeId) throw new Error("No node ID found");

              const filename = props.filename;

              window.dispatchEvent(
                new CustomEvent<ArtifactEvents["attach"]>("attach", {
                  detail: { code, lang, nodeId, filename },
                }),
              );
              break;
            }
            case "delete": {
              e.preventDefault();
              view.dispatch({
                changes: { from: blockStart, to: blockEnd, insert: "" },
              });
              break;
            }
            case "copy": {
              e.preventDefault();
              navigator.clipboard.writeText(content.trim()).then(() => {
                trigger.classList.add("copied");
                const previousTimer = timers.get(trigger);
                if (previousTimer) clearTimeout(previousTimer);

                timers.set(
                  trigger,
                  window.setTimeout(() => trigger.classList.remove("copied"), 3000),
                );
              });
              break;
            }
            default:
          }
        }
      },
    },
  },
);

class BlockActionWidget extends WidgetType {
  constructor(
    private from: number,
    private to: number,
    private isClosed: boolean = false,
  ) {
    super();
  }

  toDOM(_view: EditorView) {
    return $new("span", { class: "block-actions", "data-from": this.from.toString(), "data-to": this.to.toString() }, [
      $new("button", { "data-action": "edit" }, ["Edit"]),
      $new("button", { "data-action": "attach" }, ["Attach"]),
      $new("button", { "data-action": "delete" }, ["Delete"]),
      $new("button", { "data-action": "copy" }, [
        $new("span", { class: "ready" }, ["Copy"]),
        $new("span", { class: "success" }, ["✅ Copied"]),
      ]),
    ]);
  }

  eq(widget: WidgetType): boolean {
    if (!(widget instanceof BlockActionWidget)) return false;
    return this.from === widget.from && this.to === widget.to && this.isClosed === widget.isClosed;
  }

  ignoreEvent() {
    return false;
  }
}

function actionBarDecorationSet(view: EditorView) {
  let widgets = [] as any[];
  for (let { from, to } of view.visibleRanges) {
    const pushSites = [] as { name: string; from: number; to: number; isBlockClosed: boolean }[];
    let isInBlock = false;
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        // we only support triple backtick
        if (node.type.name === "CodeMark" && node.to - node.from !== 3) return;

        // closing triple backtick
        if (node.type.name === "CodeMark" && isInBlock) {
          pushSites.at(-1)!.isBlockClosed = true;
          return;
        }

        // opening triple backtick with code info
        if (node.type.name === "CodeInfo") {
          isInBlock = true;
          pushSites.push({ name: node.type.name, from: node.from, to: node.to, isBlockClosed: false });
        }
      },
    });

    for (let node of pushSites) {
      const nextNode = pushSites[pushSites.indexOf(node) + 1];
      if (node.name === "CodeMark" && nextNode?.name === "CodeInfo" && node.to === nextNode?.from) continue;

      const deco = Decoration.widget({
        widget: new BlockActionWidget(node.from, node.to, node.isBlockClosed),
        side: 1,
      });

      widgets.push(deco.range(node.to));
    }
  }

  return Decoration.set(widgets);
}

/**
 * Examples
 * input: key1 key2=value2 key3="value 3"
 * output: { key1: "", key2: "value2", key3: "value 3" }
 */
function parseCodeBlockProps(raw = "") {
  const result: Record<string, string> = {};
  // Regex: match key="value", key='value', key=value, or key
  const regex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const key = match[1];
    // Value can be in group 2 (double quotes), 3 (single quotes), or 4 (unquoted)
    const value =
      match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : "";
    result[key] = value;
  }
  return result;
}
