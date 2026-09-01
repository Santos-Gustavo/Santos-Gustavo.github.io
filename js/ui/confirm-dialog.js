// js/ui/confirm-dialog.js

let resolvePending = null;

function getEls() {
  return {
    overlay: document.getElementById("confirmDialog"),
    title: document.getElementById("confirmDialogTitle"),
    message: document.getElementById("confirmDialogMessage"),
    cancelBtn: document.querySelector('[data-confirm-action="cancel"]'),
    confirmBtn: document.querySelector('[data-confirm-action="confirm"]'),
  };
}

export function initConfirmDialog() {
  const { overlay, cancelBtn, confirmBtn } = getEls();
  if (!overlay || !cancelBtn || !confirmBtn) return;

  cancelBtn.addEventListener("click", () => settle(false));
  confirmBtn.addEventListener("click", () => settle(true));

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) settle(false);
  });
}

function settle(result) {
  const { overlay } = getEls();
  if (overlay) overlay.hidden = true;

  if (resolvePending) {
    const resolve = resolvePending;
    resolvePending = null;
    resolve(result);
  }
}

export function confirmAction({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
}) {
  const { overlay, title: titleEl, message: messageEl, cancelBtn, confirmBtn } = getEls();

  if (!overlay || !titleEl || !messageEl || !cancelBtn || !confirmBtn) {
    return Promise.resolve(true);
  }

  titleEl.textContent = title || "";
  messageEl.textContent = message || "";
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;

  overlay.hidden = false;

  return new Promise((resolve) => {
    resolvePending = resolve;
  });
}
