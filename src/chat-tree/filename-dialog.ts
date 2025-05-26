import "./filename-dialog.css";

export interface GetFilenameOptions {
  initalValue?: string;
  placeholder?: string;
}
export async function getFilename(options: GetFilenameOptions): Promise<string | false> {
  const dialog = document.querySelector<HTMLDialogElement>("#dynamic-dialog")!;

  dialog.innerHTML = "";
  dialog.appendChild(renderDialog(options));
  dialog.querySelector("input")!.focus();

  // if there is value in the input, select the portion before the last dot
  selectBeforeLastDot(dialog.querySelector("input")!);

  dialog.showModal();

  return new Promise((resolve) => {
    const form = dialog.querySelector<HTMLFormElement>("#filename-form")!;
    const input = form.querySelector<HTMLInputElement>("#filename")!;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      dialog.close();
      resolve(input.value.trim() || false);
    });

    dialog.addEventListener("cancel", () => {
      dialog.close();
      resolve(false);
    });
  });
}

function renderDialog(options: GetFilenameOptions): DocumentFragment {
  const templateHtml = `
<form id="filename-form">
  <label for="filename">Filename</label>
  <input type="text" id="filename" name="filename" required placeholder="${options.placeholder || "filename.ext"}" value="${options.initalValue || ""}" />
</form>
  `;

  const template = document.createElement("template");
  template.innerHTML = templateHtml.trim();
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  return fragment;
}

function selectBeforeLastDot(input: HTMLInputElement) {
  const value = input.value;
  const lastDotIndex = value.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    input.setSelectionRange(0, lastDotIndex);
  } else {
    input.setSelectionRange(0, value.length);
  }
}
