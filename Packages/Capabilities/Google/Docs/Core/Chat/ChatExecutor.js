import * as DocsAPI from '../API/DocsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
import { hexToRgb, findAllOccurrences } from './Utils.js';
export async function executeDocsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'docs_get_info': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        totalChars = (doc.body?.content ?? [])
          .flatMap((el) => el.paragraph?.elements ?? [])
          .reduce((n, el) => n + (el.textRun?.content?.length ?? 0), 0);
      return [
        `**${doc.title ?? 'Untitled'}**`,
        `Document ID: \`${doc.documentId}\``,
        doc.documentStyle?.pageSize
          ? `Page size: ${doc.documentStyle.pageSize.width?.magnitude?.toFixed(0)} × ${doc.documentStyle.pageSize.height?.magnitude?.toFixed(0)} pt`
          : '',
        `~${totalChars.toLocaleString()} characters`,
        doc.revisionId ? `Revision: ${doc.revisionId}` : '',
        `Link: https://docs.google.com/document/d/${doc.documentId}/edit`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'docs_read': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        { text: text, truncated: truncated } = DocsAPI.extractText(doc);
      return text.trim()
        ? [
            `**${doc.title ?? 'Untitled'}**`,
            truncated ? 'Showing the first 30,000 characters.' : '',
            '',
            '```',
            text,
            '```',
          ]
            .filter(Boolean)
            .join('\n')
        : `Document "${doc.title ?? document_id}" is empty.`;
    }
    case 'docs_word_count': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        { text: text } = DocsAPI.extractText(doc),
        words = text.trim() ? text.trim().split(/\s+/).length : 0,
        chars = text.length,
        paragraphs = (doc.body?.content ?? []).filter((el) => el.paragraph).length;
      return [
        `**${doc.title ?? 'Untitled'} — Word Count**`,
        `Words: ${words.toLocaleString()}`,
        `Characters: ${chars.toLocaleString()}`,
        `Paragraphs: ${paragraphs.toLocaleString()}`,
      ].join('\n');
    }
    case 'docs_get_outline': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        headings = DocsAPI.extractOutline(doc);
      if (!headings.length) return 'No headings found in this document.';
      const lines = headings.map(
        (h) =>
          `${'  '.repeat(h.level - 1)}H${h.level} — ${h.text} (index ${h.startIndex}–${h.endIndex})`,
      );
      return [`**${doc.title ?? 'Untitled'} — Outline**`, '', ...lines].join('\n');
    }
    case 'docs_search_text': {
      const { document_id: document_id, query: query } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!query) throw new Error('Missing required param: query');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        { text: text } = DocsAPI.extractText(doc),
        matches = findAllOccurrences(text, query);
      if (!matches.length) return `No occurrences of "${query}" found in the document.`;
      const lines = matches.map(
        (m, i) =>
          `Match ${i + 1}: index ${m.start}–${m.end} — …${text.slice(Math.max(0, m.start - 20), m.end + 20).replace(/\n/g, '↵')}…`,
      );
      return [
        `Found ${matches.length} occurrence${1 !== matches.length ? 's' : ''} of "${query}":`,
        '',
        ...lines,
      ].join('\n');
    }
    case 'docs_list_named_ranges': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        ranges = DocsAPI.extractNamedRanges(doc);
      if (!ranges.length) return 'No named ranges found in this document.';
      const lines = ranges.map((r) => {
        const spans = (r.ranges ?? []).map((rng) => `${rng.startIndex}–${rng.endIndex}`).join(', ');
        return `**${r.name}** (ID: ${r.namedRangeId ?? 'n/a'}) — ${spans || 'no range data'}`;
      });
      return [`**Named Ranges (${ranges.length}):**`, '', ...lines].join('\n');
    }
    case 'docs_create': {
      const { title: title } = params;
      if (!title?.trim()) throw new Error('Missing required param: title');
      const doc = await DocsAPI.createDocument(credentials, title.trim());
      return [
        'Document created',
        `Title: ${doc.title}`,
        `ID: \`${doc.documentId}\``,
        `Link: https://docs.google.com/document/d/${doc.documentId}/edit`,
      ].join('\n');
    }
    case 'docs_append_text': {
      const { document_id: document_id, text: text } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!text) throw new Error('Missing required param: text');
      return (
        await DocsAPI.appendText(credentials, document_id.trim(), String(text)),
        `Text appended to document \`${document_id}\`.`
      );
    }
    case 'docs_prepend_text': {
      const { document_id: document_id, text: text } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!text) throw new Error('Missing required param: text');
      return (
        await DocsAPI.insertText(credentials, document_id.trim(), String(text), 1),
        `Text prepended to document \`${document_id}\`.`
      );
    }
    case 'docs_insert_text': {
      const { document_id: document_id, text: text, index: index = 1 } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!text) throw new Error('Missing required param: text');
      if ('number' != typeof index || index < 1) throw new Error('index must be a number >= 1');
      return (
        await DocsAPI.insertText(credentials, document_id.trim(), String(text), index),
        `Text inserted at index ${index} in document \`${document_id}\`.`
      );
    }
    case 'docs_batch_insert_text': {
      const { document_id: document_id, insertions: insertions } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!Array.isArray(insertions) || !insertions.length)
        throw new Error('insertions must be a non-empty array');
      for (const item of insertions) {
        if ('number' != typeof item.index || item.index < 1)
          throw new Error('Each insertion must have a numeric index >= 1');
        if ('string' != typeof item.text)
          throw new Error('Each insertion must have a string text field');
      }
      return (
        await DocsAPI.batchInsertText(credentials, document_id.trim(), insertions),
        `${insertions.length} text snippet${1 !== insertions.length ? 's' : ''} inserted into document \`${document_id}\`.`
      );
    }
    case 'docs_replace_text': {
      const {
        document_id: document_id,
        search_text: search_text,
        replacement: replacement,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!search_text) throw new Error('Missing required param: search_text');
      if (null == replacement) throw new Error('Missing required param: replacement');
      const result = await DocsAPI.replaceAllText(
          credentials,
          document_id.trim(),
          search_text,
          String(replacement),
        ),
        count = result.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
      return count > 0
        ? `Replaced ${count} occurrence${1 !== count ? 's' : ''} of "${search_text}" in document \`${document_id}\`.`
        : `No occurrences of "${search_text}" found in the document.`;
    }
    case 'docs_delete_range': {
      const { document_id: document_id, start_index: start_index, end_index: end_index } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (start_index < 1) throw new Error('start_index must be >= 1');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      return (
        await DocsAPI.deleteContentRange(credentials, document_id.trim(), start_index, end_index),
        `Deleted characters ${start_index}–${end_index} from document \`${document_id}\`.`
      );
    }
    case 'docs_clear_content': {
      const { document_id: document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim()),
        lastEl = (doc.body?.content ?? []).at(-1),
        endIndex = lastEl?.endIndex ?? 1;
      return endIndex <= 2
        ? `Document \`${document_id}\` is already empty.`
        : (await DocsAPI.deleteContentRange(credentials, document_id.trim(), 1, endIndex - 1),
          `All content cleared from document \`${document_id}\`.`);
    }
    case 'docs_apply_text_style': {
      const {
        document_id: document_id,
        start_index: start_index,
        end_index: end_index,
        bold: bold,
        italic: italic,
        underline: underline,
        strikethrough: strikethrough,
        font_size_pt: font_size_pt,
        font_family: font_family,
        foreground_color_hex: foreground_color_hex,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      const textStyle = {};
      if (
        (null != bold && (textStyle.bold = bold),
        null != italic && (textStyle.italic = italic),
        null != underline && (textStyle.underline = underline),
        null != strikethrough && (textStyle.strikethrough = strikethrough),
        null != font_size_pt && (textStyle.fontSize = { magnitude: font_size_pt, unit: 'PT' }),
        null != font_family && (textStyle.weightedFontFamily = { fontFamily: font_family }),
        null != foreground_color_hex &&
          (textStyle.foregroundColor = { color: { rgbColor: hexToRgb(foreground_color_hex) } }),
        !Object.keys(textStyle).length)
      )
        throw new Error('At least one style property is required');
      return (
        await DocsAPI.applyTextStyle(
          credentials,
          document_id.trim(),
          start_index,
          end_index,
          textStyle,
        ),
        `Text style applied to characters ${start_index}–${end_index} in document \`${document_id}\`.`
      );
    }
    case 'docs_apply_paragraph_style': {
      const {
        document_id: document_id,
        start_index: start_index,
        end_index: end_index,
        named_style_type: named_style_type,
        alignment: alignment,
        line_spacing: line_spacing,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      const paragraphStyle = {};
      if (
        (null != named_style_type && (paragraphStyle.namedStyleType = named_style_type),
        null != alignment && (paragraphStyle.alignment = alignment),
        null != line_spacing && (paragraphStyle.lineSpacing = line_spacing),
        !Object.keys(paragraphStyle).length)
      )
        throw new Error('At least one style property is required');
      return (
        await DocsAPI.applyParagraphStyle(
          credentials,
          document_id.trim(),
          start_index,
          end_index,
          paragraphStyle,
        ),
        `Paragraph style applied to range ${start_index}–${end_index} in document \`${document_id}\`.`
      );
    }
    case 'docs_create_bullet_list': {
      const {
        document_id: document_id,
        start_index: start_index,
        end_index: end_index,
        bullet_preset: bullet_preset,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      return (
        await DocsAPI.createBulletList(
          credentials,
          document_id.trim(),
          start_index,
          end_index,
          bullet_preset ?? 'BULLET_DISC_CIRCLE_SQUARE',
        ),
        `Bullet list applied to range ${start_index}–${end_index} in document \`${document_id}\`.`
      );
    }
    case 'docs_remove_bullet_list': {
      const { document_id: document_id, start_index: start_index, end_index: end_index } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      return (
        await DocsAPI.removeBulletList(credentials, document_id.trim(), start_index, end_index),
        `Bullet formatting removed from range ${start_index}–${end_index} in document \`${document_id}\`.`
      );
    }
    case 'docs_insert_table': {
      const { document_id: document_id, rows: rows, columns: columns, index: index = 1 } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!rows || rows < 1) throw new Error('rows must be >= 1');
      if (!columns || columns < 1) throw new Error('columns must be >= 1');
      if (index < 1) throw new Error('index must be >= 1');
      return (
        await DocsAPI.insertTable(credentials, document_id.trim(), rows, columns, index),
        `${rows}×${columns} table inserted at index ${index} in document \`${document_id}\`.`
      );
    }
    case 'docs_insert_page_break': {
      const { document_id: document_id, index: index = 1 } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (index < 1) throw new Error('index must be >= 1');
      return (
        await DocsAPI.insertPageBreak(credentials, document_id.trim(), index),
        `Page break inserted at index ${index} in document \`${document_id}\`.`
      );
    }
    case 'docs_insert_inline_image': {
      const {
        document_id: document_id,
        image_url: image_url,
        index: index = 1,
        width_pt: width_pt,
        height_pt: height_pt,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!image_url?.trim()) throw new Error('Missing required param: image_url');
      if (index < 1) throw new Error('index must be >= 1');
      return (
        await DocsAPI.insertInlineImage(
          credentials,
          document_id.trim(),
          image_url.trim(),
          index,
          width_pt,
          height_pt,
        ),
        `Image inserted at index ${index} in document \`${document_id}\`.`
      );
    }
    case 'docs_create_named_range': {
      const {
        document_id: document_id,
        name: name,
        start_index: start_index,
        end_index: end_index,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!name?.trim()) throw new Error('Missing required param: name');
      if (null == start_index) throw new Error('Missing required param: start_index');
      if (null == end_index) throw new Error('Missing required param: end_index');
      if (end_index <= start_index) throw new Error('end_index must be greater than start_index');
      const result = await DocsAPI.createNamedRange(
        credentials,
        document_id.trim(),
        name.trim(),
        start_index,
        end_index,
      );
      return `Named range "${name}" created (ID: ${result.replies?.[0]?.createNamedRange?.namedRangeId ?? 'unknown'}) covering indices ${start_index}–${end_index}.`;
    }
    case 'docs_delete_named_range': {
      const { document_id: document_id, name: name } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!name?.trim()) throw new Error('Missing required param: name');
      return (
        await DocsAPI.deleteNamedRange(credentials, document_id.trim(), name.trim()),
        `Named range "${name}" deleted from document \`${document_id}\`.`
      );
    }
    case 'docs_update_page_size': {
      const { document_id: document_id, width_pt: width_pt, height_pt: height_pt } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (null == width_pt) throw new Error('Missing required param: width_pt');
      if (null == height_pt) throw new Error('Missing required param: height_pt');
      return (
        await DocsAPI.updateDocumentStyle(
          credentials,
          document_id.trim(),
          {
            pageSize: {
              width: { magnitude: width_pt, unit: 'PT' },
              height: { magnitude: height_pt, unit: 'PT' },
            },
          },
          'pageSize',
        ),
        `Page size updated to ${width_pt}×${height_pt} pt in document \`${document_id}\`.`
      );
    }
    case 'docs_update_margins': {
      const {
        document_id: document_id,
        top_pt: top_pt,
        bottom_pt: bottom_pt,
        left_pt: left_pt,
        right_pt: right_pt,
      } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const margins = {},
        fieldParts = [];
      if (
        (null != top_pt &&
          ((margins.marginTop = { magnitude: top_pt, unit: 'PT' }), fieldParts.push('marginTop')),
        null != bottom_pt &&
          ((margins.marginBottom = { magnitude: bottom_pt, unit: 'PT' }),
          fieldParts.push('marginBottom')),
        null != left_pt &&
          ((margins.marginLeft = { magnitude: left_pt, unit: 'PT' }),
          fieldParts.push('marginLeft')),
        null != right_pt &&
          ((margins.marginRight = { magnitude: right_pt, unit: 'PT' }),
          fieldParts.push('marginRight')),
        !fieldParts.length)
      )
        throw new Error('At least one margin (top_pt, bottom_pt, left_pt, right_pt) is required');
      return (
        await DocsAPI.updateDocumentStyle(
          credentials,
          document_id.trim(),
          margins,
          fieldParts.join(','),
        ),
        `Margins updated (${fieldParts.map((f) => `${f.replace('margin', '').toLowerCase()}: ${margins[f].magnitude} pt`).join(', ')}) in document \`${document_id}\`.`
      );
    }
    default:
      throw new Error(`Unknown Docs tool: ${toolName}`);
  }
}
