# TODO

- Use rxjs to handle streaming
- Avoid re-rendering using rxjs
- Allow dynamic role toggle
- Pin nodes from trim
- Manually append nodes
- CPU throttling for markdown rendering
- Use spawn cursor to allow selection during generation
- Busy indicator
- Token usage indicator
- Language override for editor
- Manual code interpreter (with shebang line)
- Reference pinned code blocks
- Migrate from styled components to CSS
- Bug: trim during generation caused unwanted new nodes
- Investigate initial script loading size
- Offload highlighting to worker
- Migrate to google genai sdk, pending https://github.com/googleapis/js-genai/issues/402

# DONE

- Refactor tree to be flat array
- Refactor tree nodes into a reducer or rxjs store
