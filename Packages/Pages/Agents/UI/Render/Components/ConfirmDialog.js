export function createConfirmDialog({
  state,
  overlayEl,
  cancelBtn,
  deleteBtn,
  nameEl,
  onDelete,
}) {
  function open(id, name) {
    state.deletingId = id;
    if (nameEl) nameEl.textContent = name;
    overlayEl?.classList.add('open');
  }

  function close() {
    overlayEl?.classList.remove('open');
    state.deletingId = null;
  }

  const onOverlayClick = event => {
    if (event.target === overlayEl) close();
  };

  const onDeleteClick = async () => {
    if (!state.deletingId) return;
    await onDelete(state.deletingId);
    close();
  };

  cancelBtn?.addEventListener('click', close);
  overlayEl?.addEventListener('click', onOverlayClick);
  deleteBtn?.addEventListener('click', onDeleteClick);

  return {
    open,
    close,
    cleanup() {
      cancelBtn?.removeEventListener('click', close);
      overlayEl?.removeEventListener('click', onOverlayClick);
      deleteBtn?.removeEventListener('click', onDeleteClick);
    },
  };
}
