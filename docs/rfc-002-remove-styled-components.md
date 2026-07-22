# RFC 002: Remove styled-components

- Status: Proposed
- Scope: Frontend styling and dependency cleanup

## Summary

Replace all `styled-components` usage with imported native CSS. Render the same semantic HTML elements from React, attach stable class names for component styling, represent optional visual states with HTML `data-*` attributes, and pass runtime values through scoped CSS custom properties.

The repository currently has 6 source files importing `styled-components`, containing 31 styled definitions. All 31 templates are static: there are no prop interpolations, transient props, themes, `.attrs`, `css`, `keyframes`, `createGlobalStyle`, `.withConfig`, polymorphic `as`, or `forwardedAs` usages. This makes the migration mostly structural, with a small number of composition, selector, ref, and behavioral-hook cases that need explicit handling.

## Motivation

The application already uses native CSS for its global tokens, custom elements, chat presentation, state selectors, responsive behavior, and runtime layout values. Keeping a CSS-in-JS runtime for 31 static templates adds a dependency and generated classes without providing dynamic styling that the existing CSS architecture cannot express.

Removing `styled-components` will:

- use one styling model throughout the application;
- remove runtime style injection and generated class names;
- reduce the production dependency and bundle surface;
- keep visual state inspectable through DOM attributes and CSS properties;
- colocate component CSS with the module that owns the markup.

## Goals

- Migrate every source use of `styled-components` to equivalent CSS.
- Preserve semantic element types, refs, event handlers, accessibility attributes, layout, and interaction states.
- Follow the repository's existing native CSS nesting and selector conventions.
- Use CSS custom properties for values computed at runtime.
- Use `data-*` attributes for optional or enumerated visual states.
- Preserve existing `c-*` presentation classes and `js-*` behavioral hooks.
- Remove the `styled-components` package after all imports are gone.

## Non-goals

- Redesigning the UI or changing spacing, colors, typography, or interaction behavior.
- Converting styles to CSS Modules, Shadow DOM, Sass, or another styling library.
- Renaming unrelated existing selectors.
- Refactoring unrelated React state or component behavior.
- Adding visual behavior for states that currently have no style rule.

## Current-state audit

### styled-components inventory

| File                                   | Definitions | Migration notes                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/chat-tree/attachment-preview.tsx` |           7 | `StyledAttachmentPreview`, `AttachmentHeading`, `AttachmentFooter`, `AttachmentMedia`, `AttachmentFileName`, `AttachmentFileSize`, and `AttachmentAction` are private static tags. Preserve root hover, image sizing, grid areas, long-name truncation, and button focus/hover rules. |
| `src/chat-tree/chat-config.tsx`        |           2 | `ConfigMenu` is a static `menu`. `AutoWidthInput` is the only `styled(Component)` definition and composes styles from `BasicFormInput`.                                                                                                                                               |
| `src/chat-tree/chat-node.tsx`          |           8 | `Thread`, `MessageActions`, `MessageWithActions`, `ErrorMessage`, `MessageLayout`, `Avatar`, `AvatarIcon`, and `AttachmentList` use static styles and nested selectors. Preserve sticky offsets and existing behavioral classes.                                                      |
| `src/chat-tree/chat-tree.tsx`          |           4 | `ChatAppLayout`, `AppHeader`, `HeaderSentinel`, and `MessageList` include ref targets, sticky layout, and ownership of the runtime `--app-header-height` property.                                                                                                                    |
| `src/dom/form.ts`                      |           9 | Shared styled exports for basic form layouts and controls. Only `BasicFormButton`, `BasicFormInput`, and `BasicSelect` have source consumers; the other six exports are dead code.                                                                                                    |
| `src/shell/center-clamp.ts`            |           1 | `CenterClamp` is a static root `div` used once by `src/main.tsx`.                                                                                                                                                                                                                     |

Total: 31 styled definitions across 6 files.

Generated output under `dist/`, when present, is not a source migration target. It will be replaced by a successful production build after dependency removal.

### Existing CSS inventory and usage

The repository has 12 source stylesheets. Each is imported exactly once as a side effect; 11 are colocated with the importing module, and `index.css` is the application-level stylesheet.

| Stylesheet                                  | Imported by                                | Existing responsibility                                                                                          |
| ------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/index.css`                             | `src/main.tsx`                             | Root design tokens, light/dark values, reset rules, body/dialog behavior, global form focus, and `js-focusable`. |
| `src/artifact/artifact.css`                 | `src/artifact/artifact.ts`                 | Artifact source/action layout, collapsed state, streaming state, and action buttons.                             |
| `src/artifact/artifact-editor-element.css`  | `src/artifact/artifact-editor-element.ts`  | Artifact editor custom-element layout and runtime width behavior.                                                |
| `src/artifact/artifact-divider-element.css` | `src/artifact/artifact-divider-element.ts` | Artifact divider custom-element presentation and resize states.                                                  |
| `src/chat-tree/chat-node.css`               | `src/chat-tree/chat-node.tsx`              | Reusable chat-node classes, collapsed-height properties, spinner animation, usage metadata, and state selectors. |
| `src/chat-tree/filename-dialog.css`         | `src/chat-tree/filename-dialog.ts`         | Filename dialog-specific layout and controls.                                                                    |
| `src/chat-tree/streaming-preview.css`       | `src/chat-tree/streaming-preview.tsx`      | Preview layout, collapsed/streaming flags, markdown content, code blocks, and tables.                            |
| `src/code-editor/block-action-widget.css`   | `src/code-editor/block-action-widget.ts`   | Code-block action controls and copied/disabled states.                                                           |
| `src/code-editor/chat-panel.css`            | `src/code-editor/chat-panel.ts`            | Editor chat panel layout and controls.                                                                           |
| `src/code-editor/code-editor-element.css`   | `src/code-editor/code-editor-element.ts`   | Code editor custom-element layout, focus, and editor states.                                                     |
| `src/settings/settings-element.css`         | `src/settings/settings-element.ts`         | Settings custom-element forms, tabs, rows, and provider-specific visibility.                                     |
| `src/shell/toast.css`                       | `src/shell/toast.ts`                       | Toast placement, appearance, and visibility.                                                                     |

