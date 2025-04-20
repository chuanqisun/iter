# TODO

- Use rxjs to handle streaming
- Use spawn cursor to allow selection during generation
- Bug: trim during generation caused unwanted new nodes
- Allow dynamic role toggle
- Sticky view/edit mode for each node
- Manually append nodes
- Pin nodes from trim
- Code editor in any role
- CPU throttling for markdown rendering
- Support model specific options, e.g. thinking budget
- Busy indicator
- Token usage indicator
- Language override for editor
- Manual code interpreter (with shebang line)
- Reference pinned code blocks
- Migrate from styled components to CSS
- Investigate initial script loading size
- Offload highlighting to worker
- Migrate to google genai sdk, pending https://github.com/googleapis/js-genai/issues/402

# DONE

- Bug: svg cannot be rendered under the xml lang name
- Bug: cannot open artifact when it lacks a lang attribute
- Avoid re-rendering using rxjs
- Refactor tree to be flat array
- Refactor tree nodes into a reducer or rxjs store
