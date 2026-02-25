# Iter

A minimalist frontend for Gen AI Chat models, optimized for rapid prompt iteration.

- **🔒 Privacy first**: Credentials are stored in your browser. All requests directly sent to API with no middleman. Absolutely no tracking.
- **⚡ API endpoint and model hot-swap**: Switch between different APIs and models without losing any chat progress
- **🦉 Adapts to OS/Browser default theme**: Dark theme for happy night owls
- **💅 Markdown parser**: Built-in syntax highlight and copy button for code blocks
- **📋 Smart paste**: HTML pastes as markdown, images as input, and files as attachments
- **🧭 Artifacts**: Live edit and preview code blocks for SVG, HTML, Mermaid, TypeScript, and React
- **💻 Interpreter**: Process uploaded files with TypeScript, with access to NPM registry, a virtual File System, and an LLM prompt API.
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
  - ✅ GPT-5.3-codex
  - ✅ GPT-5.2
  - ✅ GPT-5.1-chat-latest
  - ✅ GPT-5
  - ✅ GPT-5-mini
  - ✅ GPT-5-nano
- Anthropic
  - ✅ Claude Opus 4.6
  - ✅ Claude Sonnet 4.6
  - ✅ Claude Haiku 4.5
- Google Generative AI
  - ✅ Gemini 3.1 Pro Preview
  - ✅ Gemini 3 Flash Preview
  - ✅ Gemini 2.5 Pro
  - ✅ Gemini 2.5 Flash
  - ✅ Gemini 2.5 Flash Lite
- xAI\*\*
  - ✅ Grok 4.1 Fast
  - ✅ Grok 4.1 Fast Non-reasoning
- Inception\*\*\*
  - ✅ Mercury
  - ✅ Mercury Coder
- OpenRouter
  - All chat models

\*See detailed support matrix for [Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/responses?tabs=python-secure#responses-api)  
\*\*xAI models do not support PDF document
\*\*\*Inception models are text only

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

## Directives

Directives are special code blocks that change how the LLM behaves or enable additional capabilities like code execution, web search, and URL/page fetching.

### `Run` directive

Include a `run` block in the user message to force the LLM to generate code and output files.

````
```run
<describe what the code should do in natural language, you can also include what types of files to output>
```
````

The run block can take optional directives to expose additional APIs to the generated code

**`llm`**: Generate code that can prompt the active LLM model.

````
```run llm
<describe how the code should use LLM to perform tasks, e.g. summarize, extract, generate content>
```
````

### `Edit` directive

Include an `edit` block in the user message to force the LLM to generate code that edits the nearest assistant message. Other messages will be hidden.

````
```edit
<editorial goals or instructions>
```
````

### `Search` directive

Include a `search` block in the user message to enable web search for the model. This allows the model to access real-time information from the internet.

````
```search
<your search query or instructions that require real-time information>
```
````

### `Fetch` directive

Include a `fetch` block in the user message to enable URL/page fetching tools for the model.

- **Anthropic**: uses the `web_fetch` tool.
- **Google Generative AI**: uses the URL context tool.
- **OpenAI**: uses the `web_search` tool (same behavior as `search`).

````
```fetch
<your instructions that require fetching and analyzing specific URLs>
```
````

## Attachments

You can copy/paste or upload files into each message in one of the following formats:

- **Embedded**: LLM can see the image, PDF, or text content. If using `run` directive, LLM can write code that accesses the content as a file.
- **External**: LLM can only see the metadata of the file (name, size, type, etc.). If using `run` directive, LLM can write code that accesses the content as a file without reading the content.