The migration should extend this architecture rather than introduce another CSS organization model.

## CSS conventions

### Ownership and imports

- Put component-specific rules in a same-basename stylesheet next to the TS/TSX owner.
- Import each stylesheet once from the module that renders or defines its root markup.
- Extend `chat-node.css`, which is already owned and imported by `chat-node.tsx`, instead of creating a second stylesheet for the same component.
- Give every React component root a stable `.c-component-name` class and root all component-local rules beneath it.
- Nest child selectors beneath the component root. Child classes do not use the `c-` prefix and may use concise names such as `.footer`, `.avatar`, or `.action` because the root prevents them from leaking globally.
- Continue using native CSS nesting, already supported throughout the repository.

Example shape:

```css
.c-attachment-preview {
  display: grid;

  .action {
    /* local rule */
  }

  &:hover {
    /* state rule */
  }
}
```

Use the React component's kebab-case name for its root class and descriptive kebab-case names for its nested internals. Keep the existing meanings of prefixes:

- `c-*` identifies a React component root, such as `c-attachment-preview`, `c-chat-node`, or `c-chat-tree`. Do not use it on child elements.
- `js-*` is a JavaScript behavior/focus hook, such as `js-message` or `js-focusable`, and must not be replaced by a styling-only name.
- custom-element tag names remain selector roots where the element owns its styles.

### Dynamic values

Values calculated by React or DOM measurement must be written to a CSS custom property on the narrowest owning element and consumed with `var()` plus a safe fallback where appropriate.

The existing header measurement is the model for this migration:

```ts
layout.style.setProperty("--app-header-height", `${header.offsetHeight}px`);
```

```css
.c-chat-node {
  .message-actions {
    top: var(--app-header-height, 0px);
  }
}
```

The existing streaming preview demonstrates the other half of this pattern: component-local values such as `--chat-node-collapsed-height` are defined by an owner and consumed from `streaming-preview.css`, rather than interpolated into a generated stylesheet.

No current styled template contains a dynamic interpolation. If one is introduced while this RFC is being implemented, it must be translated to a typed inline custom property, not an inline presentation property. For example, a runtime width should become `style={{ "--preview-width": `${width}px` } as React.CSSProperties }` and CSS should consume `var(--preview-width)`.

### Optional and enumerated states

Optional visual flags must use attribute presence, with an empty string when active and `undefined` or `null` when inactive:

```tsx
data-collapsed={isCollapsed ? "" : undefined}
```

```css
&[data-collapsed] {
  /* active state */
}
```

Enumerated visual state should use an attribute value, as existing artifact CSS does with `data-state="collapsed"`. Do not create styling-only boolean React props or encode state in generated class names.

Conditional rendering that only controls whether an element exists, such as attachments, errors, or provider options, does not need an additional state attribute.

## Proposed migration

### Attachment preview

Create `src/chat-tree/attachment-preview.css`, import it from `attachment-preview.tsx`, and replace all seven styled tags with their current semantic HTML elements and stable classes:

- `.c-attachment-preview` on the component root
- `.heading`
- `.footer`
- `.media`
- `.file-name`
- `.file-size`
- `.action`

