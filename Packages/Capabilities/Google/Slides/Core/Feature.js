import defineFeature from '../../../Core/DefineFeature.js';
import * as SlidesAPI from './API/SlidesAPI.js';
import { SLIDES_TOOLS } from './Chat/Tools.js';
import { executeSlidesChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default defineFeature({
  id: 'slides',
  name: 'Google Slides',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'slides',
            icon: '<img src="../../../Assets/Icons/Slides.png" alt="Google Slides" style="width: 26px; height: 26px; object-fit: contain;" />',
            name: 'Google Slides',
            apiUrl: 'https://console.cloud.google.com/apis/library/slides.googleapis.com',
          },
        ],
        capabilities: [
          'Read and manage Google Slides presentations',
          'Create presentations and manipulate slides',
        ],
      },
    ],
  },
  main: {
    methods: {
      getPresentation: async (ctx, { presentationId: presentationId }) =>
        withGoogle(ctx, async (credentials) =>
          presentationId
            ? { ok: !0, presentation: await SlidesAPI.getPresentation(credentials, presentationId) }
            : { ok: !1, error: 'presentationId is required' },
        ),
      createPresentation: async (ctx, { title: title }) =>
        withGoogle(ctx, async (credentials) =>
          title
            ? { ok: !0, presentation: await SlidesAPI.createPresentation(credentials, title) }
            : { ok: !1, error: 'title is required' },
        ),
      addSlide: async (
        ctx,
        { presentationId: presentationId, insertionIndex: insertionIndex, layoutId: layoutId } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId
            ? {
                ok: !0,
                reply: await SlidesAPI.addSlide(credentials, presentationId, {
                  insertionIndex: insertionIndex,
                  layoutId: layoutId,
                }),
              }
            : { ok: !1, error: 'presentationId is required' },
        ),
      deleteSlide: async (ctx, { presentationId: presentationId, slideObjectId: slideObjectId }) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? (await SlidesAPI.deleteSlide(credentials, presentationId, slideObjectId), { ok: !0 })
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      duplicateSlide: async (
        ctx,
        { presentationId: presentationId, slideObjectId: slideObjectId },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                reply: await SlidesAPI.duplicateSlide(credentials, presentationId, slideObjectId),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      replaceAllText: async (
        ctx,
        { presentationId: presentationId, searchText: searchText, replacement: replacement },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && searchText
            ? {
                ok: !0,
                result: await SlidesAPI.replaceAllText(
                  credentials,
                  presentationId,
                  searchText,
                  replacement ?? '',
                ),
              }
            : { ok: !1, error: 'presentationId and searchText are required' },
        ),
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeSlidesChatTool(ctx, toolName, params),
      listSlides: async (ctx, { presentationId: presentationId }) =>
        withGoogle(ctx, async (credentials) =>
          presentationId
            ? { ok: !0, slides: await SlidesAPI.listSlides(credentials, presentationId) }
            : { ok: !1, error: 'presentationId is required' },
        ),
      getSlide: async (ctx, { presentationId: presentationId, slideObjectId: slideObjectId }) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                slide: await SlidesAPI.getSlide(credentials, presentationId, slideObjectId),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      reorderSlides: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectIds: slideObjectIds,
          insertionIndex: insertionIndex,
        },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId
            ? Array.isArray(slideObjectIds) && slideObjectIds.length
              ? null == insertionIndex
                ? { ok: !1, error: 'insertionIndex is required' }
                : (await SlidesAPI.reorderSlides(
                    credentials,
                    presentationId,
                    slideObjectIds,
                    insertionIndex,
                  ),
                  { ok: !0 })
              : { ok: !1, error: 'slideObjectIds must be a non-empty array' }
            : { ok: !1, error: 'presentationId is required' },
        ),
      addTextBox: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          text: text,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                result: await SlidesAPI.addTextBox(credentials, presentationId, slideObjectId, {
                  text: text,
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                }),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      updateShapeText: async (
        ctx,
        { presentationId: presentationId, objectId: objectId, text: text },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? null == text
              ? { ok: !1, error: 'text is required' }
              : (await SlidesAPI.updateShapeText(credentials, presentationId, objectId, text),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      addImage: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          imageUrl: imageUrl,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? imageUrl
              ? {
                  ok: !0,
                  result: await SlidesAPI.addImage(credentials, presentationId, slideObjectId, {
                    imageUrl: imageUrl,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                  }),
                }
              : { ok: !1, error: 'imageUrl is required' }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      deleteElement: async (ctx, { presentationId: presentationId, objectId: objectId }) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? (await SlidesAPI.deleteElement(credentials, presentationId, objectId), { ok: !0 })
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      addShape: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          shapeType: shapeType,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                result: await SlidesAPI.addShape(credentials, presentationId, slideObjectId, {
                  shapeType: shapeType,
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                }),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      updateSlideBackground: async (
        ctx,
        { presentationId: presentationId, slideObjectId: slideObjectId, r: r, g: g, b: b },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? null == r || null == g || null == b
              ? { ok: !1, error: 'r, g, b color values are required' }
              : (await SlidesAPI.updateSlideBackground(credentials, presentationId, slideObjectId, {
                  r: r,
                  g: g,
                  b: b,
                }),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      updateTextStyle: async (
        ctx,
        {
          presentationId: presentationId,
          objectId: objectId,
          bold: bold,
          italic: italic,
          underline: underline,
          fontSize: fontSize,
          fontFamily: fontFamily,
          r: r,
          g: g,
          b: b,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? (await SlidesAPI.updateTextStyle(credentials, presentationId, objectId, {
                bold: bold,
                italic: italic,
                underline: underline,
                fontSize: fontSize,
                fontFamily: fontFamily,
                r: r,
                g: g,
                b: b,
              }),
              { ok: !0 })
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      addTable: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          rows: rows,
          columns: columns,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                result: await SlidesAPI.addTable(credentials, presentationId, slideObjectId, {
                  rows: rows,
                  columns: columns,
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                }),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      moveElement: async (
        ctx,
        { presentationId: presentationId, objectId: objectId, x: x, y: y } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? null == x || null == y
              ? { ok: !1, error: 'x and y are required' }
              : (await SlidesAPI.moveElement(credentials, presentationId, objectId, { x: x, y: y }),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      addSpeakerNotes: async (
        ctx,
        { presentationId: presentationId, slideObjectId: slideObjectId, notes: notes },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? notes
              ? (await SlidesAPI.addSpeakerNotes(credentials, presentationId, slideObjectId, notes),
                { ok: !0 })
              : { ok: !1, error: 'notes is required' }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      updateParagraphAlignment: async (
        ctx,
        { presentationId: presentationId, objectId: objectId, alignment: alignment },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? alignment
              ? (await SlidesAPI.updateParagraphAlignment(
                  credentials,
                  presentationId,
                  objectId,
                  alignment,
                ),
                { ok: !0 })
              : { ok: !1, error: 'alignment is required' }
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      updateShapeFill: async (
        ctx,
        { presentationId: presentationId, objectId: objectId, r: r, g: g, b: b, alpha: alpha } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && objectId
            ? null == r || null == g || null == b
              ? { ok: !1, error: 'r, g, b color values are required' }
              : (await SlidesAPI.updateShapeFill(credentials, presentationId, objectId, {
                  r: r,
                  g: g,
                  b: b,
                  alpha: alpha,
                }),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and objectId are required' },
        ),
      insertTableRows: async (
        ctx,
        {
          presentationId: presentationId,
          tableObjectId: tableObjectId,
          rowIndex: rowIndex,
          insertBelow: insertBelow,
          count: count,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && tableObjectId
            ? null == rowIndex
              ? { ok: !1, error: 'rowIndex is required' }
              : (await SlidesAPI.insertTableRows(credentials, presentationId, tableObjectId, {
                  rowIndex: rowIndex,
                  insertBelow: insertBelow,
                  count: count,
                }),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and tableObjectId are required' },
        ),
      deleteTableRow: async (
        ctx,
        { presentationId: presentationId, tableObjectId: tableObjectId, rowIndex: rowIndex },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && tableObjectId
            ? null == rowIndex
              ? { ok: !1, error: 'rowIndex is required' }
              : (await SlidesAPI.deleteTableRow(
                  credentials,
                  presentationId,
                  tableObjectId,
                  rowIndex,
                ),
                { ok: !0 })
            : { ok: !1, error: 'presentationId and tableObjectId are required' },
        ),
      updateTableCellText: async (
        ctx,
        {
          presentationId: presentationId,
          tableObjectId: tableObjectId,
          rowIndex: rowIndex,
          columnIndex: columnIndex,
          text: text,
        },
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && tableObjectId
            ? null == rowIndex || null == columnIndex
              ? { ok: !1, error: 'rowIndex and columnIndex are required' }
              : null == text
                ? { ok: !1, error: 'text is required' }
                : (await SlidesAPI.updateTableCellText(
                    credentials,
                    presentationId,
                    tableObjectId,
                    rowIndex,
                    columnIndex,
                    text,
                  ),
                  { ok: !0 })
            : { ok: !1, error: 'presentationId and tableObjectId are required' },
        ),
      addLine: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          lineCategory: lineCategory,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? {
                ok: !0,
                result: await SlidesAPI.addLine(credentials, presentationId, slideObjectId, {
                  lineCategory: lineCategory,
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                }),
              }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
      addVideo: async (
        ctx,
        {
          presentationId: presentationId,
          slideObjectId: slideObjectId,
          videoId: videoId,
          x: x,
          y: y,
          width: width,
          height: height,
        } = {},
      ) =>
        withGoogle(ctx, async (credentials) =>
          presentationId && slideObjectId
            ? videoId
              ? {
                  ok: !0,
                  result: await SlidesAPI.addVideo(credentials, presentationId, slideObjectId, {
                    videoId: videoId,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                  }),
                }
              : { ok: !1, error: 'videoId is required' }
            : { ok: !1, error: 'presentationId and slideObjectId are required' },
        ),
    },
  },
  renderer: { chatTools: SLIDES_TOOLS },
});
