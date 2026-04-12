export const type = 'fetch_url';
export const meta = { label: 'Web Page', group: 'Web' };
export async function collect(ds) {
  if (!ds.url) return 'No URL specified.';
  try {
    const response = await fetch(ds.url, { headers: { 'User-Agent': 'joanium-agent/1.0' } });
    if (!response.ok)
      return `Failed to fetch URL: ${response.status} ${response.statusText}`.trim();
    const text = (await response.text())
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6e3);
    return text
      ? `Content from ${ds.url}:\n\n${text}`
      : `EMPTY: No readable content found at ${ds.url}`;
  } catch (err) {
    return `Failed to fetch URL: ${err.message}`;
  }
}