Nest descendant rules under `.c-attachment-preview`. Preserve image grid placement, the 48px row height, hover colors, focus-visible behavior, and filename ellipsis. Convert the existing `// text longer ...` template comment to valid CSS comment syntax.

### Chat configuration and form composition

Create `src/chat-tree/chat-config.css`, import it from `chat-config.tsx`, and render native `menu`, `button`, `select`, and `input` elements.

Use `.c-chat-config` on the component's root `menu`. Beneath it, use a shared local control class for the padding formerly supplied by `BasicFormButton`, `BasicFormInput`, and `BasicSelect`, with element-appropriate modifiers where needed. The three number inputs receive both the base `.input` class and `.auto-width-input`, preserving the only `styled(BasicFormInput)` composition case:

```tsx
<input className="input auto-width-input" />
```

`field-sizing: content` remains on selects and auto-width inputs, while `min-width: 72px` remains specific to the number-input modifier. Scope all control and label rules beneath `.c-chat-config`.

After consumers are migrated, delete `src/dom/form.ts`. Its six unused exports (`BasicActionGroup`, `BasicFieldset`, `BasicForm`, `BasicFormField`, `ContentWithAction`, and `BasicFormTextarea`) have no rendered behavior to preserve. Removing them avoids creating an unused global utility stylesheet solely to retain dead internal APIs.

### Chat node

Extend `src/chat-tree/chat-node.css` and replace all eight styled tags in `chat-node.tsx` with native tags. Keep `className="c-chat-node"` on the thread root and add internal classes without replacing existing classes:

- `.message-actions`
- `.message-with-actions`
- `.error-message`
- `.message-layout`
- `.avatar`
- `.avatar-icon`
- `.attachment-list`

The thread's grid rules can remain on `.c-chat-node`, its existing stable root. Scope nested `> *`, descendant `button`, hover, and focus-visible rules beneath `.message-actions`.

Preserve these non-style contracts exactly:

- `data-node-id` on the thread root, queried by artifact/editor behavior;
- `js-message` on the message layout, queried by artifact actions;
- `js-focusable` on editors/previews, used by focus, dictation, and keyboard behavior;
- `data-managed-focus` on action buttons;
- the `--app-header-height` sticky offsets for actions and avatars.

Attachments and error messages remain conditionally mounted; they do not require new flags.

### Chat tree layout

Create `src/chat-tree/chat-tree.css`, import it from `chat-tree.tsx`, and replace the four styled tags with native `div` and `header` elements using:

- `.c-chat-tree` on the component root
- `.app-header`
- `.header-sentinel`
- `.message-list`

Attach `layoutRef`, `headerRef`, `headerSentinelRef`, and `treeRootRef` to the same DOM elements as today. Keep `--app-header-height: 0px` on `.c-chat-tree`; the `ResizeObserver` continues updating that property on the layout element.

`data-floating` is currently the only state-like prop passed to one of these styled elements, but no CSS selector or JavaScript query consumes it. Remove the dormant attribute and its `IntersectionObserver`/state only if a focused behavior check confirms they have no non-style consumer. If floating visuals are intended before implementation begins, retain the state as `data-floating={isHeaderFloating ? "" : undefined}` and add an explicit `[data-floating]` rule. Do not preserve the current always-present `data-floating="true|false"` form for a presence selector.

### Center clamp

Create `src/shell/center-clamp.css`, import it from `src/main.tsx`, replace `CenterClamp` with `<div className="c-center-clamp">`, and delete `src/shell/center-clamp.ts`. Preserve the `div` semantics, child placement, maximum width, auto margins, and padding.

### Dependency cleanup

After source migration:

- remove `styled-components` from `dependencies` in `package.json`;
- regenerate `package-lock.json` with the repository package manager;
- confirm no source import or styled definition remains;
- run a production build so generated output no longer embeds the library.

## Files changed by the implementation

### Modify

- `src/chat-tree/attachment-preview.tsx`
- `src/chat-tree/chat-config.tsx`
- `src/chat-tree/chat-node.tsx`
- `src/chat-tree/chat-node.css`
- `src/chat-tree/chat-tree.tsx`
- `src/main.tsx`
- `package.json`
- `package-lock.json`

### Add

- `src/chat-tree/attachment-preview.css`
- `src/chat-tree/chat-config.css`
- `src/chat-tree/chat-tree.css`
- `src/shell/center-clamp.css`

### Delete

- `src/dom/form.ts`
- `src/shell/center-clamp.ts`

No existing stylesheet outside `chat-node.css` needs modification. The other 11 current CSS files remain in place and continue to be imported by their existing owners.

## Special-case checklist

