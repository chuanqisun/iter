import { getReadableFileSize } from "../../chat-tree/file-size";
import type { GenericMessage } from "../../providers/base";
import { textToDataUrl } from "../../storage/codec";
import fileAccessRuntimeAPI from "./directives/file-access-runtime-api.js?raw";
import fileAccessStaticAPI from "./directives/file-access-static-api.js?raw";
import llmRuntimeAPI from "./directives/llm-runtime-api.js?raw";
import llmStaticAPI from "./directives/llm-static-api.js?raw";

export interface ParsedDirective {
  run?: boolean;
  llm?: boolean;
  edit?: boolean;
}
export function parseDirectives(text: string): ParsedDirective {
  // ```run -> run = true
  // ```run llm -> run = true, llm = true
  // ```edit -> edit = true
  const directiveLines = text.split("\n").filter((line) => line.startsWith("```run") || line.startsWith("```edit"));
  const run = directiveLines.some((line) => line.includes("```run"));
  const llm = run && directiveLines.some((line) => line.includes(" llm"));
  const edit = directiveLines.some((line) => line.includes("```edit"));
  return {
    run,
    llm,
    edit,
  };
}

export function getReadonlyFileAccessPostscript(files: { name: string; size: number; type: string }[]) {
  const filePostScript = files?.length
    ? `
Files uploaded:
${files.map((file) => `- Filename: ${file.name} | Size: ${getReadableFileSize(file.size)}${file.type ? ` | Type: ${file.type}` : ""}`).join("\n")}

Uploaded files can only be accessed in browser via global javascript API  \`window.readonlyFS.getFile(filename: string): Promise<File>\`
`
    : "";

  return filePostScript;
}

export interface CodeInterpreterOptions {
  fs?: boolean;
  llm?: boolean;
}
export function getCodeInterpreterPrompt(options?: CodeInterpreterOptions): string {
  return `
Write a JavaScript program based on user's goal or instruction.

${[
  options?.fs
    ? `To output data, you can use the global javascript API  \`window.writeonlyFS.writeFile(filename: string, data: string | Blob): Promise<void>\``
    : "",
  options?.llm
    ? `
To prompt a Large Language Model (LLM) for text response, you must use the global javascript API  \`window.llm.prompt(prompt: string): Promise<string>\`
To abort all LLM requests, you must use \`window.llm.abortAll(): void\`
`.trim()
    : "",
].join("\n")}


If the program needs UI, respond a single HTML file:
\`\`\`html
<!DOCTYPE html>
...
\`\`\`

Otherwise respond in javascript like this:

\`\`\`javascript 
// ...
\`\`\`
`;
}

export function getEditMessages(document: string, instruction: string): GenericMessage[] {
  return [
    {
      role: "system",
      content: getEditSystemPrompt(),
    },
    {
      role: "user",
      content: [
        {
          type: "text/plain",
          name: "document.md",
          url: textToDataUrl(document),
        },
        {
          type: "text/plain",
          name: "instruction.md",
          url: textToDataUrl(instruction),
        },
      ],
    },
  ];
}

function getEditSystemPrompt(): string {
  return `
Write typescript to edit the user provided document based on goal or instruction.
- You can read the document content via \`window.editor.readContent(): Promise<string>\`
- You can write the edited document content via \`window.editor.writeContent(): Promise<void>\`
- You can return string literal directly when you need to write entirely new content
- Use string replacement function to make precise edits, pay attention to whitespace
- Use regex to match complex patterns
- Use logic for data manipulation

Write compact code without comments. When performing multiple types of edit, delimit them by new lines.

Respond with typescript code block:

\`\`\`typescript
const content = await window.editor.readContent();
/** Your implementation here */
await window.editor.writeContent(updatedContent);
\`\`\`
    `;
}

