// Every popup is a `.modal-overlay` that the page shows and hides with its inline `display`. Escape and a click on the
// dimmed area around the card close the top one, through the popup's own close or cancel button, so whatever that
// button resets still runs.

const CLOSE_BUTTON = '[id$="-close-btn"], [id$="-cancel-btn"]';

/** The popups on screen, after the open rail page (Escape closes it too); the last one in the page is drawn on top. */
function openModals(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".chat-page, .rail-page, .modal-overlay")).filter((m) => m.style.display !== "none" && m.style.display !== "");
}

/** Close a popup the way its own button does. A popup with no usable close button (the sign-in before there is an identity) stays. */
function closeModal(modal: HTMLElement): boolean {
  const button = modal.querySelector<HTMLButtonElement>(CLOSE_BUTTON);
  if (!button) return false;
  if (button.offsetParent === null) return false; // hidden: there is nothing to go back to yet
  button.click();
  return true;
}

export function installModalDismiss(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (document.querySelector(".lightbox")) return; // the full-size picture closes first
    const top = openModals().pop();
    if (top && closeModal(top)) e.preventDefault();
  });

  // press and release both on the dimmed area: a text selection dragged out of a card must not close it
  let pressedOnBackdrop: EventTarget | null = null;
  document.addEventListener("mousedown", (e) => {
    pressedOnBackdrop = (e.target as HTMLElement).classList?.contains("modal-overlay") ? e.target : null;
  });
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList?.contains("modal-overlay") || target !== pressedOnBackdrop) return;
    pressedOnBackdrop = null;
    if (openModals().pop() === target) closeModal(target);
  });
}
