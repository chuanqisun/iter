import { getReadableFileSize } from "../../chat-tree/file-size";

export function getReadonlyFileAccessPostscript(files: File[]) {
  const filePostScript = files?.length
    ? `Files uploaded:
${files.map((file) => `- Filename: ${file.name} | Size: ${getReadableFileSize(file.size)}${file.type ? ` | Type: ${file.type}` : ""}`).join("\n")}

Uploaded files can only be accessed in browser via global javascript API  \`window.readonlyFS.getFile(filename: string): Promise<File>\`
`
    : "";

  return filePostScript;
}

export function getCodeInterpreterPrompt(): string {
  return `
Write a JavaScript program based on user's goal or instruction.

To output data, you must use the global javascript API  \`window.writeonlyFS.writeFile(filename: string, data: string | Blob): Promise<void>\`

Respond in a markdown code block like this:

\`\`\`javascript 
// ...
\`\`\``;
}

export function injectIframeFileAccessToDocument(html: string) {
  // add <script</script> before the 1st <script> element, or at the end of the <head> element;
  let insertPosition = html.indexOf("<script");
  if (insertPosition === -1) insertPosition = html.indexOf("</head>");
  if (insertPosition < 0) {
    console.warn("No <script> or </head> found in the HTML code");
    return html;
  }

  const injectedCode =
    html.slice(0, insertPosition) + `<script>${iframeFileAccessAPISource()}</script>` + html.slice(insertPosition);
  return injectedCode;
}

function iframeFileAccessAPISource() {
  const scriptContent = `
globalThis.readonlyFS = {
  async getFile(filename) {
    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "readFile", filename }, "*");
      window.addEventListener("message", (event) => {
        if (event.data.type === "readFile" && event.data.filename === filename) {
          resolve(event.data.file);
        }
      });
    });
  }
}

globalThis.writeonlyFS = {
  async writeFile(filename, textOrBlob) {

    const writableContent = typeof textOrBlob === "string" ? textOrBlob : await textOrBlob.arrayBuffer().then(buffer => new Uint8Array(buffer));

    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "writeFile", filename, data: writableContent }, "*");
      window.addEventListener("message", (event) => {
        if (event.data.type === "writeFile" && event.data.filename === filename) {
          resolve();
        }
      });
    });
  }
}
  `;

  return scriptContent;
}

export async function embedFileAccessToDocument(html: string) {
  // get files from window postMessage
  const files = await new Promise<File[]>((resolve) => {
    const abortController = new AbortController();
    // note we are sending and receiving on the same window.
    // We must define an exit condition to prevent accumulating listeners.
    window.postMessage({ type: "listFiles" }, "*");
    window.addEventListener(
      "message",
      (event) => {
        if (event.data.type === "listFiles" && event.data.files) {
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
    `<script>${embedFileAccessAPISource()}</script>`,
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

/** Get readonly files from the script tags, and handle write files by downloading them with a temporary <a> tag */
function embedFileAccessAPISource() {
  const scriptContent = `
globalThis.readonlyFS = {
  async getFile(filename) {
    const script = document.querySelector(\`script[type="embedded-file"][filename="\${filename}"]\`);
    if (!script) {
      throw new Error(\`File not found: \${filename}\`);
    }
    const data = script.getAttribute("data");
    // fetch dataUrl into File object
    const blob = await (await fetch(data)).blob();
    const file = new File([blob], filename, { type: blob.type });
    return file;
  }
}

globalThis.writeonlyFS = {
  async writeFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
`.trim();

  return scriptContent;
}

export function respondReadFile(getFile: (name: string) => File | undefined | null, event: MessageEvent) {
  if (event.data.type === "readFile") {
    const file = getFile(event.data.filename);
    if (!file) {
      console.error(`File not found: ${event.data.filename}`);
      return;
    }
    event.source?.postMessage({ type: "readFile", filename: event.data.filename, file });
  }
}

export function respondListFiles(getFiles: () => File[], event: MessageEvent) {
  if (event.data.type === "listFiles") {
    const files = getFiles();
    event.source?.postMessage({ type: "listFiles", files });
  }
}

export function respondWriteFile(
  writeFile: (name: string, writableContent: string | Uint8Array) => void,
  event: MessageEvent,
) {
  if (event.data.type === "writeFile") {
    try {
      writeFile(event.data.filename, event.data.data);
      event.source?.postMessage({ type: "writeFile", filename: event.data.filename });
    } catch (error) {
      console.error(`Error writing file ${event.data.filename}:`, error);
    }
  }
}
