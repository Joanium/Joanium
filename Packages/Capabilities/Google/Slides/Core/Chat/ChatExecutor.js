import * as SlidesAPI from '../API/SlidesAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

export async function executeSlidesChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'slides_get_info': {
      const { presentation_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const pres = await SlidesAPI.getPresentation(credentials, presentation_id.trim());
      const slideCount = (pres.slides ?? []).length;
      const size = pres.pageSize;
      const w = size?.width?.magnitude?.toFixed(0);
      const h = size?.height?.magnitude?.toFixed(0);
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
      const { presentation_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const pres = await SlidesAPI.getPresentation(credentials, presentation_id.trim());
      const slides = pres.slides ?? [];
      if (!slides.length) return `Presentation "${pres.title ?? presentation_id}" has no slides.`;

      const sections = slides.map((slide, i) => {
        const texts = SlidesAPI.extractSlideText(slide);
        const objectId = slide.objectId ?? '';
        return [
          `── Slide ${i + 1} (ID: \`${objectId}\`) ──`,
          texts.length ? texts.join('\n') : '(no text)',
        ].join('\n');
      });

      return [
        `**${pres.title ?? 'Untitled'}** — ${slides.length} slide${slides.length !== 1 ? 's' : ''}`,
        '',
        sections.join('\n\n'),
      ].join('\n');
    }

    case 'slides_create': {
      const { title } = params;
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
      const { presentation_id, insertion_index } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      const reply = await SlidesAPI.addSlide(credentials, presentation_id.trim(), {
        insertionIndex: insertion_index != null ? Number(insertion_index) : undefined,
      });
      return ['Slide added', reply?.objectId ? `Slide ID: \`${reply.objectId}\`` : '']
        .filter(Boolean)
        .join('\n');
    }

    case 'slides_delete_slide': {
      const { presentation_id, slide_object_id } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!slide_object_id?.trim()) throw new Error('Missing required param: slide_object_id');
      await SlidesAPI.deleteSlide(credentials, presentation_id.trim(), slide_object_id.trim());
      return `Slide \`${slide_object_id}\` deleted from presentation.`;
    }

    case 'slides_duplicate_slide': {
      const { presentation_id, slide_object_id } = params;
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
      const { presentation_id, search_text, replacement } = params;
      if (!presentation_id?.trim()) throw new Error('Missing required param: presentation_id');
      if (!search_text) throw new Error('Missing required param: search_text');
      if (replacement == null) throw new Error('Missing required param: replacement');
      const reply = await SlidesAPI.replaceAllText(
        credentials,
        presentation_id.trim(),
        search_text,
        String(replacement),
      );
      const count = reply?.occurrencesChanged ?? 0;
      return count > 0
        ? `Replaced ${count} occurrence${count !== 1 ? 's' : ''} of "${search_text}" across all slides.`
        : `No occurrences of "${search_text}" found in the presentation.`;
    }

    default:
      throw new Error(`Unknown Slides tool: ${toolName}`);
  }
}
