async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';

async function slidesFetch(creds, url, options = {}) {
  const fresh = await getFreshGoogleCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Slides API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getPresentation(creds, presentationId) {
  return slidesFetch(creds, `${SLIDES_BASE}/${presentationId}`);
}

export async function createPresentation(creds, title) {
  return slidesFetch(creds, SLIDES_BASE, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function extractSlideText(slide) {
  const texts = [];
  for (const element of slide.pageElements ?? []) {
    const textContent =
      element.shape?.text ??
      element.table?.tableRows
        ?.flatMap((row) => row.tableCells ?? [])
        ?.flatMap((cell) => (cell.text ? [cell.text] : []));

    const textObj = Array.isArray(textContent) ? textContent[0] : textContent;
    if (!textObj) continue;

    const text = (textObj.textElements ?? [])
      .map((el) => el.textRun?.content ?? '')
      .join('')
      .trim();

    if (text) texts.push(text);
  }
  return texts;
}

export async function addSlide(creds, presentationId, { insertionIndex, layoutId } = {}) {
  const request = { createSlide: {} };
  if (insertionIndex != null) request.createSlide.insertionIndex = insertionIndex;
  if (layoutId) request.createSlide.slideLayoutReference = { layoutId };

  const result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [request] }),
  });

  return result.replies?.[0]?.createSlide ?? null;
}

export async function deleteSlide(creds, presentationId, slideObjectId) {
  await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ deleteObject: { objectId: slideObjectId } }],
    }),
  });
  return true;
}

export async function duplicateSlide(creds, presentationId, slideObjectId) {
  const result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ duplicateObject: { objectId: slideObjectId } }],
    }),
  });
  return result.replies?.[0]?.duplicateObject ?? null;
}

export async function replaceAllText(creds, presentationId, searchText, replacement) {
  const result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          replaceAllText: {
            containsText: { text: searchText, matchCase: true },
            replaceText: replacement,
          },
        },
      ],
    }),
  });
  return result.replies?.[0]?.replaceAllText ?? null;
}
