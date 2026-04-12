import * as SlidesAPI from '../API/SlidesAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
export async function executeSlidesChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'slides_get_info': {
      const { presentation_id: presentation_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const pres = await SlidesAPI.getPresentation(credentials, presentation_id.trim()),
        slideCount = (pres.slides ?? []).length,
        size = pres.pageSize,
        w = size?.width?.magnitude?.toFixed(0),
        h = size?.height?.magnitude?.toFixed(0);
      return [
        `**${pres.title ?? 'Untitled Presentation'}**`,
        `Presentation ID: \`${pres.presentationId}\``,
        `Slides: ${slideCount}`,
        w && h ? `Slide size: ${w} × ${h} ${size.width?.unit ?? 'pt'}` : '',
        `Link: https://docs.google.com/presentation/d/${pres.presentationId}/edit`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'slides_read': {
      const { presentation_id: presentation_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const pres = await SlidesAPI.getPresentation(credentials, presentation_id.trim()),
        slides = pres.slides ?? [];
      if (!slides.length) return `Presentation "${pres.title ?? presentation_id}" has no slides.`;
      const sections = slides.map((slide, i) => {
        const texts = SlidesAPI.extractSlideText(slide);
        return [
          `── Slide ${i + 1} (ID: \`${slide.objectId ?? ''}\`) ──`,
          texts.length ? texts.join('\n') : '(no text)',
        ].join('\n');
      });
      return [
        `**${pres.title ?? 'Untitled'}** — ${slides.length} slide${1 !== slides.length ? 's' : ''}`,
        '',
        sections.join('\n\n'),
      ].join('\n');
    }
    case 'slides_create': {
      const { title: title } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const pres = await SlidesAPI.createPresentation(credentials, title.trim());
      return [
        'Presentation created',
        `Title: ${pres.title}`,
        `ID: \`${pres.presentationId}\``,
        `Link: https://docs.google.com/presentation/d/${pres.presentationId}/edit`,
      ].join('\n');
    }
    case 'slides_add_slide': {
      const { presentation_id: presentation_id, insertion_index: insertion_index } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const reply = await SlidesAPI.addSlide(credentials, presentation_id.trim(), {
        insertionIndex: null != insertion_index ? Number(insertion_index) : void 0,
      });
      return ['Slide added', reply?.objectId ? `Slide ID: \`${reply.objectId}\`` : '']
        .filter(Boolean)
        .join('\n');
    }
    case 'slides_delete_slide': {
      const { presentation_id: presentation_id, slide_object_id: slide_object_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      return (
        await SlidesAPI.deleteSlide(credentials, presentation_id.trim(), slide_object_id.trim()),
        `Slide \`${slide_object_id}\` deleted from presentation.`
      );
    }
    case 'slides_duplicate_slide': {
      const { presentation_id: presentation_id, slide_object_id: slide_object_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      const reply = await SlidesAPI.duplicateSlide(
        credentials,
        presentation_id.trim(),
        slide_object_id.trim(),
      );
      return [
        `Slide \`${slide_object_id}\` duplicated`,
        reply?.objectId ? `New slide ID: \`${reply.objectId}\`` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'slides_replace_text': {
      const {
        presentation_id: presentation_id,
        search_text: search_text,
        replacement: replacement,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!search_text) throw new Error('Missing required param: search_text');
      if (null == replacement) throw new Error('Missing required param: replacement');
      const reply = await SlidesAPI.replaceAllText(
          credentials,
          presentation_id.trim(),
          search_text,
          String(replacement),
        ),
        count = reply?.occurrencesChanged ?? 0;
      return count > 0
        ? `Replaced ${count} occurrence${1 !== count ? 's' : ''} of "${search_text}" across all slides.`
        : `No occurrences of "${search_text}" found in the presentation.`;
    }
    case 'slides_list_slides': {
      const { presentation_id: presentation_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const slides = await SlidesAPI.listSlides(credentials, presentation_id.trim());
      if (!slides.length) return 'Presentation has no slides.';
      const rows = slides.map(
        (s) =>
          `Slide ${s.index}: ID \`${s.objectId}\` — ${s.elementCount} element${1 !== s.elementCount ? 's' : ''}${s.speakerNotesObjectId ? ` (notes ID: \`${s.speakerNotesObjectId}\`)` : ''}`,
      );
      return [`**${slides.length} slide${1 !== slides.length ? 's' : ''}**`, ...rows].join('\n');
    }
    case 'slides_get_slide': {
      const { presentation_id: presentation_id, slide_object_id: slide_object_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      const slide = await SlidesAPI.getSlide(
          credentials,
          presentation_id.trim(),
          slide_object_id.trim(),
        ),
        elements = slide.pageElements ?? [];
      return [
        `**Slide** \`${slide.objectId}\``,
        `Elements: ${elements.length}`,
        '',
        ...elements.map((el, i) => {
          const kind = el.shape
              ? `shape (${el.shape.shapeType ?? 'unknown'})`
              : el.image
                ? 'image'
                : el.table
                  ? `table (${el.table.rows}×${el.table.columns})`
                  : el.video
                    ? 'video'
                    : el.line
                      ? 'line'
                      : 'element',
            texts = SlidesAPI.extractSlideText({ pageElements: [el] }),
            preview = texts.length
              ? ` — "${texts[0].slice(0, 60)}${texts[0].length > 60 ? '…' : ''}"`
              : '';
          return `${i + 1}. \`${el.objectId}\` — ${kind}${preview}`;
        }),
      ].join('\n');
    }
    case 'slides_reorder_slides': {
      const {
        presentation_id: presentation_id,
        slide_object_ids: slide_object_ids,
        insertion_index: insertion_index,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!Array.isArray(slide_object_ids) || !slide_object_ids.length)
        throw new Error('Missing required param: slide_object_ids (must be a non-empty array)');
      if (null == insertion_index) throw new Error('Missing required param: insertion_index');
      return (
        await SlidesAPI.reorderSlides(
          credentials,
          presentation_id.trim(),
          slide_object_ids,
          Number(insertion_index),
        ),
        `Moved ${slide_object_ids.length} slide${1 !== slide_object_ids.length ? 's' : ''} to position ${insertion_index}.`
      );
    }
    case 'slides_add_text_box': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        text: text,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      return [
        'Text box added',
        `Element ID: \`${(await SlidesAPI.addTextBox(credentials, presentation_id.trim(), slide_object_id.trim(), { text: text ?? '', x: null != x ? Number(x) : 100, y: null != y ? Number(y) : 100, width: null != width ? Number(width) : 300, height: null != height ? Number(height) : 60 })).objectId}\``,
        text ? `Content: "${text}"` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'slides_update_text': {
      const { presentation_id: presentation_id, object_id: object_id, text: text } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      if (null == text) throw new Error('Missing required param: text');
      return (
        await SlidesAPI.updateShapeText(
          credentials,
          presentation_id.trim(),
          object_id.trim(),
          String(text),
        ),
        `Text in element \`${object_id}\` updated.`
      );
    }
    case 'slides_add_image': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        image_url: image_url,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      if (!image_url?.trim()) throw new Error('Missing required param: image_url');
      return [
        'Image added',
        `Element ID: \`${(await SlidesAPI.addImage(credentials, presentation_id.trim(), slide_object_id.trim(), { imageUrl: image_url.trim(), x: null != x ? Number(x) : 50, y: null != y ? Number(y) : 50, width: null != width ? Number(width) : 300, height: null != height ? Number(height) : 200 })).objectId}\``,
      ].join('\n');
    }
    case 'slides_delete_element': {
      const { presentation_id: presentation_id, object_id: object_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      return (
        await SlidesAPI.deleteElement(credentials, presentation_id.trim(), object_id.trim()),
        `Element \`${object_id}\` deleted.`
      );
    }
    case 'slides_add_shape': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        shape_type: shape_type,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      const result = await SlidesAPI.addShape(
        credentials,
        presentation_id.trim(),
        slide_object_id.trim(),
        {
          shapeType: shape_type?.trim() ?? 'RECTANGLE',
          x: null != x ? Number(x) : 100,
          y: null != y ? Number(y) : 100,
          width: null != width ? Number(width) : 200,
          height: null != height ? Number(height) : 150,
        },
      );
      return [
        `${shape_type ?? 'RECTANGLE'} shape added`,
        `Element ID: \`${result.objectId}\``,
      ].join('\n');
    }
    case 'slides_update_background': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        r: r,
        g: g,
        b: b,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      if (null == r || null == g || null == b) throw new Error('Missing required params: r, g, b');
      return (
        await SlidesAPI.updateSlideBackground(
          credentials,
          presentation_id.trim(),
          slide_object_id.trim(),
          { r: Number(r), g: Number(g), b: Number(b) },
        ),
        `Slide \`${slide_object_id}\` background set to rgb(${r}, ${g}, ${b}).`
      );
    }
    case 'slides_update_text_style': {
      const {
        presentation_id: presentation_id,
        object_id: object_id,
        bold: bold,
        italic: italic,
        underline: underline,
        font_size: font_size,
        font_family: font_family,
        r: r,
        g: g,
        b: b,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      return (
        await SlidesAPI.updateTextStyle(credentials, presentation_id.trim(), object_id.trim(), {
          bold: null != bold ? Boolean(bold) : void 0,
          italic: null != italic ? Boolean(italic) : void 0,
          underline: null != underline ? Boolean(underline) : void 0,
          fontSize: null != font_size ? Number(font_size) : void 0,
          fontFamily: font_family ?? void 0,
          r: null != r ? Number(r) : void 0,
          g: null != g ? Number(g) : void 0,
          b: null != b ? Number(b) : void 0,
        }),
        `Text style updated on element \`${object_id}\`.`
      );
    }
    case 'slides_add_table': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        rows: rows,
        columns: columns,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      return [
        `Table (${rows ?? 3}×${columns ?? 3}) added`,
        `Element ID: \`${(await SlidesAPI.addTable(credentials, presentation_id.trim(), slide_object_id.trim(), { rows: null != rows ? Number(rows) : 3, columns: null != columns ? Number(columns) : 3, x: null != x ? Number(x) : 50, y: null != y ? Number(y) : 100, width: null != width ? Number(width) : 450, height: null != height ? Number(height) : 200 })).objectId}\``,
      ].join('\n');
    }
    case 'slides_move_element': {
      const { presentation_id: presentation_id, object_id: object_id, x: x, y: y } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      if (null == x || null == y) throw new Error('Missing required params: x, y');
      return (
        await SlidesAPI.moveElement(credentials, presentation_id.trim(), object_id.trim(), {
          x: Number(x),
          y: Number(y),
        }),
        `Element \`${object_id}\` moved to (${x}pt, ${y}pt).`
      );
    }
    case 'slides_add_speaker_notes': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        notes: notes,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      if (!notes?.trim()) throw new Error('Missing required param: notes');
      return (
        await SlidesAPI.addSpeakerNotes(
          credentials,
          presentation_id.trim(),
          slide_object_id.trim(),
          notes,
        ),
        `Speaker notes set on slide \`${slide_object_id}\`.`
      );
    }
    case 'slides_update_alignment': {
      const {
        presentation_id: presentation_id,
        object_id: object_id,
        alignment: alignment,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      if (!alignment?.trim()) throw new Error('Missing required param: alignment');
      const valid = ['START', 'CENTER', 'END', 'JUSTIFIED'],
        normalized = alignment.trim().toUpperCase();
      if (!valid.includes(normalized))
        throw new Error(`Invalid alignment "${alignment}". Use: ${valid.join(', ')}`);
      return (
        await SlidesAPI.updateParagraphAlignment(
          credentials,
          presentation_id.trim(),
          object_id.trim(),
          normalized,
        ),
        `Text alignment in element \`${object_id}\` set to ${normalized}.`
      );
    }
    case 'slides_update_shape_fill': {
      const {
        presentation_id: presentation_id,
        object_id: object_id,
        r: r,
        g: g,
        b: b,
        alpha: alpha,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!object_id?.trim()) throw new Error('Missing required param: object_id');
      if (null == r || null == g || null == b) throw new Error('Missing required params: r, g, b');
      return (
        await SlidesAPI.updateShapeFill(credentials, presentation_id.trim(), object_id.trim(), {
          r: Number(r),
          g: Number(g),
          b: Number(b),
          alpha: null != alpha ? Number(alpha) : 1,
        }),
        `Shape \`${object_id}\` fill set to rgb(${r}, ${g}, ${b})${null != alpha ? ` @ ${alpha} opacity` : ''}.`
      );
    }
    case 'slides_insert_table_rows': {
      const {
        presentation_id: presentation_id,
        table_object_id: table_object_id,
        row_index: row_index,
        insert_below: insert_below,
        count: count,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!table_object_id?.trim()) throw new Error('Missing required param: table_object_id');
      if (null == row_index) throw new Error('Missing required param: row_index');
      await SlidesAPI.insertTableRows(credentials, presentation_id.trim(), table_object_id.trim(), {
        rowIndex: Number(row_index),
        insertBelow: null == insert_below || Boolean(insert_below),
        count: null != count ? Number(count) : 1,
      });
      const n = count ?? 1;
      return `${n} row${1 !== n ? 's' : ''} inserted ${!1 === insert_below ? 'above' : 'below'} row ${row_index} in table \`${table_object_id}\`.`;
    }
    case 'slides_delete_table_row': {
      const {
        presentation_id: presentation_id,
        table_object_id: table_object_id,
        row_index: row_index,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!table_object_id?.trim()) throw new Error('Missing required param: table_object_id');
      if (null == row_index) throw new Error('Missing required param: row_index');
      return (
        await SlidesAPI.deleteTableRow(
          credentials,
          presentation_id.trim(),
          table_object_id.trim(),
          Number(row_index),
        ),
        `Row ${row_index} deleted from table \`${table_object_id}\`.`
      );
    }
    case 'slides_update_table_cell': {
      const {
        presentation_id: presentation_id,
        table_object_id: table_object_id,
        row_index: row_index,
        column_index: column_index,
        text: text,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!table_object_id?.trim()) throw new Error('Missing required param: table_object_id');
      if (null == row_index) throw new Error('Missing required param: row_index');
      if (null == column_index) throw new Error('Missing required param: column_index');
      if (null == text) throw new Error('Missing required param: text');
      return (
        await SlidesAPI.updateTableCellText(
          credentials,
          presentation_id.trim(),
          table_object_id.trim(),
          Number(row_index),
          Number(column_index),
          String(text),
        ),
        `Cell [${row_index}, ${column_index}] in table \`${table_object_id}\` updated.`
      );
    }
    case 'slides_add_line': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        line_category: line_category,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      return [
        'Line added',
        `Element ID: \`${(await SlidesAPI.addLine(credentials, presentation_id.trim(), slide_object_id.trim(), { lineCategory: line_category?.trim().toUpperCase() ?? 'STRAIGHT', x: null != x ? Number(x) : 50, y: null != y ? Number(y) : 50, width: null != width ? Number(width) : 200, height: null != height ? Number(height) : 0 })).objectId}\``,
      ].join('\n');
    }
    case 'slides_add_video': {
      const {
        presentation_id: presentation_id,
        slide_object_id: slide_object_id,
        video_id: video_id,
        x: x,
        y: y,
        width: width,
        height: height,
      } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      if (!video_id?.trim()) throw new Error('Missing required param: video_id');
      const result = await SlidesAPI.addVideo(
        credentials,
        presentation_id.trim(),
        slide_object_id.trim(),
        {
          videoId: video_id.trim(),
          x: null != x ? Number(x) : 100,
          y: null != y ? Number(y) : 100,
          width: null != width ? Number(width) : 320,
          height: null != height ? Number(height) : 180,
        },
      );
      return [`YouTube video \`${video_id}\` embedded`, `Element ID: \`${result.objectId}\``].join(
        '\n',
      );
    }
    default:
      throw new Error(`Unknown Slides tool: ${toolName}`);
  }
}
