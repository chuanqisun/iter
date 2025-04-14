import { getReadableFileSize } from "../../chat-tree/file-size";

export function getFileAccessPostscript(files: File[]) {
  const filePostScript = files?.length
    ? `Files uploaded:
${files.map((file) => `- Filename: ${file.name} | Size: ${getReadableFileSize(file.size)}${file.type ? ` | Type: ${file.type})` : ""}`).join("\n")}

Uploaded files can only be accessed in browser via global javascript API  \`window.readonlyFS.getFile(filename: string): Promise<File>\`
`
    : "";

  return filePostScript;
}

export function injectIframeFileAccessToDocument(html: string) {
  // add <script</script> before the 1st <script> element, or at the end of the <head> element;
  let insertPosition = html.indexOf("<script");
  if (insertPosition === -1) insertPosition = html.indexOf("</head>");
  if (insertPosition < 0) {
    console.warn("No <script> or </head> found in the HTML code");
    return;
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
  `;

  return scriptContent;
}

export async function embedFileAccessToDocument(html: string) {
  // get files from window postMessage
  const files = await new Promise<File[]>((resolve) => {
    window.addEventListener("message", (event) => {
      if (event.data.type === "listFiles" && event.data.files) {
        resolve(event.data.files);
      }
    });
    window.postMessage({ type: "listFiles" }, "*");
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
`.trim();

  return scriptContent;
}

export function respondFileAccess(getFile: (name: string) => File | undefined | null, event: MessageEvent) {
  if (event.data.type === "readFile") {
    const file = getFile(event.data.filename);
    if (!file) {
      console.error(`File not found: ${event.data.filename}`);
      return;
    }
    event.source?.postMessage({ type: "readFile", filename: event.data.filename, file });
  }
}

export function respondFileList(getFiles: () => File[], event: MessageEvent) {
  if (event.data.type === "listFiles") {
    const files = getFiles();
    event.source?.postMessage({ type: "listFiles", files });
  }
}
