export function createCardPool({
  container: container,
  createCard: createCard,
  updateCard: updateCard,
  getKey: getKey,
}) {
  const pool = new Map(),
    active = new Set();
  return {
    render: function (items) {
      active.clear();
      for (let i = 0; i < items.length; i++) {
        const key = getKey(items[i]);
        let card = pool.get(key);
        (card || ((card = createCard()), pool.set(key, card), container.appendChild(card)),
          updateCard(card, items[i]),
          (card.style.display = ''),
          active.add(card));
      }
      for (const [key, card] of pool) active.has(card) || (card.style.display = 'none');
    },
    clear: function () {
      for (const [, card] of pool) card.remove();
      (pool.clear(), active.clear());
    },
    size: () => pool.size,
  };
}
