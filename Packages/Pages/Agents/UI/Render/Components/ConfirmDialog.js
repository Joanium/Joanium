export function createConfirmDialog({
  state: state,
  overlayEl: overlayEl,
  cancelBtn: cancelBtn,
  deleteBtn: deleteBtn,
  nameEl: nameEl,
  onDelete: onDelete,
}) {
  function close() {
    (overlayEl?.classList.remove('open'), (state.deletingId = null));
  }
  const onOverlayClick = (event) => {
      event.target === overlayEl && close();
    },
    onDeleteClick = async () => {
      state.deletingId && (await onDelete(state.deletingId), close());
    };
  return (
    cancelBtn?.addEventListener('click', close),
    overlayEl?.addEventListener('click', onOverlayClick),
    deleteBtn?.addEventListener('click', onDeleteClick),
    {
      open: function (id, name) {
        ((state.deletingId = id),
          nameEl && (nameEl.textContent = name),
          overlayEl?.classList.add('open'));
      },
      close: close,
      cleanup() {
        (cancelBtn?.removeEventListener('click', close),
          overlayEl?.removeEventListener('click', onOverlayClick),
          deleteBtn?.removeEventListener('click', onDeleteClick));
      },
    }
  );
}
