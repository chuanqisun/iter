import { getReadableFileSize } from "../../chat-tree/file-size";

export function getFileAccessPostscript(files: File[]) {
  const filePostScript = files?.length
    ? `Files uploaded:
${files.map((file) => `- Filename: ${file.name} | Size: ${getReadableFileSize(file.size)} | Type: ${file.type})`).join("\n")}

Uploaded files can only be accessed from  \`window.readonlyFS.readFileAsync(filename: string)\`
`
    : "";

  return filePostScript;
}