export function injectDirectivesRuntimeAPIToDocument(html: string) {
  // add <script></script> before the 1st <script> element, or at the end of the <head> element;
  let insertPosition = html.indexOf("<script");
  if (insertPosition === -1) insertPosition = html.indexOf("</head>");
  if (insertPosition < 0) {
    console.warn("No <script> or </head> found in the HTML code");
    return html;
  }

  const injectedCode =
    html.slice(0, insertPosition) +
    `<script>${fileAccessRuntimeAPI}\n${llmRuntimeAPI}</script>` +
    html.slice(insertPosition);
  return injectedCode;
}

export async function injectDirectivesStaticAPIToDocument(html: string) {
  // get files from window postMessage
  const files = await new Promise<File[]>((resolve) => {
    const abortController = new AbortController();
    // note we are sending and receiving on the same window.
    // We must define an exit condition to prevent accumulating listeners.
    window.postMessage({ type: "listFilesRequest" }, "*");
    window.addEventListener(
      "message",
      (event) => {
        if (event.data.type === "listFilesResponse" && event.data.files) {
          resolve(event.data.files);
          abortController.abort();
        }
      },
      { signal: abortController.signal },
    );
  });

  // convert each file to <script type="embedded-file"></script>
  const scripts = [
    ...(await Promise.all(
      files.map((file) =>
        fileToUrl(file).then((url) => `<script type="embedded-file" filename="${file.name}" data="${url}"></script>`),
      ),
    )),
    `<script>${fileAccessStaticAPI}\n${llmStaticAPI}</script>`,
  ].join("\n");
  // add <script></script> before the 1st <script> element, or at the end of the <head> element;
  let insertPosition = html.indexOf("<script");
  if (insertPosition === -1) insertPosition = html.indexOf("</head>");
  if (insertPosition < 0) {
    console.warn("No <script> or </head> found in the HTML code");
    return html;
  }

  const injectedCode = html.slice(0, insertPosition) + scripts + html.slice(insertPosition);
  return injectedCode;
}

function fileToUrl(file: File) {
  const fileReader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    fileReader.onload = () => resolve(fileReader.result as string);
    fileReader.onerror = reject;
    fileReader.readAsDataURL(file);
  });
}

export function respondReadContent(getContent: (id: string) => string, event: MessageEvent) {
  if (event.data.type === "readContentRequest") {
    const content = getContent(event.data.id);
    event.source?.postMessage({ type: "readContentResponse", content });
  }
}

export function respondWriteContent(writeContent: (content: string) => void, event: MessageEvent) {
  if (event.data.type === "writeContentRequest") {
    try {
      writeContent(event.data.content);
      event.source?.postMessage({ type: "writeContentResponse" });
    } catch (error) {
      console.error("Error writing content:", error);
    }
  }
}

export async function respondReadFile(
  getFile: (name: string) => Promise<File | undefined | null>,
  event: MessageEvent,
) {
  if (event.data.type === "readFileRequest") {
    const file = await getFile(event.data.filename);
    if (!file) {
      console.error(`File not found: ${event.data.filename}`);
      return;
    }
    event.source?.postMessage({ type: "readFileResponse", filename: event.data.filename, file });
  }
}

export async function respondListFiles(getFiles: () => Promise<File[]>, event: MessageEvent) {
  if (event.data.type === "listFilesRequest") {
    const files = await getFiles();
    event.source?.postMessage({ type: "listFilesResponse", files });
  }
}

export function respondWriteFile(
  writeFile: (name: string, writableContent: string | Uint8Array<ArrayBuffer>) => void,
  event: MessageEvent,
) {
  if (event.data.type === "writeFileRequest") {
    try {
      writeFile(event.data.filename, event.data.data);
      event.source?.postMessage({ type: "writeFileResponse", filename: event.data.filename });
    } catch (error) {
      console.error(`Error writing file ${event.data.filename}:`, error);
    }
  }
}

export async function streamToText(stream: AsyncGenerator<string>): Promise<string> {
  let fullResponse = "";
  for await (const chunk of stream) {
    fullResponse += chunk;
  }
  return fullResponse;
}
