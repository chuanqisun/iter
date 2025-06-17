# Iter

A minimalist frontend for Gen AI Chat models, optimized for rapid prompt iteration.

- **🔒 Privacy first**: Credentials are stored in your browser. All requests directly sent to API with no middleman. Absolutely no tracking.
- **⚡ API endpoint and model hot-swap**: Switch between different APIs and models without losing any chat progress
- **🦉 Adapts to OS/Browser default theme**: Dark theme for happy night owls
- **💅 Markdown parser**: Built-in syntax highlight and copy button for code blocks
- **🧭 Artifacts**: Live edit and preview code blocks for SVG, HTML, Mermaid, TypeScript, and React in JSX
- **💻 Interpreter**: Process uploaded files with TypeScript and any browser-friendly npm packages
- **🖱️ Cursor chat**: Precisely edit the selected text
- **📸 Vision input**: Handle visual inputs with multi-modal models
- **🎙️ Speech input**: Use microphone to input text that can be mixed with typed message
- **📋 Document input**: Interpret PDF and text files without conversion

## Screenshots

Create a runnable program from text
![Two screenshots of the app, one showing gpt generated code for a todo app, another showing the todo app running live](./designs/screenshots/artifact.png)

Recreate the UI of Airbnb with a single screenshot
![Two screenshots of the app, one showing gpt generated code based on user uploaded screen, another showing the code running live](./designs/screenshots/vision.png)

## Supported model providers

- OpenAI\*
  - ✅ codex-mini
  - ✅ o4-mini
  - ✅ o3-pro
  - ✅ o3
  - ✅ o3-mini
  - ✅ GPT-4.5-preview
  - ✅ GPT-4.1
  - ✅ GPT-4.1-mini
  - ✅ GPT-4.1-nano
  - ✅ GPT-4o
  - ✅ GPT-4o-mini
- Anthropic
  - ✅ Claude Opus 4
  - ✅ Claude Sonnet 4
  - ✅ Claude 3.7 Sonnet
  - ✅ Claude 3.5 Sonnet
  - ✅ Claude 3.5 Haiku
- Google Generative AI
  - ✅ Gemini 2.5 Pro
  - ✅ Gemini 2.5 Flash
  - ✅ Gemini 2.5 Flash Preview
  - ✅ Gemini 2.5 Flash Lite
  - ✅ Gemini 2.0 Flash
  - ✅ Gemini 2.0 Flash Lite
  - ✅ Gemini 2.0 Flash Thinking

\*See detailed support matrix for [Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/responses?tabs=python-secure#responses-api)

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
| Export               | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd>               |
| Import               | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>               |

## Code interpreter

Include a `run` block in the user message to force the LLM to generate code and output files.

````
```run
<describe what the code should do in natural language, you can also include what types of files to output>
```
````
