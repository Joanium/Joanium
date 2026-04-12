import { getHTML } from './Templates/SkillsTemplate.js';
import { openConfirm, closeConfirm } from './Components/SkillsConfirm.js';
import { createCardPool } from '../../../../System/CardPool.js';
import { renderMarkdownToHtml } from '../../../../System/Utils.js';
let skillsGrid = null,
  skillsEmpty = null,
  searchWrapper = null,
  searchInput = null,
  searchClearBtn = null,
  countEl = null,
  enabledCountEl = null,
  enableAllBtn = null,
  disableAllBtn = null,
  _navigate = null,
  modalBackdrop = null,
  modalName = null,
  modalContent = null,
  modalCloseBtn = null,
  _allSkills = [],
  _skillPool = null;
function updateCounts() {
  const total = _allSkills.length,
    enabled = _allSkills.filter((s) => s.enabled).length;
  (countEl && (countEl.textContent = `${total} skill${1 !== total ? 's' : ''}`),
    enabledCountEl &&
      ((enabledCountEl.textContent = 0 === enabled ? 'None active' : `${enabled} active`),
      enabledCountEl.classList.toggle('skills-enabled-count--active', enabled > 0)),
    enableAllBtn && (enableAllBtn.disabled = enabled === total),
    disableAllBtn && (disableAllBtn.disabled = 0 === enabled));
}
function openModal(skill) {
  modalName &&
    modalContent &&
    modalBackdrop &&
    ((modalName.textContent = skill.name),
    (modalContent.innerHTML = renderMarkdownToHtml(skill.raw)),
    modalBackdrop.classList.add('open'),
    document.body.classList.add('modal-open'));
}
function closeModal() {
  (modalBackdrop?.classList.remove('open'), document.body.classList.remove('modal-open'));
}
function createSkillCard() {
  const card = document.createElement('div');
  ((card.className = 'skill-card'),
    (card._currentSkill = null),
    (card.innerHTML =
      '\n    <div class="skill-card-head">\n      <div class="skill-icon">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round"/>\n        </svg>\n      </div>\n      <div class="skill-card-title-group">\n        <div class="skill-name-row">\n          <div class="skill-name"></div>\n          <span class="skill-verified" hidden aria-label="Verified Joanium skill" title="Verified Joanium skill">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M9 12.75l2.25 2.25L15 9.75" stroke-linecap="round" stroke-linejoin="round"/>\n              <path d="M12 3l2.6 1.2 2.84-.34 1.2 2.6 2.36 1.62-.8 2.74.8 2.74-2.36 1.62-1.2 2.6-2.84-.34L12 21l-2.6-1.2-2.84.34-1.2-2.6L3 15.92l.8-2.74L3 10.44l2.36-1.62 1.2-2.6 2.84.34L12 3z" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>\n          </span>\n        </div>\n        <div class="skill-meta-row">\n          <span class="skill-badge">Skill</span>\n          <span class="skill-publisher"></span>\n        </div>\n      </div>\n      <label class="skill-toggle" title="">\n        <input type="checkbox" class="skill-toggle-input" />\n        <span class="skill-toggle-track"></span>\n      </label>\n    </div>\n    <div class="skill-trigger" style="display:none">\n      <span class="skill-trigger-label">When</span>\n      <span class="skill-trigger-text"></span>\n    </div>\n    <div class="skill-description" style="display:none"></div>\n    <div class="skill-card-footer">\n      <button class="skill-read-btn" type="button">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke-linecap="round" stroke-linejoin="round"/>\n          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke-linecap="round" stroke-linejoin="round"/>\n        </svg>\n        Read\n      </button>\n    </div>'));
  const toggleInput = card.querySelector('.skill-toggle-input'),
    toggleLabel = card.querySelector('.skill-toggle');
  return (
    toggleLabel?.addEventListener('click', (e) => e.stopPropagation()),
    toggleInput?.addEventListener('change', async (e) => {
      const skill = card._currentSkill;
      if (!skill) return;
      const newEnabled = e.target.checked;
      (toggleLabel && (toggleLabel.title = newEnabled ? 'Disable this skill' : 'Enable this skill'),
        card.classList.toggle('skill-card--enabled', newEnabled),
        await (async function (skillId, newEnabled) {
          const skill = _allSkills.find((s) => s.id === skillId);
          (skill && (skill.enabled = newEnabled), updateCounts());
          const result = await window.electronAPI?.invoke?.('toggle-skill', skillId, newEnabled);
          result?.ok ||
            (skill && (skill.enabled = !newEnabled),
            render(searchInput?.value?.trim() ?? ''),
            console.error('[Skills] Toggle failed:', result?.error));
        })(skill.id, newEnabled));
    }),
    card.addEventListener('click', (e) => {
      e.target.closest('.skill-toggle') || (card._currentSkill && openModal(card._currentSkill));
    }),
    card.querySelector('.skill-read-btn')?.addEventListener('click', (e) => {
      (e.stopPropagation(), card._currentSkill && openModal(card._currentSkill));
    }),
    card
  );
}
function updateSkillCard(card, skill) {
  ((card._currentSkill = skill),
    (card.className = 'skill-card' + (skill.enabled ? ' skill-card--enabled' : '')),
    (card.dataset.filename = skill.filename),
    (card.dataset.skillId = skill.id),
    (card.querySelector('.skill-name').textContent = skill.name),
    (card.querySelector('.skill-publisher').textContent = skill.publisher),
    (card.querySelector('.skill-verified').hidden = !0 !== skill.isVerified),
    (card.querySelector('.skill-toggle').title = skill.enabled
      ? 'Disable this skill'
      : 'Enable this skill'),
    (card.querySelector('.skill-toggle-input').checked = skill.enabled));
  const triggerEl = card.querySelector('.skill-trigger');
  skill.trigger
    ? ((triggerEl.style.display = ''),
      (card.querySelector('.skill-trigger-text').textContent = skill.trigger))
    : (triggerEl.style.display = 'none');
  const descEl = card.querySelector('.skill-description');
  skill.description
    ? ((descEl.style.display = ''), (descEl.textContent = skill.description))
    : (descEl.style.display = 'none');
}
function render(query = '') {
  const filtered = _allSkills.filter((s) =>
    (function (skill, query) {
      if (!query) return !0;
      const lowerQuery = query.toLowerCase();
      return [
        skill.name,
        skill.publisher,
        skill.trigger,
        skill.description,
        skill.body,
        skill.filename,
      ]
        .join(' ')
        .toLowerCase()
        .includes(lowerQuery);
    })(s, query),
  );
  if ((updateCounts(), 0 === _allSkills.length))
    return ((skillsEmpty.hidden = !1), (skillsGrid.hidden = !0), void (searchWrapper.hidden = !0));
  if (
    ((skillsEmpty.hidden = !0),
    (searchWrapper.hidden = !1),
    (skillsGrid.hidden = !1),
    0 === filtered.length)
  ) {
    _skillPool.render([]);
    let noResults = skillsGrid.querySelector('.skills-no-results');
    return (
      noResults ||
        ((noResults = document.createElement('div')),
        (noResults.className = 'skills-no-results'),
        skillsGrid.appendChild(noResults)),
      (noResults.textContent = `No skills match "${query}"`),
      void (noResults.style.display = '')
    );
  }
  const noResults = skillsGrid.querySelector('.skills-no-results');
  (noResults && (noResults.style.display = 'none'), _skillPool.render(filtered));
}
export function mount(outlet, { navigate: navigate } = {}) {
  ((outlet.innerHTML = getHTML()),
    (skillsGrid = document.getElementById('skills-grid')),
    (skillsEmpty = document.getElementById('skills-empty')),
    (searchWrapper = document.getElementById('skills-search-wrapper')),
    (searchInput = document.getElementById('skills-search')),
    (searchClearBtn = document.getElementById('skills-search-clear')),
    (countEl = document.getElementById('skills-count')),
    (enabledCountEl = document.getElementById('skills-enabled-count')),
    (enableAllBtn = document.getElementById('skills-enable-all')),
    (disableAllBtn = document.getElementById('skills-disable-all')),
    (modalBackdrop = document.getElementById('skill-modal-backdrop')),
    (modalName = document.getElementById('skill-modal-name')),
    (modalContent = document.getElementById('skill-modal-content')),
    (modalCloseBtn = document.getElementById('skill-modal-close')),
    (_navigate = navigate ?? null),
    (_allSkills = []),
    (_skillPool = createCardPool({
      container: skillsGrid,
      createCard: createSkillCard,
      updateCard: updateSkillCard,
      getKey: (skill) => skill.id,
    })),
    closeConfirm());
  const onModalClose = () => closeModal(),
    onModalBackdropClick = (e) => {
      e.target === modalBackdrop && closeModal();
    },
    onKeydown = (e) => {
      'Escape' === e.key && (closeModal(), closeConfirm());
    },
    onSearchInput = () => {
      (render(searchInput?.value.trim() ?? ''),
        searchClearBtn?.classList.toggle('visible', (searchInput?.value.length ?? 0) > 0));
    },
    onSearchClear = () => {
      (searchInput && (searchInput.value = ''),
        searchClearBtn?.classList.remove('visible'),
        render(''),
        searchInput?.focus());
    },
    onEnableAll = async () => {
      if (
        !(await openConfirm({
          type: 'enable',
          totalCount: _allSkills.length,
          enabledCount: _allSkills.filter((s) => s.enabled).length,
        })) ||
        !enableAllBtn
      )
        return;
      enableAllBtn.disabled = !0;
      const result = await window.electronAPI?.invoke?.('enable-all-skills');
      !1 !== result?.ok &&
        (_allSkills.forEach((s) => {
          s.enabled = !0;
        }),
        render(searchInput?.value?.trim() ?? ''));
    },
    onDisableAll = async () => {
      if (
        !(await openConfirm({
          type: 'disable',
          totalCount: _allSkills.length,
          enabledCount: _allSkills.filter((s) => s.enabled).length,
        })) ||
        !disableAllBtn
      )
        return;
      disableAllBtn.disabled = !0;
      const result = await window.electronAPI?.invoke?.('disable-all-skills');
      !1 !== result?.ok &&
        (_allSkills.forEach((s) => {
          s.enabled = !1;
        }),
        render(searchInput?.value?.trim() ?? ''));
    };
  return (
    modalCloseBtn?.addEventListener('click', onModalClose),
    modalBackdrop?.addEventListener('click', onModalBackdropClick),
    searchInput?.addEventListener('input', onSearchInput),
    searchClearBtn?.addEventListener('click', onSearchClear),
    enableAllBtn?.addEventListener('click', onEnableAll),
    disableAllBtn?.addEventListener('click', onDisableAll),
    document
      .getElementById('skills-go-marketplace')
      ?.addEventListener('click', () => _navigate?.('marketplace')),
    document.addEventListener('keydown', onKeydown),
    (async function () {
      try {
        const result = await window.electronAPI?.invoke?.('get-skills');
        _allSkills = result?.skills ?? [];
      } catch (err) {
        (console.error('[Skills] Load error:', err), (_allSkills = []));
      }
      render(searchInput?.value?.trim() ?? '');
    })(),
    function () {
      (closeModal(),
        closeConfirm(),
        modalCloseBtn?.removeEventListener('click', onModalClose),
        modalBackdrop?.removeEventListener('click', onModalBackdropClick),
        searchInput?.removeEventListener('input', onSearchInput),
        searchClearBtn?.removeEventListener('click', onSearchClear),
        enableAllBtn?.removeEventListener('click', onEnableAll),
        disableAllBtn?.removeEventListener('click', onDisableAll),
        document.removeEventListener('keydown', onKeydown),
        _skillPool?.clear(),
        (_skillPool = null),
        (skillsGrid = skillsEmpty = searchWrapper = searchInput = null),
        (searchClearBtn = countEl = enabledCountEl = enableAllBtn = null),
        (disableAllBtn = modalBackdrop = modalName = modalContent = modalCloseBtn = null),
        (_navigate = null));
    }
  );
}