- **Static styled tags:** Replace with the same native tag and a stable class; do not change DOM semantics.
- **`styled(BasicFormInput)`:** Compose base and modifier classes on one native input.
- **Nested selectors:** Preserve child combinators, descendant selectors, `:hover`, and `:focus-visible` through native CSS nesting under a feature root.
- **Existing classes:** Merge new classes with `c-chat-node`, `js-message`, and `js-focusable`; never overwrite behavior hooks.
- **Refs:** Keep each ref on the same concrete DOM element so observers and imperative queries continue to work.
- **Runtime values:** Keep `--app-header-height` on the layout owner and consume it with fallbacks; use the same custom-property pattern for any newly discovered runtime value.
- **Optional flags:** Use empty-string/absent `data-*` attributes. Use value selectors for enumerated state.
- **Dormant `data-floating`:** Either remove its dead state path after verification or give it an explicit presence-based contract; do not silently invent new visuals.
- **Conditional elements:** Preserve mount/unmount behavior for media, attachments, errors, and provider controls without redundant flags.
- **Comments:** Convert the JavaScript-style comment in `AttachmentFileName` to valid CSS syntax.
- **Cascade timing:** Imported CSS loads statically instead of being injected at component render. Root all new rules to avoid depending on generated-class specificity or injection order.
- **Dead exports:** Delete unused form wrappers rather than manufacturing unused CSS utilities.
- **Generated output:** Rebuild it; do not hand-edit bundled files.

## Validation plan

### Automated checks

1. Search `src` for `styled-components`, `styled.`, and `styled(`; all must return zero results.
2. Run `npm run build` to validate TypeScript element/ref types and Vite's native CSS nesting pipeline.
3. Run `npm test` to detect behavioral regressions.
4. Inspect the production dependency tree or bundle to confirm `styled-components` is absent.

The current Vitest configuration uses a Node environment, so existing tests do not validate computed layout or CSS. Build and unit-test success are necessary but not sufficient.

### Browser checks

Test at desktop and narrow viewport widths in both light and dark color schemes:

- header remains sticky and message action/avatar offsets follow changing header height;
- model and numeric configuration controls retain sizing, wrapping, and conditional visibility;
- user and assistant nodes preserve spacing, action focus order, and sticky controls;
- collapsed editor and preview states retain their maximum heights and scrolling;
- streaming collapsed previews remain bottom-aligned;
- image and non-image attachments retain layout, including long filenames and all actions;
- keyboard focus, hover, dictation, double-click, and artifact actions still find their hooks;
- dialogs, settings, artifacts, code editors, and toasts show no cascade regression.

Compare DOM tag names, refs, class hooks, and `data-*` attributes as well as screenshots. The migration is equivalent only if both presentation and behavior remain unchanged.

## Rollout and risk

Implement in small, buildable slices. Local leaf components come first, shared/composed form styling follows, and dependency removal happens only after the final zero-usage search. This keeps failures attributable to one stylesheet and avoids removing the runtime while styled definitions remain.

The primary risks are selector leakage, lost class hooks, a ref moving to a different element, and cascade changes caused by switching from runtime injection to static imports. Feature-root scoping, same-element replacements, focused builds, and browser checks mitigate these risks.

## Step-by-step implementation guide

1. Add `attachment-preview.css`, import it from `attachment-preview.tsx`, replace its seven styled tags with native elements/classes, and verify attachment hover, focus, media, and truncation behavior.
2. Extend `chat-node.css`, replace the eight styled tags in `chat-node.tsx`, preserve every existing `c-*`, `js-*`, and `data-*` hook, then build and test sticky actions, avatars, errors, and attachment lists.
3. Add `chat-tree.css`, replace the four layout styled tags in `chat-tree.tsx`, keep refs and `--app-header-height` ownership unchanged, and verify sticky header measurements at narrow and wide widths.
4. Resolve `data-floating`: remove the unused intersection state path after confirming it has no consumer, or normalize it to an empty-string presence attribute and document/add its intended CSS rule.
5. Add `chat-config.css`, replace `ConfigMenu` and `AutoWidthInput` plus the used basic form wrappers with native controls and composed classes, then verify every provider-dependent option combination.
6. Delete `src/dom/form.ts` after a repository search confirms no imports remain.
7. Add `center-clamp.css`, import it from `main.tsx`, replace `CenterClamp` with the equivalent root `div`, and delete `src/shell/center-clamp.ts`.
8. Search source for all styled-components imports and APIs; stop and migrate any result before dependency cleanup.
9. Remove `styled-components` from `package.json` and regenerate `package-lock.json`.
10. Run `npm run build` and `npm test`, fixing only migration-related failures.
11. Complete the browser matrix for color scheme, viewport width, sticky layout, optional states, attachments, focus/hover, dialogs, artifacts, editors, settings, and toasts.
12. Rebuild deployable output and confirm the final bundle and dependency tree contain no `styled-components` runtime.
