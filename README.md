# Iter

A minimalist frontend for Gen AI Chat models, optimized for rapid prompt iteration.

- **🔒 Privacy first**: Credentials are stored in your browser. All requests directly sent to API with no middleman. Absolutely no tracking.
- **⚡ API endpoint and model hot-swap**: Switch between different APIs and models without losing any chat progress
- **🦉 Adapts to OS/Browser default theme**: Dark theme for happy night owls
- **💅 Markdown parser**: Built-in syntax highlight and copy button for code blocks
- **🧭 Artifacts**: Live edit and preview code blocks for SVG, HTML, Mermaid, TypeScript, and React in JSX
- **🖱 Cursor chat**: Precisely edit the selected text within a chat response
- **💻 Interpreter**: Process uploaded files with TypeScript and any browser-friendly npm packages
- **📸 Vision input**: Handle visual inputs with multi-modal models
- **🎙️ Speech input**: Use microphone to input text that can be mixed with typed message

## Screenshots

Create a runnable program from text
![Two screenshots of the app, one showing gpt generated code for a todo app, another showing the todo app running live](./designs/screenshots/artifact.png)

Recreate the UI of Airbnb with a single screenshot
![Two screenshots of the app, one showing gpt generated code based on user uploaded screen, another showing the code running live](./designs/screenshots/vision.png)

## Supported model providers

- OpenAI
  - ✅ o1-mini
  - ✅ GPT-4o
  - ✅ GPT-4o-mini
- Azure OpenAI
  - ✅ GPT-4o
  - ✅ GPT-4o-mini
- Anthropic
  - ✅ Claude 3.5 Sonnet
  - ✅ Claude 3.5 Haiku
- Google Generative AI
  - ✅ Gemini 2.0 Flash

## Keyboard shortcuts

Mac users, please use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>

| Action               | Shortcut                                                        |
| -------------------- | --------------------------------------------------------------- |
| Send message         | <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (in any textarea)            |
| Abort action         | <kbd>Escape</kbd> (when streaming response)                     |
| Dictate              | <kbd>Shift</kbd> + <kbd>Space</kbd> (hold to talk)              |
| Open response editor | <kbd>Enter</kbd> or double click (when focusing response block) |
| Open artifact editor | <kbd>Enter</kbd> or double click (when focusing artifact block) |
| Toggle cursor chat   | <kbd>Ctrl</kbd> + <kbd>K</kbd> (in artifact or response editor) |
| Rerun artifact       | <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (in artifact editor)         |
| Exit editor          | <kbd>Escape</kbd> (in artifact or response editor)              |
| Select up/down       | <kbd>↑</kbd> / <kbd>↓</kbd>                                     |
| Create backup        | <kbd>Ctrl</kbd> + <kbd>S</kbd>                                  |
| Restore backup       | <kbd>Ctrl</kbd> + <kbd>O</kbd>                                  |
| Export               | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>               |
| Import               | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>               |
