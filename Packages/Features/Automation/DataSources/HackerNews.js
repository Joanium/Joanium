export const type = 'hacker_news';
export const meta = { label: 'Hacker News', group: 'Web' };
export async function collect(ds) {
  const count = ds.count ?? 10;
  const typeMap = { top: 'topstories', new: 'newstories', best: 'beststories', ask: 'askstories' };
  const ids = await fetch(
    `https://hacker-news.firebaseio.com/v0/${typeMap[ds.hnType ?? 'top']}.json`,
  ).then((r) => r.json());
  const stories = await Promise.all(
    ids.slice(0, count).map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then((r) => r.json())
        .catch(() => null),
    ),
  );
  const valid = stories.filter(Boolean);
  if (!valid.length) return 'EMPTY: No Hacker News stories found.';
  return (
    `Hacker News ${ds.hnType ?? 'top'} stories:\n\n` +
    valid.map((s, i) => `${i + 1}. ${s.title} (${s.score} pts)`).join('\n\n')
  );
}
