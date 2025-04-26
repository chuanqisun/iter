# TODO

- Show the abort control on the target node, not source node
- Bug: trim during generation caused unwanted new nodes
- Sticky view/edit mode for each node
- Manually append nodes
- Pin nodes from trim
- Support model specific options, e.g. thinking budget
- Busy indicator
- Token usage indicator
- Language override for editor
- Manual code interpreter (with shebang line)
- Reference pinned code blocks
- Migrate from styled components to CSS
- Investigate initial script loading size
- Auto scroll to bottom
- Handle markdown table horizontal overflow
- Code block change tracking should use precise positions rather than regex matching
- Up/down arrow for chat item (including menu actions) navigation

# DONE

- Abort from any node
- Code editor in any role
- Allow dynamic role toggle
- Keyboard navigation for chat item menu
- Migrate to google genai sdk, pending https://github.com/googleapis/js-genai/issues/402
- Fixed: mermaid dialog no longer visible
- Offload highlighting to worker
- CPU throttling for markdown rendering
- Use rxjs to handle streaming
- Use spawn cursor to allow selection during generation
- Bug: svg cannot be rendered under the xml lang name
- Bug: cannot open artifact when it lacks a lang attribute
- Avoid re-rendering using rxjs
- Refactor tree to be flat array
- Refactor tree nodes into a reducer or rxjs store
