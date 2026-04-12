export async function resolveTitle(query) {
  const encoded = encodeURIComponent(query);
  try {
    const data = await safeJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
    );
    return data?.title ?? query;
  } catch {
    const search = await safeJson(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
    );
    return search?.[1]?.[0] ?? query;
  }
}
export function fmt(n) {
  return Number(n).toLocaleString();
}
