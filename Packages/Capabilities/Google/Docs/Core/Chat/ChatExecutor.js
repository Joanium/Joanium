import * as DocsAPI from '../API/DocsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

export async function executeDocsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'docs_get_info': {
      const { document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim());
      const bodyContent = doc.body?.content ?? [];
      const totalChars = bodyContent
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
      const { document_id } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      const doc = await DocsAPI.getDocument(credentials, document_id.trim());
      const { text, truncated } = DocsAPI.extractText(doc);
      if (!text.trim()) return `Document "${doc.title ?? document_id}" is empty.`;
      return [
        `**${doc.title ?? 'Untitled'}**`,
        truncated ? 'Showing the first 30,000 characters.' : '',
        '',
        '```',
        text,
        '```',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'docs_create': {
      const { title } = params;
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
      const { document_id, text } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!text) throw new Error('Missing required param: text');
      await DocsAPI.appendText(credentials, document_id.trim(), String(text));
      return `Text appended to document \`${document_id}\`.`;
    }

    case 'docs_replace_text': {
      const { document_id, search_text, replacement } = params;
      if (!document_id?.trim()) throw new Error('Missing required param: document_id');
      if (!search_text) throw new Error('Missing required param: search_text');
      if (replacement == null) throw new Error('Missing required param: replacement');
      const result = await DocsAPI.replaceAllText(
        credentials,
        document_id.trim(),
        search_text,
        String(replacement),
      );
      const count = result.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
      return count > 0
        ? `Replaced ${count} occurrence${count !== 1 ? 's' : ''} of "${search_text}" in document \`${document_id}\`.`
        : `No occurrences of "${search_text}" found in the document.`;
    }

    default:
      throw new Error(`Unknown Docs tool: ${toolName}`);
  }
}
