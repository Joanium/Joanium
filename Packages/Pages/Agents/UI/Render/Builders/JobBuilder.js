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
  state,
  jobsListEl,
  addJobBtn,
  jobsBadge,
  modalBodyEl,
}) {
  function updateJobsBadge() {
    if (jobsBadge) jobsBadge.textContent = `(${state.jobs.length}/${MAX_JOBS})`;
    if (addJobBtn) addJobBtn.disabled = state.jobs.length >= MAX_JOBS;
  }

  function renderJobsList() {
    if (!jobsListEl) return;

    jobsListEl.innerHTML = '';
    state.jobs.forEach((job, index) => {
      jobsListEl.appendChild(buildJobCard(job, index));
    });

    updateJobsBadge();
  }

  function buildSourceSelectorHTML(dataSource, sourceIndex) {
    const selectedType = dataSource?.type ?? '';
    const groups = DATA_SOURCE_TYPES.reduce((result, item) => {
      if (!result[item.group]) result[item.group] = [];
      result[item.group].push(item);
      return result;
    }, {});

    const optionsHtml = Object.entries(groups).map(([groupName, items]) => {
      const options = items.map(item => (
        `<option value="${item.value}" ${selectedType === item.value ? 'selected' : ''}>${item.label}</option>`
      )).join('');
      return `<optgroup label="${groupName}">${options}</optgroup>`;
    }).join('');

    return `
      <div class="source-selector-group" data-source-idx="${sourceIndex}">
        <div class="source-selector-top">
          <select class="job-param-select ds-type-select">
            <option value="">- ${sourceIndex === 0 ? 'Choose a data source' : 'Add another source'} -</option>
            ${optionsHtml}
          </select>
          ${sourceIndex > 0 ? `
            <button type="button" class="source-remove-btn" title="Remove source">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>` : ''}
        </div>
        <div class="ds-params-area">${buildDataSourceParams(dataSource)}</div>
      </div>`;
  }

  function buildJobCard(job, index) {
    const card = document.createElement('div');
    card.className = 'job-card open';
    card.dataset.jobId = job.id;

    ensureJobDataSources(job);
    job.trigger = job.trigger ?? { type: 'daily', time: '08:00' };
    job.output = job.output ?? { type: '' };

    const nameHint = getJobLabel(job, DATA_SOURCE_TYPES, 'New Job');

    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-card-number">${index + 1}</div>
        <div class="job-card-name ${job.name ? 'has-value' : ''}">${escapeHtml(nameHint)}</div>
        <svg class="job-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 15l-6-6-6 6" stroke-linecap="round"/>
        </svg>
        <button type="button" class="job-remove-btn" title="Remove job">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="job-body">
        <div class="agent-field" style="margin-top:14px">
          <label class="agent-field-label">
            Job Label <span style="color:var(--text-muted);font-weight:400">(optional)</span>
          </label>
          <input type="text" class="agent-input job-name-input"
            value="${escapeHtml(job.name ?? '')}"
            placeholder="e.g. Morning Email Digest, Daily PR Check..."
            maxlength="60"/>
        </div>

        <div class="job-sub-section">
          <div class="job-sub-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/>
            </svg>
            When to Run
          </div>
          ${buildTriggerHTML(job.trigger)}
        </div>

        <div class="job-sub-section">
          <div class="job-sub-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/>
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke-linecap="round"/>
            </svg>
            Data to Collect
            <span class="job-sources-count-badge" style="font-size:10px;color:var(--text-muted);font-weight:500;letter-spacing:0;text-transform:none">
              (${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div class="sources-list">
            ${job.dataSources.map((dataSource, sourceIndex) => buildSourceSelectorHTML(dataSource, sourceIndex)).join('')}
          </div>
          <button type="button" class="add-source-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
            </svg>
            Add another data source
          </button>
        </div>

        <div class="job-sub-section">
          <div class="job-sub-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
            </svg>
            AI Instruction
          </div>
          <div class="job-params">
            <textarea class="job-param-textarea job-instruction" rows="4"
              placeholder="Tell the AI what to do with the data - and any conditions e.g. 'only alert me if CPU exceeds 90%' or 'only send if there are urgent emails'..."
            >${escapeHtml(job.instruction ?? '')}</textarea>
          </div>
          <div class="job-instruction-hint">
            Tip: You can write conditions directly here - e.g. "Only send if there are PRs waiting for my review" or "Skip if everything is normal."
          </div>
        </div>

        <div class="job-sub-section">
          <div class="job-sub-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
            What to Do With the Result
          </div>
          ${buildOutputHTML(job.output)}
        </div>

      </div>`;

    card.querySelector('.job-card-header')?.addEventListener('click', event => {
      if (event.target.closest('.job-remove-btn')) return;
      card.classList.toggle('open');
    });

    card.querySelector('.job-remove-btn')?.addEventListener('click', () => {
      state.jobs = state.jobs.filter(item => item.id !== job.id);
      renderJobsList();
    });

    const nameInput = card.querySelector('.job-name-input');
    const nameLabel = card.querySelector('.job-card-name');
    nameInput?.addEventListener('input', () => {
      job.name = nameInput.value.trim();
      nameLabel.textContent = getJobLabel(job, DATA_SOURCE_TYPES, 'Job');
      nameLabel.classList.toggle('has-value', !!job.name);
    });

    wireTriggerEvents(card, job);
    wireAllSourceEvents(card, job);

    card.querySelector('.add-source-btn')?.addEventListener('click', () => {
      job.dataSources.push({ type: '' });
      card.querySelector('.sources-list').innerHTML =
        job.dataSources.map((dataSource, sourceIndex) => buildSourceSelectorHTML(dataSource, sourceIndex)).join('');
      card.querySelector('.job-sources-count-badge').textContent =
        `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
      wireAllSourceEvents(card, job);
    });

    card.querySelector('.job-instruction')?.addEventListener('input', event => {
      job.instruction = event.target.value;
    });

    wireOutputEvents(card, job);

    return card;
  }

  function wireAllSourceEvents(card, job) {
    const sourcesListEl = card.querySelector('.sources-list');
    if (!sourcesListEl) return;

    sourcesListEl.querySelectorAll('.source-selector-group').forEach((groupEl, sourceIndex) => {
      const typeSelect = groupEl.querySelector('.ds-type-select');
      const paramsArea = groupEl.querySelector('.ds-params-area');

      typeSelect?.addEventListener('change', () => {
        const nextType = typeSelect.value;
        if (!job.dataSources[sourceIndex]) job.dataSources[sourceIndex] = {};
        job.dataSources[sourceIndex] = { type: nextType };

        const instructionArea = card.querySelector('.job-instruction');
        if (sourceIndex === 0 && instructionArea && !instructionArea.value.trim()) {
          const template = INSTRUCTION_TEMPLATES[nextType];
          if (template) {
            instructionArea.value = template;
            job.instruction = template;
          }
        }

        const nameLabel = card.querySelector('.job-card-name');
        const nameInput = card.querySelector('.job-name-input');
        if (sourceIndex === 0 && !nameInput?.value.trim() && nameLabel) {
          nameLabel.textContent = getJobLabel(job, DATA_SOURCE_TYPES, 'Job');
        }

        if (paramsArea) paramsArea.innerHTML = buildDataSourceParams(job.dataSources[sourceIndex]);
        card.querySelector('.job-sources-count-badge').textContent =
          `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
        wireDataSourceParamEvents(groupEl, job.dataSources[sourceIndex]);
      });

      groupEl.querySelector('.source-remove-btn')?.addEventListener('click', () => {
        job.dataSources.splice(sourceIndex, 1);
        sourcesListEl.innerHTML =
          job.dataSources.map((dataSource, currentIndex) => buildSourceSelectorHTML(dataSource, currentIndex)).join('');
        card.querySelector('.job-sources-count-badge').textContent =
          `(${job.dataSources.length} source${job.dataSources.length !== 1 ? 's' : ''})`;
        wireAllSourceEvents(card, job);
      });

      wireDataSourceParamEvents(groupEl, job.dataSources[sourceIndex] ?? {});
    });
  }

  function buildTriggerHTML(trigger) {
    const type = trigger?.type ?? 'daily';
    const time = trigger?.time ?? '08:00';
    const day = trigger?.day ?? 'monday';
    const minutes = trigger?.minutes ?? 30;

    const intervals = [5, 10, 15, 30, 60, 120, 240, 480, 1440];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return `
      <div class="job-params">
        <select class="job-param-select trigger-type-select">
          <option value="on_startup" ${type === 'on_startup' ? 'selected' : ''}>On app startup</option>
          <option value="interval" ${type === 'interval' ? 'selected' : ''}>At an interval</option>
          <option value="hourly" ${type === 'hourly' ? 'selected' : ''}>Every hour</option>
          <option value="daily" ${type === 'daily' ? 'selected' : ''}>Every day at...</option>
          <option value="weekly" ${type === 'weekly' ? 'selected' : ''}>Every week on...</option>
        </select>
        <div class="job-trigger-sub ${type === 'interval' ? '' : 'hidden'} trigger-sub-interval">
          <select class="job-interval-select">
            ${intervals.map(value => (
              `<option value="${value}" ${minutes === value ? 'selected' : ''}>${value < 60 ? `Every ${value} min` : value === 60 ? 'Every 1 hr' : `Every ${value / 60} hrs`}</option>`
            )).join('')}
          </select>
        </div>
        <div class="job-trigger-sub ${type === 'daily' ? '' : 'hidden'} trigger-sub-daily">
          <span style="font-size:12px;color:var(--text-muted)">at</span>
          <input type="time" class="job-time-input trigger-time-daily" value="${time}"/>
        </div>
        <div class="job-trigger-sub ${type === 'weekly' ? '' : 'hidden'} trigger-sub-weekly">
          <select class="job-day-select trigger-day">
            ${days.map(value => `<option value="${value}" ${day === value ? 'selected' : ''}>${capitalize(value)}</option>`).join('')}
          </select>
          <span style="font-size:12px;color:var(--text-muted)">at</span>
          <input type="time" class="job-time-input trigger-time-weekly" value="${time}"/>
        </div>
      </div>`;
  }

  function wireTriggerEvents(card, job) {
    const triggerTypeSelect = card.querySelector('.trigger-type-select');
    if (!triggerTypeSelect) return;

    triggerTypeSelect.addEventListener('change', () => {
      job.trigger = job.trigger ?? {};
      job.trigger.type = triggerTypeSelect.value;
      card.querySelector('.trigger-sub-interval')?.classList.toggle('hidden', triggerTypeSelect.value !== 'interval');
      card.querySelector('.trigger-sub-daily')?.classList.toggle('hidden', triggerTypeSelect.value !== 'daily');
      card.querySelector('.trigger-sub-weekly')?.classList.toggle('hidden', triggerTypeSelect.value !== 'weekly');
    });

    card.querySelector('.job-interval-select')?.addEventListener('change', event => {
      job.trigger = job.trigger ?? {};
      job.trigger.minutes = parseInt(event.target.value, 10) || 10;
    });
    card.querySelector('.trigger-time-daily')?.addEventListener('change', event => {
      job.trigger = job.trigger ?? {};
      job.trigger.time = event.target.value;
    });
    card.querySelector('.trigger-day')?.addEventListener('change', event => {
      job.trigger = job.trigger ?? {};
      job.trigger.day = event.target.value;
    });
    card.querySelector('.trigger-time-weekly')?.addEventListener('change', event => {
      job.trigger = job.trigger ?? {};
      job.trigger.time = event.target.value;
    });
  }

  function getDataSourceDefinition(type) {
    return DATA_SOURCE_TYPES.find(item => item.value === type) ?? null;
  }

  function getOutputDefinition(type) {
    return OUTPUT_TYPES.find(item => item.value === type) ?? null;
  }

  function renderParamControl(param, value) {
    const type = param.type ?? 'text';
    const attrs = [
      `data-param-key="${param.key}"`,
      `data-param-type="${type}"`,
      `class="${type === 'textarea' ? 'job-param-textarea' : type === 'select' ? 'job-param-select' : type === 'checkbox' ? 'job-param-checkbox' : 'job-param-input'}"`,
    ];

    if (param.placeholder) attrs.push(`placeholder="${escapeHtml(param.placeholder)}"`);
    if (param.min != null) attrs.push(`min="${param.min}"`);
    if (param.max != null) attrs.push(`max="${param.max}"`);
    if (param.parse) attrs.push(`data-param-parse="${param.parse}"`);

    const resolvedValue = value ?? param.defaultValue ?? (type === 'checkbox' ? false : '');

    if (type === 'select') {
      const options = (param.options ?? []).map(option => (
        `<option value="${escapeHtml(String(option))}" ${String(option) === String(resolvedValue) ? 'selected' : ''}>${escapeHtml(String(option))}</option>`
      )).join('');
      return `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><select ${attrs.join(' ')}>${options}</select>`;
    }

    if (type === 'textarea') {
      return `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><textarea rows="${param.rows ?? 3}" ${attrs.join(' ')}>${escapeHtml(String(resolvedValue ?? ''))}</textarea>`;
    }

    if (type === 'checkbox') {
      return `<label class="job-param-checkbox-row"><input type="checkbox" ${attrs.join(' ')} ${resolvedValue ? 'checked' : ''}/> <span>${escapeHtml(param.label ?? param.key)}</span></label>`;
    }

    return `<label class="job-param-label">${escapeHtml(param.label ?? param.key)}</label><input type="${type === 'number' ? 'number' : type}" value="${escapeHtml(String(resolvedValue ?? ''))}" ${attrs.join(' ')}/>`;
  }

  function buildGenericParamFields(definition, values = {}) {
    const params = definition?.params ?? [];
    if (!params.length) return '';
    return `<div class="job-param-fields">${params.map(param => `<div class="job-param-field">${renderParamControl(param, values?.[param.key])}</div>`).join('')}</div>`;
  }

  function bindGenericParamEvents(container, values, definition) {
    const params = definition?.params ?? [];
    if (!params.length) return false;

    params.forEach(param => {
      const input = container.querySelector(`[data-param-key="${param.key}"]`);
      if (!input) return;
      const eventName = param.type === 'select' || param.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(eventName, event => {
        if (param.type === 'checkbox') {
          values[param.key] = Boolean(event.target.checked);
          return;
        }

        if (param.type === 'number') {
          const parsed = parseInt(event.target.value, 10);
          values[param.key] = Number.isNaN(parsed) ? undefined : parsed;
          return;
        }

        if (param.parse === 'json') {
          const rawValue = event.target.value.trim();
          if (!rawValue) {
            values[param.key] = undefined;
            return;
          }
          try {
            values[param.key] = JSON.parse(rawValue);
          } catch {
            values[param.key] = rawValue;
          }
          return;
        }

        values[param.key] = param.type === 'textarea' ? event.target.value : event.target.value.trim();
      });
    });

    return true;
  }

  function buildDataSourceParams(dataSource) {
    const type = dataSource?.type ?? '';
    const generic = buildGenericParamFields(getDataSourceDefinition(type), dataSource);
    if (generic) return generic;

    switch (type) {

      case 'rss_feed':
        return `
          <input type="url" class="job-param-input ds-url" placeholder="Feed URL, e.g. https://hnrss.org/frontpage" value="${escapeHtml(dataSource?.url ?? '')}"/>
          <input type="number" class="job-param-input ds-max-results" placeholder="Max items (default 10)" value="${dataSource?.maxResults ?? 10}" min="1" max="30"/>`;
      case 'reddit_posts':
        return `
          <input type="text" class="job-param-input ds-subreddit" placeholder="Subreddit, e.g. programming" value="${escapeHtml(dataSource?.subreddit ?? '')}"/>
          <select class="job-param-select ds-reddit-sort">
            <option value="hot" ${dataSource?.sort === 'hot' ? 'selected' : ''}>Hot</option>
            <option value="new" ${dataSource?.sort === 'new' ? 'selected' : ''}>New</option>
            <option value="top" ${dataSource?.sort === 'top' ? 'selected' : ''}>Top</option>
            <option value="rising" ${dataSource?.sort === 'rising' ? 'selected' : ''}>Rising</option>
          </select>
          <input type="number" class="job-param-input ds-max-results" placeholder="Max posts (default 10)" value="${dataSource?.maxResults ?? 10}" min="1" max="25"/>`;
      case 'hacker_news':
        return `
          <input type="number" class="job-param-input ds-hn-count" placeholder="Stories (default 10)" value="${dataSource?.count ?? 10}" min="3" max="20"/>
          <select class="job-param-select ds-hn-type">
            <option value="top" ${dataSource?.hnType === 'top' ? 'selected' : ''}>Top</option>
            <option value="new" ${dataSource?.hnType === 'new' ? 'selected' : ''}>New</option>
            <option value="best" ${dataSource?.hnType === 'best' ? 'selected' : ''}>Best</option>
            <option value="ask" ${dataSource?.hnType === 'ask' ? 'selected' : ''}>Ask HN</option>
          </select>`;
      case 'weather':
        return `
          <input type="text" class="job-param-input ds-location" placeholder="City, e.g: London, Mumbai" value="${escapeHtml(dataSource?.location ?? '')}"/>
          <select class="job-param-select ds-units">
            <option value="celsius" ${dataSource?.units === 'celsius' ? 'selected' : ''}>Celsius</option>
            <option value="fahrenheit" ${dataSource?.units === 'fahrenheit' ? 'selected' : ''}>Fahrenheit</option>
          </select>`;
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
    if (bindGenericParamEvents(container, dataSource, getDataSourceDefinition(dataSource?.type))) return;

    const query = selector => container.querySelector(selector);

    query('.ds-max-results')?.addEventListener('input', event => {
      dataSource.maxResults = parseInt(event.target.value, 10) || 10;
    });
    query('.ds-query')?.addEventListener('input', event => {
      dataSource.query = event.target.value.trim();
    });
    query('.ds-hn-count')?.addEventListener('input', event => {
      dataSource.count = parseInt(event.target.value, 10) || 10;
    });
    query('.ds-hn-type')?.addEventListener('change', event => {
      dataSource.hnType = event.target.value;
    });
    query('.ds-location')?.addEventListener('input', event => {
      dataSource.location = event.target.value.trim();
    });
    query('.ds-units')?.addEventListener('change', event => {
      dataSource.units = event.target.value;
    });
    query('.ds-coins')?.addEventListener('input', event => {
      dataSource.coins = event.target.value.trim();
    });
    query('.ds-url')?.addEventListener('input', event => {
      dataSource.url = event.target.value.trim();
    });
    query('.ds-subreddit')?.addEventListener('input', event => {
      dataSource.subreddit = event.target.value.trim();
    });
    query('.ds-reddit-sort')?.addEventListener('change', event => {
      dataSource.sort = event.target.value;
    });
    query('.ds-filepath')?.addEventListener('input', event => {
      dataSource.filePath = event.target.value.trim();
    });
    query('.ds-context')?.addEventListener('input', event => {
      dataSource.context = event.target.value;
    });
  }

  function buildOutputHTML(output) {
    const selectedType = output?.type ?? '';
    const groups = OUTPUT_TYPES.reduce((result, item) => {
      if (!result[item.group]) result[item.group] = [];
      result[item.group].push(item);
      return result;
    }, {});

    const optionsHtml = Object.entries(groups).map(([groupName, items]) => {
      const options = items.map(item => (
        `<option value="${item.value}" ${selectedType === item.value ? 'selected' : ''}>${item.label}</option>`
      )).join('');
      return `<optgroup label="${groupName}">${options}</optgroup>`;
    }).join('');

    return `
      <div class="job-params">
        <select class="job-param-select out-type-select">
          <option value="">- Choose what to do with the result -</option>
          ${optionsHtml}
        </select>
        <div class="out-params-area">${buildOutputParams(output)}</div>
      </div>`;
  }

  function buildOutputParams(output) {
    const generic = buildGenericParamFields(getOutputDefinition(output?.type), output);
    if (generic) return generic;

    switch (output?.type) {
      case 'send_email':
        return `
          <input type="email" class="job-param-input out-to" placeholder="Send to email *" value="${escapeHtml(output?.to ?? '')}"/>
          <input type="text" class="job-param-input out-subject" placeholder="Subject (auto-generated if blank)" value="${escapeHtml(output?.subject ?? '')}"/>
          <input type="email" class="job-param-input out-cc" placeholder="CC (optional)" value="${escapeHtml(output?.cc ?? '')}"/>`;
      case 'send_notification':
        return `<input type="text" class="job-param-input out-notif-title" placeholder="Notification title (optional)" value="${escapeHtml(output?.title ?? '')}"/>`;
      case 'write_file':
        return `
          <input type="text" class="job-param-input out-file-path" placeholder="/Users/you/Desktop/agent-log.txt" value="${escapeHtml(output?.filePath ?? '')}"/>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:4px 0">
            <input type="checkbox" class="out-append" ${output?.append ? 'checked' : ''} style="width:14px;height:14px"/>
            Append to file (instead of overwrite)
          </label>`;
      case 'append_to_memory':
        return '<div class="ds-info-note ds-info-note--accent"><strong>Agent insights become permanent AI knowledge.</strong><br>The AI analysis is appended to your Memory and reused in future chats.</div>';
      case 'http_webhook':
        return `
          <input type="url" class="job-param-input out-webhook-url" placeholder="Webhook URL, e.g. https://hooks.slack.com/..." value="${escapeHtml(output?.url ?? '')}"/>
          <select class="job-param-select out-webhook-method">
            <option value="POST" ${output?.method === 'POST' ? 'selected' : ''}>POST</option>
            <option value="GET" ${output?.method === 'GET' ? 'selected' : ''}>GET</option>
          </select>`;
      default:
        return '';
    }
  }

  function wireOutputEvents(card, job) {
    const typeSelect = card.querySelector('.out-type-select');
    const paramsArea = card.querySelector('.out-params-area');
    if (!typeSelect) return;

    typeSelect.addEventListener('change', () => {
      job.output = { type: typeSelect.value };
      if (paramsArea) paramsArea.innerHTML = buildOutputParams(job.output);
      wireOutputParamEvents(card, job);
    });

    wireOutputParamEvents(card, job);
  }

  function wireOutputParamEvents(card, job) {
    if (bindGenericParamEvents(card, job.output, getOutputDefinition(job.output?.type))) return;

    const query = selector => card.querySelector(selector);

    query('.out-to')?.addEventListener('input', event => {
      job.output.to = event.target.value.trim();
    });
    query('.out-subject')?.addEventListener('input', event => {
      job.output.subject = event.target.value.trim();
    });
    query('.out-cc')?.addEventListener('input', event => {
      job.output.cc = event.target.value.trim();
    });
    query('.out-notif-title')?.addEventListener('input', event => {
      job.output.title = event.target.value.trim();
    });
    query('.out-file-path')?.addEventListener('input', event => {
      job.output.filePath = event.target.value.trim();
    });
    query('.out-append')?.addEventListener('change', event => {
      job.output.append = event.target.checked;
    });
    query('.out-webhook-url')?.addEventListener('input', event => {
      job.output.url = event.target.value.trim();
    });
    query('.out-webhook-method')?.addEventListener('change', event => {
      job.output.method = event.target.value;
    });
  }
}
