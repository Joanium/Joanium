export const type = 'fetch_url';
export const meta = { label: 'Web Page', group: 'Web' };
export async function collect(ds) {
  if (!ds.url) return 'No URL specified.';
  try {
    const response = await fetch(ds.url, {
      headers: { 'User-Agent': 'joanium-agent/1.0' },
    });
    if (!response.ok) {
      return `Failed to fetch URL: ${response.status} ${response.statusText}`.trim();
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000);
    if (!text) return `EMPTY: No readable content found at ${ds.url}`;
    return `Content from ${ds.url}:\n\n${text}`;
  } catch (err) {
    return `Failed to fetch URL: ${err.message}`;
  }
}
