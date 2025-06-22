import "./toast.css";

export function showToast(message: string): void {
  // Create a div element for the toast
  const toast = document.createElement("div");

  // Set the message
  toast.textContent = message;

  // Add a class for styling
  toast.className = "toast-message";
  toast.setAttribute("role", "alert");

  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    // HACK: there is no way to display content above native dialog's top layer.
    openDialog.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }

  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
