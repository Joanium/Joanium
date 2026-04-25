import { createGoogleJsonFetch } from '../../../Core/API/GoogleApiFetch.js';

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';
const slidesFetch = createGoogleJsonFetch('Slides');
function pt(value) {
  return { magnitude: 12700 * value, unit: 'EMU' };
}
function elementProperties(pageObjectId, x, y, width, height) {
  return {
    pageObjectId: pageObjectId,
    size: { width: pt(width), height: pt(height) },
    transform: { scaleX: 1, scaleY: 1, translateX: 12700 * x, translateY: 12700 * y, unit: 'EMU' },
  };
}
export async function getPresentation(creds, presentationId) {
  return slidesFetch(creds, `${SLIDES_BASE}/${presentationId}`);
}
export async function createPresentation(creds, title) {
  return slidesFetch(creds, SLIDES_BASE, {
    method: 'POST',
    body: JSON.stringify({ title: title }),
  });
}
export function extractSlideText(slide) {
  const texts = [];
  for (const element of slide.pageElements ?? []) {
    const textContent =
        element.shape?.text ??
        element.table?.tableRows
          ?.flatMap((row) => row.tableCells ?? [])
          ?.flatMap((cell) => (cell.text ? [cell.text] : [])),
      textObj = Array.isArray(textContent) ? textContent[0] : textContent;
    if (!textObj) continue;
    const text = (textObj.textElements ?? [])
      .map((el) => el.textRun?.content ?? '')
      .join('')
      .trim();
    text && texts.push(text);
  }
  return texts;
}
export async function addSlide(
  creds,
  presentationId,
  { insertionIndex: insertionIndex, layoutId: layoutId } = {},
) {
  const request = { createSlide: {} };
  (null != insertionIndex && (request.createSlide.insertionIndex = insertionIndex),
    layoutId && (request.createSlide.slideLayoutReference = { layoutId: layoutId }));
  const result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [request] }),
  });
  return result.replies?.[0]?.createSlide ?? null;
}
export async function deleteSlide(creds, presentationId, slideObjectId) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteObject: { objectId: slideObjectId } }] }),
    }),
    !0
  );
}
export async function duplicateSlide(creds, presentationId, slideObjectId) {
  const result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ duplicateObject: { objectId: slideObjectId } }] }),
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
            containsText: { text: searchText, matchCase: !0 },
            replaceText: replacement,
          },
        },
      ],
    }),
  });
  return result.replies?.[0]?.replaceAllText ?? null;
}
export async function listSlides(creds, presentationId) {
  return ((await getPresentation(creds, presentationId)).slides ?? []).map((slide, i) => ({
    index: i + 1,
    objectId: slide.objectId,
    speakerNotesObjectId:
      slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId ?? null,
    elementCount: (slide.pageElements ?? []).length,
  }));
}
export async function getSlide(creds, presentationId, slideObjectId) {
  const slide = ((await getPresentation(creds, presentationId)).slides ?? []).find(
    (s) => s.objectId === slideObjectId,
  );
  if (!slide) throw new Error(`Slide "${slideObjectId}" not found in presentation.`);
  return slide;
}
export async function reorderSlides(creds, presentationId, slideObjectIds, insertionIndex) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSlidesPosition: {
              slideObjectIds: slideObjectIds,
              insertionIndex: insertionIndex,
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function addTextBox(
  creds,
  presentationId,
  slideObjectId,
  { text: text = '', x: x = 100, y: y = 100, width: width = 300, height: height = 60 } = {},
) {
  const boxId = `textbox_${Date.now()}`,
    requests = [
      {
        createShape: {
          objectId: boxId,
          shapeType: 'TEXT_BOX',
          elementProperties: elementProperties(slideObjectId, x, y, width, height),
        },
      },
    ];
  return (
    text && requests.push({ insertText: { objectId: boxId, insertionIndex: 0, text: text } }),
    {
      objectId: boxId,
      replies: (
        await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
          method: 'POST',
          body: JSON.stringify({ requests: requests }),
        })
      ).replies,
    }
  );
}
export async function updateShapeText(creds, presentationId, objectId, newText) {
  const requests = [
    { deleteText: { objectId: objectId, textRange: { type: 'ALL' } } },
    { insertText: { objectId: objectId, insertionIndex: 0, text: newText } },
  ];
  return slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: requests }),
  });
}
export async function addImage(
  creds,
  presentationId,
  slideObjectId,
  { imageUrl: imageUrl, x: x = 50, y: y = 50, width: width = 300, height: height = 200 } = {},
) {
  const imgId = `image_${Date.now()}`,
    result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            createImage: {
              objectId: imgId,
              url: imageUrl,
              elementProperties: elementProperties(slideObjectId, x, y, width, height),
            },
          },
        ],
      }),
    });
  return { objectId: imgId, reply: result.replies?.[0] ?? null };
}
export async function deleteElement(creds, presentationId, objectId) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteObject: { objectId: objectId } }] }),
    }),
    !0
  );
}
export async function addShape(
  creds,
  presentationId,
  slideObjectId,
  {
    shapeType: shapeType = 'RECTANGLE',
    x: x = 100,
    y: y = 100,
    width: width = 200,
    height: height = 150,
  } = {},
) {
  const shapeId = `shape_${Date.now()}`,
    result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            createShape: {
              objectId: shapeId,
              shapeType: shapeType,
              elementProperties: elementProperties(slideObjectId, x, y, width, height),
            },
          },
        ],
      }),
    });
  return { objectId: shapeId, reply: result.replies?.[0] ?? null };
}
export async function updateSlideBackground(
  creds,
  presentationId,
  slideObjectId,
  { r: r, g: g, b: b },
) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updatePageProperties: {
              objectId: slideObjectId,
              pageProperties: {
                pageBackgroundFill: {
                  solidFill: {
                    color: { rgbColor: { red: r / 255, green: g / 255, blue: b / 255 } },
                  },
                },
              },
              fields: 'pageBackgroundFill',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function updateTextStyle(
  creds,
  presentationId,
  objectId,
  {
    bold: bold,
    italic: italic,
    underline: underline,
    fontSize: fontSize,
    fontFamily: fontFamily,
    r: r,
    g: g,
    b: b,
  } = {},
) {
  const style = {},
    fieldList = [];
  if (
    (null != bold && ((style.bold = bold), fieldList.push('bold')),
    null != italic && ((style.italic = italic), fieldList.push('italic')),
    null != underline && ((style.underline = underline), fieldList.push('underline')),
    null != fontSize &&
      ((style.fontSize = { magnitude: fontSize, unit: 'PT' }), fieldList.push('fontSize')),
    null != fontFamily && ((style.fontFamily = fontFamily), fieldList.push('fontFamily')),
    null != r &&
      null != g &&
      null != b &&
      ((style.foregroundColor = {
        opaqueColor: { rgbColor: { red: r / 255, green: g / 255, blue: b / 255 } },
      }),
      fieldList.push('foregroundColor')),
    !fieldList.length)
  )
    throw new Error('No style properties provided.');
  return slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateTextStyle: {
            objectId: objectId,
            textRange: { type: 'ALL' },
            style: style,
            fields: fieldList.join(','),
          },
        },
      ],
    }),
  });
}
export async function addTable(
  creds,
  presentationId,
  slideObjectId,
  {
    rows: rows = 3,
    columns: columns = 3,
    x: x = 50,
    y: y = 100,
    width: width = 450,
    height: height = 200,
  } = {},
) {
  const tableId = `table_${Date.now()}`,
    result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            createTable: {
              objectId: tableId,
              rows: rows,
              columns: columns,
              elementProperties: elementProperties(slideObjectId, x, y, width, height),
            },
          },
        ],
      }),
    });
  return { objectId: tableId, reply: result.replies?.[0] ?? null };
}
export async function moveElement(
  creds,
  presentationId,
  objectId,
  { x: x, y: y, scaleX: scaleX = 1, scaleY: scaleY = 1 },
) {
  const transform = {
    scaleX: scaleX,
    scaleY: scaleY,
    translateX: 12700 * x,
    translateY: 12700 * y,
    unit: 'EMU',
  };
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updatePageElementTransform: {
              objectId: objectId,
              transform: transform,
              applyMode: 'ABSOLUTE',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function addSpeakerNotes(creds, presentationId, slideObjectId, notes) {
  const slide = ((await getPresentation(creds, presentationId)).slides ?? []).find(
    (s) => s.objectId === slideObjectId,
  );
  if (!slide) throw new Error(`Slide "${slideObjectId}" not found.`);
  const speakerNotesId = slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;
  if (!speakerNotesId) throw new Error('Could not find speaker notes object for this slide.');
  const requests = [
    { deleteText: { objectId: speakerNotesId, textRange: { type: 'ALL' } } },
    { insertText: { objectId: speakerNotesId, insertionIndex: 0, text: notes } },
  ];
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: requests }),
    }),
    !0
  );
}
export async function updateParagraphAlignment(creds, presentationId, objectId, alignment) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateParagraphStyle: {
              objectId: objectId,
              textRange: { type: 'ALL' },
              style: { alignment: alignment },
              fields: 'alignment',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function updateShapeFill(
  creds,
  presentationId,
  objectId,
  { r: r, g: g, b: b, alpha: alpha = 1 },
) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateShapeProperties: {
              objectId: objectId,
              shapeProperties: {
                shapeBackgroundFill: {
                  solidFill: {
                    color: { rgbColor: { red: r / 255, green: g / 255, blue: b / 255 } },
                    alpha: alpha,
                  },
                },
              },
              fields: 'shapeBackgroundFill',
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function insertTableRows(
  creds,
  presentationId,
  tableObjectId,
  { rowIndex: rowIndex = 0, insertBelow: insertBelow = !0, count: count = 1 } = {},
) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertTableRows: {
              tableObjectId: tableObjectId,
              cellLocation: { rowIndex: rowIndex },
              insertBelow: insertBelow,
              number: count,
            },
          },
        ],
      }),
    }),
    !0
  );
}
export async function deleteTableRow(creds, presentationId, tableObjectId, rowIndex) {
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteTableRow: { tableObjectId: tableObjectId, cellLocation: { rowIndex: rowIndex } },
          },
        ],
      }),
    }),
    !0
  );
}
export async function updateTableCellText(
  creds,
  presentationId,
  tableObjectId,
  rowIndex,
  columnIndex,
  text,
) {
  const requests = [
    {
      deleteText: {
        objectId: tableObjectId,
        cellLocation: { rowIndex: rowIndex, columnIndex: columnIndex },
        textRange: { type: 'ALL' },
      },
    },
    {
      insertText: {
        objectId: tableObjectId,
        cellLocation: { rowIndex: rowIndex, columnIndex: columnIndex },
        insertionIndex: 0,
        text: text,
      },
    },
  ];
  return (
    await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: requests }),
    }),
    !0
  );
}
export async function addLine(
  creds,
  presentationId,
  slideObjectId,
  {
    lineCategory: lineCategory = 'STRAIGHT',
    x: x = 50,
    y: y = 50,
    width: width = 200,
    height: height = 0,
  } = {},
) {
  const lineId = `line_${Date.now()}`,
    result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            createLine: {
              objectId: lineId,
              lineCategory: lineCategory,
              elementProperties: elementProperties(
                slideObjectId,
                x,
                y,
                Math.max(width, 1),
                Math.max(height, 1),
              ),
            },
          },
        ],
      }),
    });
  return { objectId: lineId, reply: result.replies?.[0] ?? null };
}
export async function addVideo(
  creds,
  presentationId,
  slideObjectId,
  { videoId: videoId, x: x = 100, y: y = 100, width: width = 320, height: height = 180 } = {},
) {
  const vidId = `video_${Date.now()}`,
    result = await slidesFetch(creds, `${SLIDES_BASE}/${presentationId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            createVideo: {
              objectId: vidId,
              source: 'YOUTUBE',
              id: videoId,
              elementProperties: elementProperties(slideObjectId, x, y, width, height),
            },
          },
        ],
      }),
    });
  return { objectId: vidId, reply: result.replies?.[0] ?? null };
}
