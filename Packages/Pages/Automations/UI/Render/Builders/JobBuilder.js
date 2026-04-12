import {
  DATA_SOURCE_TYPES,
  INSTRUCTION_TEMPLATES,
  MAX_JOBS,
  OUTPUT_TYPES,
} from '../Config/Constants.js';
import {
  capitalize,
  createNewJob,
  ensureJobDataSources,
  escapeHtml,
  getJobLabel,
} from '../Utils/Utils.js';
export function createJobsController({
  state: state,
  jobsListEl: jobsListEl,
  addJobBtn: addJobBtn,
  jobsBadge: jobsBadge,
  modalBodyEl: modalBodyEl,
}) {
  function updateSourceCount(card, count) {
    card.querySelector('.job-sources-count-badge').textContent =
      `(${count} source${1 !== count ? 's' : ''})`;
  }
  function renderJobsList() {
    jobsListEl &&
      ((jobsListEl.innerHTML = ''),
      state.jobs.forEach((job, index) => {
        jobsListEl.appendChild(
          (function (job, index) {
            const card = document.createElement('div');
            ((card.className = 'job-card open'),
              (card.dataset.jobId = job.id),
              ensureJobDataSources(job),
              (job.trigger = job.trigger ?? { type: 'daily', time: '08:00' }),
              (job.output = job.output ?? { type: '' }));
            const nameHint = getJobLabel(job, DATA_SOURCE_TYPES, 'New Job');
            ((card.innerHTML = `\n      <div class="job-card-header">\n        <div class="job-card-number">${index + 1}</div>\n        <div class="job-card-name ${job.name ? 'has-value' : ''}">${escapeHtml(nameHint)}</div>\n        <svg class="job-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M18 15l-6-6-6 6" stroke-linecap="round"/>\n        </svg>\n        <button type="button" class="job-remove-btn" title="Remove job">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>\n          </svg>\n        </button>\n      </div>\n\n      <div class="job-body">\n        <div class="agent-field" style="margin-top:14px">\n          <label class="agent-field-label">\n            Job Label <span style="color:var(--text-muted);font-weight:400">(optional)</span>\n          </label>\n          <input type="text" class="agent-input job-name-input"\n            value="${escapeHtml(job.name ?? '')}"\n            placeholder="e.g. Morning Email Digest, Daily PR Check..."\n            maxlength="60"/>\n        </div>\n\n        <div class="job-sub-section">\n          <div class="job-sub-label">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/>\n            </svg>\n            When to Run\n          </div>\n          ${(function (
              trigger,
            ) {
              const type = trigger?.type ?? 'daily',
                time = trigger?.time ?? '08:00',
                day = trigger?.day ?? 'monday',
                minutes = trigger?.minutes ?? 30;
              return `\n      <div class="job-params">\n        <select class="job-param-select trigger-type-select">\n          <option value="on_startup" ${'on_startup' === type ? 'selected' : ''}>On app startup</option>\n          <option value="interval" ${'interval' === type ? 'selected' : ''}>At an interval</option>\n          <option value="hourly" ${'hourly' === type ? 'selected' : ''}>Every hour</option>\n          <option value="daily" ${'daily' === type ? 'selected' : ''}>Every day at...</option>\n          <option value="weekly" ${'weekly' === type ? 'selected' : ''}>Every week on...</option>\n        </select>\n        <div class="job-trigger-sub ${'interval' === type ? '' : 'hidden'} trigger-sub-interval">\n          <select class="job-interval-select">\n            ${[5, 10, 15, 30, 60, 120, 240, 480, 1440].map((value) => `<option value="${value}" ${minutes === value ? 'selected' : ''}>${value < 60 ? `Every ${value} min` : 60 === value ? 'Every 1 hr' : `Every ${value / 60} hrs`}</option>`).join('')}\n          </select>\n        </div>\n        <div class="job-trigger-sub ${'daily' === type ? '' : 'hidden'} trigger-sub-daily">\n          <span style="font-size:12px;color:var(--text-muted)">at</span>\n          <input type="time" class="job-time-input trigger-time-daily" value="${time}"/>\n        </div>\n        <div class="job-trigger-sub ${'weekly' === type ? '' : 'hidden'} trigger-sub-weekly">\n          <select class="job-day-select trigger-day">\n            ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((value) => `<option value="${value}" ${day === value ? 'selected' : ''}>${capitalize(value)}</option>`).join('')}\n          </select>\n          <span style="font-size:12px;color:var(--text-muted)">at</span>\n          <input type="time" class="job-time-input trigger-time-weekly" value="${time}"/>\n        </div>\n      </div>`;
            })(
              job.trigger,
            )}\n        </div>\n\n        <div class="job-sub-section">\n          <div class="job-sub-label">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n              <ellipse cx="12" cy="5" rx="9" ry="3"/>\n              <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/>\n              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke-linecap="round"/>\n            </svg>\n            Data to Collect\n            <span class="job-sources-count-badge" style="font-size:10px;color:var(--text-muted);font-weight:500;letter-spacing:0;text-transform:none">\n              (${job.dataSources.length} source${1 !== job.dataSources.length ? 's' : ''})\n            </span>\n          </div>\n          <div class="sources-list">\n            ${job.dataSources.map((dataSource, sourceIndex) => buildSourceSelectorHTML(dataSource, sourceIndex)).join('')}\n          </div>\n          <button type="button" class="add-source-btn">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>\n            </svg>\n            Add another data source\n          </button>\n        </div>\n\n        <div class="job-sub-section">\n          <div class="job-sub-label">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>\n              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>\n            </svg>\n            AI Instruction\n          </div>\n          <div class="job-params">\n            <textarea class="job-param-textarea job-instruction" rows="4"\n              placeholder="Tell the AI what to do with the data - and any conditions e.g. 'only alert me if CPU exceeds 90%' or 'only send if there are urgent emails'..."\n            >${escapeHtml(job.instruction ?? '')}</textarea>\n          </div>\n          <div class="job-instruction-hint">\n            Tip: You can write conditions directly here - e.g. "Only send if there are PRs waiting for my review" or "Skip if everything is normal."\n          </div>\n        </div>\n\n        <div class="job-sub-section">\n          <div class="job-sub-label">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n              <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>\n            </svg>\n            What to Do With the Result\n          </div>\n          ${(function (
              output,
            ) {
              const selectedType = output?.type ?? '',
                groups = OUTPUT_TYPES.reduce(
                  (result, item) => (
                    result[item.group] || (result[item.group] = []),
                    result[item.group].push(item),
                    result
                  ),
                  {},
                );
              return `\n      <div class="job-params">\n        <select class="job-param-select out-type-select">\n          <option value="">- Choose what to do with the result -</option>\n          ${Object.entries(
                groups,
              )
                .map(
                  ([groupName, items]) =>
                    `<optgroup label="${groupName}">${items.map((item) => `<option value="${item.value}" ${selectedType === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}</optgroup>`,
                )
                .join(
                  '',
                )}\n        </select>\n        <div class="out-params-area">${buildOutputParams(output)}</div>\n      </div>`;
            })(job.output)}\n        </div>\n\n      </div>`),
              card.querySelector('.job-card-header')?.addEventListener('click', (event) => {
                event.target.closest('.job-remove-btn') || card.classList.toggle('open');
              }),
              card.querySelector('.job-remove-btn')?.addEventListener('click', () => {
                ((state.jobs = state.jobs.filter((item) => item.id !== job.id)), renderJobsList());
              }));
            const nameInput = card.querySelector('.job-name-input'),
              nameLabel = card.querySelector('.job-card-name');
            return (
              nameInput?.addEventListener('input', () => {
                ((job.name = nameInput.value.trim()),
                  (nameLabel.textContent = getJobLabel(job, DATA_SOURCE_TYPES, 'Job')),
                  nameLabel.classList.toggle('has-value', !!job.name));
              }),
              (function (card, job) {
                const triggerTypeSelect = card.querySelector('.trigger-type-select');
                triggerTypeSelect &&
                  (triggerTypeSelect.addEventListener('change', () => {
                    ((job.trigger = job.trigger ?? {}),
                      (job.trigger.type = triggerTypeSelect.value),
                      card
                        .querySelector('.trigger-sub-interval')
                        ?.classList.toggle('hidden', 'interval' !== triggerTypeSelect.value),
                      card
                        .querySelector('.trigger-sub-daily')
                        ?.classList.toggle('hidden', 'daily' !== triggerTypeSelect.value),
                      card
                        .querySelector('.trigger-sub-weekly')
                        ?.classList.toggle('hidden', 'weekly' !== triggerTypeSelect.value));
                  }),
                  card
                    .querySelector('.job-interval-select')
                    ?.addEventListener('change', (event) => {
                      ((job.trigger = job.trigger ?? {}),
                        (job.trigger.minutes = parseInt(event.target.value, 10) || 10));
                    }),
                  card.querySelector('.trigger-time-daily')?.addEventListener('change', (event) => {
                    ((job.trigger = job.trigger ?? {}), (job.trigger.time = event.target.value));
                  }),
                  card.querySelector('.trigger-day')?.addEventListener('change', (event) => {
                    ((job.trigger = job.trigger ?? {}), (job.trigger.day = event.target.value));
                  }),
                  card
                    .querySelector('.trigger-time-weekly')
                    ?.addEventListener('change', (event) => {
                      ((job.trigger = job.trigger ?? {}), (job.trigger.time = event.target.value));
                    }));
              })(card, job),
              wireAllSourceEvents(card, job),
              card.querySelector('.add-source-btn')?.addEventListener('click', () => {
                (job.dataSources.push({ type: '' }),
                  (card.querySelector('.sources-list').innerHTML = job.dataSources
                    .map((dataSource, sourceIndex) =>
                      buildSourceSelectorHTML(dataSource, sourceIndex),
                    )
                    .join('')),
                  updateSourceCount(card, job.dataSources.length),
                  wireAllSourceEvents(card, job));
              }),
              card.querySelector('.job-instruction')?.addEventListener('input', (event) => {
                job.instruction = event.target.value;
              }),
              (function (card, job) {
                const typeSelect = card.querySelector('.out-type-select'),
                  paramsArea = card.querySelector('.out-params-area');
                typeSelect &&
                  (typeSelect.addEventListener('change', () => {
                    ((job.output = { type: typeSelect.value }),
                      paramsArea && (paramsArea.innerHTML = buildOutputParams(job.output)),
                      wireOutputParamEvents(paramsArea, job));
                  }),
                  wireOutputParamEvents(paramsArea, job));
              })(card, job),
              card
            );
          })(job, index),
        );
      }),
      jobsBadge && (jobsBadge.textContent = `(${state.jobs.length}/${MAX_JOBS})`),
      addJobBtn && (addJobBtn.disabled = state.jobs.length >= MAX_JOBS));
  }
  function buildSourceSelectorHTML(dataSource, sourceIndex) {
    const selectedType = dataSource?.type ?? '',
      groups = DATA_SOURCE_TYPES.reduce(
        (result, item) => (
          result[item.group] || (result[item.group] = []),
          result[item.group].push(item),
          result
        ),
        {},
      );
    return `\n      <div class="source-selector-group" data-source-idx="${sourceIndex}">\n        <div class="source-selector-top">\n          <select class="job-param-select ds-type-select">\n            <option value="">- ${0 === sourceIndex ? 'Choose a data source' : 'Add another source'} -</option>\n            ${Object.entries(
      groups,
    )
      .map(
        ([groupName, items]) =>
          `<optgroup label="${groupName}">${items.map((item) => `<option value="${item.value}" ${selectedType === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}</optgroup>`,
      )
      .join(
        '',
      )}\n          </select>\n          ${sourceIndex > 0 ? '\n            <button type="button" class="source-remove-btn" title="Remove source">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>\n              </svg>\n            </button>' : ''}\n        </div>\n        <div class="ds-params-area">${buildDataSourceParams(dataSource)}</div>\n      </div>`;
  }
  function wireAllSourceEvents(card, job) {
    const sourcesListEl = card.querySelector('.sources-list');
    sourcesListEl &&
      sourcesListEl.querySelectorAll('.source-selector-group').forEach((groupEl, sourceIndex) => {
        const typeSelect = groupEl.querySelector('.ds-type-select'),
          paramsArea = groupEl.querySelector('.ds-params-area');
        (typeSelect?.addEventListener('change', () => {
          const nextType = typeSelect.value;
          (job.dataSources[sourceIndex] || (job.dataSources[sourceIndex] = {}),
            (job.dataSources[sourceIndex] = { type: nextType }));
          const instructionArea = card.querySelector('.job-instruction');
          if (0 === sourceIndex && instructionArea && !instructionArea.value.trim()) {
            const template = INSTRUCTION_TEMPLATES[nextType];
            template && ((instructionArea.value = template), (job.instruction = template));
          }
          const nameLabel = card.querySelector('.job-card-name'),
            nameInput = card.querySelector('.job-name-input');
          (0 === sourceIndex &&
            !nameInput?.value.trim() &&
            nameLabel &&
            (nameLabel.textContent = getJobLabel(job, DATA_SOURCE_TYPES, 'Job')),
            paramsArea &&
              (paramsArea.innerHTML = buildDataSourceParams(job.dataSources[sourceIndex])),
            updateSourceCount(card, job.dataSources.length),
            wireDataSourceParamEvents(groupEl, job.dataSources[sourceIndex]));
        }),
          groupEl.querySelector('.source-remove-btn')?.addEventListener('click', () => {
            (job.dataSources.splice(sourceIndex, 1),
              (sourcesListEl.innerHTML = job.dataSources
                .map((dataSource, currentIndex) =>
                  buildSourceSelectorHTML(dataSource, currentIndex),
                )
                .join('')),
              updateSourceCount(card, job.dataSources.length),
              wireAllSourceEvents(card, job));
          }),
          wireDataSourceParamEvents(groupEl, job.dataSources[sourceIndex] ?? {}));
      });
  }
  function getDataSourceDefinition(type) {
    return DATA_SOURCE_TYPES.find((item) => item.value === type) ?? null;
  }
  function getOutputDefinition(type) {
    return OUTPUT_TYPES.find((item) => item.value === type) ?? null;
  }
  function buildGenericParamFields(definition, values = {}) {
    const params = definition?.params ?? [];
    return params.length
      ? `<div class="job-param-fields">${params
          .map(
            (param) =>
              `<div class="job-param-field">${(function (param, value) {
                const type = param.type ?? 'text',
                  attrs = [
                    `data-param-key="${param.key}"`,
                    `data-param-type="${type}"`,
                    `class="${'textarea' === type ? 'job-param-textarea' : 'select' === type ? 'job-param-select' : 'checkbox' === type ? 'job-param-checkbox' : 'job-param-input'}"`,
                  ];
                (param.placeholder && attrs.push(`placeholder="${escapeHtml(param.placeholder)}"`),
                  null != param.min && attrs.push(`min="${param.min}"`),
                  null != param.max && attrs.push(`max="${param.max}"`),
                  param.parse && attrs.push(`data-param-parse="${param.parse}"`));
                const resolvedValue = value ?? param.defaultValue ?? ('checkbox' !== type && '');
                if ('select' === type) {
                  const options = (param.options ?? [])
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(String(option))}" ${String(option) === String(resolvedValue) ? 'selected' : ''}>${escapeHtml(String(option))}</option>`,
                    )
                    .join('');
                  return `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><select ${attrs.join(' ')}>${options}</select>`;
                }
                return 'textarea' === type
                  ? `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><textarea rows="${param.rows ?? 3}" ${attrs.join(' ')}>${escapeHtml(String(resolvedValue ?? ''))}</textarea>`
                  : 'checkbox' === type
                    ? `<label class="job-param-checkbox-row"><input type="checkbox" ${attrs.join(' ')} ${resolvedValue ? 'checked' : ''}/> <span>${escapeHtml(param.label ?? param.key)}</span></label>`
                    : `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><input type="${'number' === type ? 'number' : type}" value="${escapeHtml(String(resolvedValue ?? ''))}" ${attrs.join(' ')}/>`;
              })(param, values?.[param.key])}</div>`,
          )
          .join('')}</div>`
      : '';
  }
  function bindGenericParamEvents(container, values, definition) {
    const params = definition?.params ?? [];
    return (
      !!params.length &&
      (params.forEach((param) => {
        const input = container.querySelector(`[data-param-key="${param.key}"]`);
        if (!input) return;
        const eventName = 'select' === param.type || 'checkbox' === param.type ? 'change' : 'input';
        input.addEventListener(eventName, (event) => {
          if ('checkbox' !== param.type) {
            if ('number' === param.type) {
              const parsed = parseInt(event.target.value, 10);
              return void (values[param.key] = Number.isNaN(parsed) ? void 0 : parsed);
            }
            if ('json' === param.parse) {
              const rawValue = event.target.value.trim();
              if (!rawValue) return void (values[param.key] = void 0);
              try {
                values[param.key] = JSON.parse(rawValue);
              } catch {
                values[param.key] = rawValue;
              }
              return;
            }
            values[param.key] =
              'textarea' === param.type ? event.target.value : event.target.value.trim();
          } else values[param.key] = Boolean(event.target.checked);
        });
      }),
      !0)
    );
  }
  function buildDataSourceParams(dataSource) {
    const type = dataSource?.type ?? '',
      generic = buildGenericParamFields(getDataSourceDefinition(type), dataSource);
    if (generic) return generic;
    switch (type) {
      case 'rss_feed':
        return `\n          <input type="url" class="job-param-input ds-url" placeholder="Feed URL, e.g. https://hnrss.org/frontpage" value="${escapeHtml(dataSource?.url ?? '')}"/>\n          <input type="number" class="job-param-input ds-max-results" placeholder="Max items (default 10)" value="${dataSource?.maxResults ?? 10}" min="1" max="30"/>`;
      case 'reddit_posts':
        return `\n          <input type="text" class="job-param-input ds-subreddit" placeholder="Subreddit, e.g. programming" value="${escapeHtml(dataSource?.subreddit ?? '')}"/>\n          <select class="job-param-select ds-reddit-sort">\n            <option value="hot" ${'hot' === dataSource?.sort ? 'selected' : ''}>Hot</option>\n            <option value="new" ${'new' === dataSource?.sort ? 'selected' : ''}>New</option>\n            <option value="top" ${'top' === dataSource?.sort ? 'selected' : ''}>Top</option>\n            <option value="rising" ${'rising' === dataSource?.sort ? 'selected' : ''}>Rising</option>\n          </select>\n          <input type="number" class="job-param-input ds-max-results" placeholder="Max posts (default 10)" value="${dataSource?.maxResults ?? 10}" min="1" max="25"/>`;
      case 'hacker_news':
        return `\n          <input type="number" class="job-param-input ds-hn-count" placeholder="Stories (default 10)" value="${dataSource?.count ?? 10}" min="3" max="20"/>\n          <select class="job-param-select ds-hn-type">\n            <option value="top" ${'top' === dataSource?.hnType ? 'selected' : ''}>Top</option>\n            <option value="new" ${'new' === dataSource?.hnType ? 'selected' : ''}>New</option>\n            <option value="best" ${'best' === dataSource?.hnType ? 'selected' : ''}>Best</option>\n            <option value="ask" ${'ask' === dataSource?.hnType ? 'selected' : ''}>Ask HN</option>\n          </select>`;
      case 'weather':
        return `\n          <input type="text" class="job-param-input ds-location" placeholder="City, e.g: London, Mumbai" value="${escapeHtml(dataSource?.location ?? '')}"/>\n          <select class="job-param-select ds-units">\n            <option value="celsius" ${'celsius' === dataSource?.units ? 'selected' : ''}>Celsius</option>\n            <option value="fahrenheit" ${'fahrenheit' === dataSource?.units ? 'selected' : ''}>Fahrenheit</option>\n          </select>`;
      case 'crypto_price':
        return `<input type="text" class="job-param-input ds-coins" placeholder="e.g: bitcoin,ethereum,solana" value="${escapeHtml(dataSource?.coins ?? 'bitcoin,ethereum')}"/>`;
      case 'system_stats':
        return '<div class="ds-info-note">Collects CPU, memory, load, and uptime from your machine. No config needed.</div>';
      case 'read_file':
        return `<input type="text" class="job-param-input ds-filepath" placeholder="/Users/you/logs/app.log" value="${escapeHtml(dataSource?.filePath ?? '')}"/>`;
      case 'fetch_url':
        return `<input type="url" class="job-param-input ds-url" placeholder="https://example.com/page-to-monitor" value="${escapeHtml(dataSource?.url ?? '')}"/>`;
      case 'custom_context':
        return `<textarea class="job-param-textarea ds-context" rows="3" placeholder="Paste any text or context for the AI...">${escapeHtml(dataSource?.context ?? '')}</textarea>`;
      default:
        return '';
    }
  }
  function wireDataSourceParamEvents(container, dataSource) {
    if (bindGenericParamEvents(container, dataSource, getDataSourceDefinition(dataSource?.type)))
      return;
    const query = (selector) => container.querySelector(selector);
    (query('.ds-max-results')?.addEventListener('input', (event) => {
      dataSource.maxResults = parseInt(event.target.value, 10) || 10;
    }),
      query('.ds-query')?.addEventListener('input', (event) => {
        dataSource.query = event.target.value.trim();
      }),
      query('.ds-hn-count')?.addEventListener('input', (event) => {
        dataSource.count = parseInt(event.target.value, 10) || 10;
      }),
      query('.ds-hn-type')?.addEventListener('change', (event) => {
        dataSource.hnType = event.target.value;
      }),
      query('.ds-location')?.addEventListener('input', (event) => {
        dataSource.location = event.target.value.trim();
      }),
      query('.ds-units')?.addEventListener('change', (event) => {
        dataSource.units = event.target.value;
      }),
      query('.ds-coins')?.addEventListener('input', (event) => {
        dataSource.coins = event.target.value.trim();
      }),
      query('.ds-url')?.addEventListener('input', (event) => {
        dataSource.url = event.target.value.trim();
      }),
      query('.ds-subreddit')?.addEventListener('input', (event) => {
        dataSource.subreddit = event.target.value.trim();
      }),
      query('.ds-reddit-sort')?.addEventListener('change', (event) => {
        dataSource.sort = event.target.value;
      }),
      query('.ds-filepath')?.addEventListener('input', (event) => {
        dataSource.filePath = event.target.value.trim();
      }),
      query('.ds-context')?.addEventListener('input', (event) => {
        dataSource.context = event.target.value;
      }));
  }
  function buildOutputParams(output) {
    const generic = buildGenericParamFields(getOutputDefinition(output?.type), output);
    if (generic) return generic;
    switch (output?.type) {
      case 'send_email':
        return `\n          <input type="email" class="job-param-input out-to" placeholder="Send to email *" value="${escapeHtml(output?.to ?? '')}"/>\n          <input type="text" class="job-param-input out-subject" placeholder="Subject (auto-generated if blank)" value="${escapeHtml(output?.subject ?? '')}"/>\n          <input type="email" class="job-param-input out-cc" placeholder="CC (optional)" value="${escapeHtml(output?.cc ?? '')}"/>`;
      case 'send_notification':
        return `<input type="text" class="job-param-input out-notif-title" placeholder="Notification title (optional)" value="${escapeHtml(output?.title ?? '')}"/>`;
      case 'write_file':
        return `\n          <input type="text" class="job-param-input out-file-path" placeholder="/Users/you/Desktop/agent-log.txt" value="${escapeHtml(output?.filePath ?? '')}"/>\n          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:4px 0">\n            <input type="checkbox" class="out-append" ${output?.append ? 'checked' : ''} style="width:14px;height:14px"/>\n            Append to file (instead of overwrite)\n          </label>`;
      case 'append_to_memory':
        return '<div class="ds-info-note ds-info-note--accent"><strong>Agent insights become permanent AI knowledge.</strong><br>The AI analysis is appended to your Memory and reused in future chats.</div>';
      case 'http_webhook':
        return `\n          <input type="url" class="job-param-input out-webhook-url" placeholder="Webhook URL, e.g. https://hooks.slack.com/..." value="${escapeHtml(output?.url ?? '')}"/>\n          <select class="job-param-select out-webhook-method">\n            <option value="POST" ${'POST' === output?.method ? 'selected' : ''}>POST</option>\n            <option value="GET" ${'GET' === output?.method ? 'selected' : ''}>GET</option>\n          </select>`;
      default:
        return '';
    }
  }
  function wireOutputParamEvents(container, job) {
    if (!container || !job.output) return;
    if (bindGenericParamEvents(container, job.output, getOutputDefinition(job.output?.type)))
      return;
    const query = (selector) => container.querySelector(selector);
    (query('.out-to')?.addEventListener('input', (event) => {
      job.output.to = event.target.value.trim();
    }),
      query('.out-subject')?.addEventListener('input', (event) => {
        job.output.subject = event.target.value.trim();
      }),
      query('.out-cc')?.addEventListener('input', (event) => {
        job.output.cc = event.target.value.trim();
      }),
      query('.out-notif-title')?.addEventListener('input', (event) => {
        job.output.title = event.target.value.trim();
      }),
      query('.out-file-path')?.addEventListener('input', (event) => {
        job.output.filePath = event.target.value.trim();
      }),
      query('.out-append')?.addEventListener('change', (event) => {
        job.output.append = event.target.checked;
      }),
      query('.out-webhook-url')?.addEventListener('input', (event) => {
        job.output.url = event.target.value.trim();
      }),
      query('.out-webhook-method')?.addEventListener('change', (event) => {
        job.output.method = event.target.value;
      }));
  }
  const onAddJobClick = () => {
    state.jobs.length >= MAX_JOBS ||
      ((state.jobs = [...state.jobs, createNewJob()]),
      renderJobsList(),
      requestAnimationFrame(() => {
        const lastCard = jobsListEl?.lastElementChild;
        (lastCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
          modalBodyEl?.scrollTo({ top: modalBodyEl.scrollHeight, behavior: 'smooth' }),
          lastCard?.querySelector('.job-name-input')?.focus());
      }));
  };
  return (
    addJobBtn?.addEventListener('click', onAddJobClick),
    {
      renderJobsList: renderJobsList,
      cleanup() {
        addJobBtn?.removeEventListener('click', onAddJobClick);
      },
    }
  );
}
