import {
  REFRESH_BUTTON_HTML,
  CLEAR_BUTTON_HTML,
  ensureUsageStyles,
  getHTML,
} from './Templates/UsageTemplate.js';
import {
  loadPricing,
  loadRecords,
  filteredRecords,
  computeStats,
  setRange,
  _records,
} from './Data/UsageData.js';
import {
  renderSummary,
  renderInsights,
  renderChart,
  renderHeatmap,
  renderDow,
  renderCostTable,
  renderModelRows,
  renderProviders,
  renderActivity,
  showEmpty,
  showSections,
} from './Renderers/UsageRenderers.js';
import { t } from '../../../../System/I18n/index.js';
function render(range) {
  const records = filteredRecords(),
    stats = computeStats(records);
  _records.length
    ? (showSections(),
      renderSummary(stats, records),
      renderInsights(stats, records),
      renderChart(stats.byDay, range),
      renderHeatmap(stats.byHour),
      renderDow(stats.byDow),
      renderCostTable(stats.byModel),
      renderModelRows(stats.byModel),
      renderProviders(stats.byProvider),
      renderActivity(records))
    : showEmpty();
}
async function load(range) {
  (await loadRecords(), render(range));
}
export function mount(outlet) {
  (ensureUsageStyles(), (outlet.innerHTML = getHTML(REFRESH_BUTTON_HTML, CLEAR_BUTTON_HTML)));
  // Move modal to body so position:fixed covers full viewport incl. titlebar
  document.getElementById('confirm-overlay') &&
    document.body.appendChild(document.getElementById('confirm-overlay'));
  let currentRange = 'today';
  setRange(currentRange);
  const rangeButtons = [...outlet.querySelectorAll('.usage-range-btn')],
    refreshBtn = outlet.querySelector('#refresh-btn'),
    clearBtn = outlet.querySelector('#clear-usage-btn'),
    overlay = document.getElementById('confirm-overlay'),
    confirmCancel = document.getElementById('confirm-cancel'),
    confirmDelete = document.getElementById('confirm-delete'),
    onRangeClick = (event) => {
      const button = event.currentTarget;
      (rangeButtons.forEach((entry) => entry.classList.remove('active')),
        button.classList.add('active'),
        (currentRange = button.dataset.range),
        setRange(currentRange),
        render(currentRange));
    },
    onRefreshClick = async () => {
      (refreshBtn && ((refreshBtn.disabled = !0), (refreshBtn.textContent = t('usage.refreshing'))),
        await load(currentRange),
        refreshBtn && ((refreshBtn.disabled = !1), (refreshBtn.innerHTML = REFRESH_BUTTON_HTML)));
    },
    onOpenClear = () => overlay?.classList.add('open'),
    onCloseClear = () => overlay?.classList.remove('open'),
    onOverlayClick = (event) => {
      event.target === overlay && overlay.classList.remove('open');
    },
    onConfirmDelete = async () => {
      (overlay?.classList.remove('open'), await window.electronAPI?.invoke?.('clear-usage'));
      const { setRecords: setRecords } = await import('./Data/UsageData.js');
      (setRecords([]), render(currentRange));
    },
    onKeydown = (event) => {
      'Escape' === event.key && overlay?.classList.remove('open');
    };
  return (
    rangeButtons.forEach((button) => button.addEventListener('click', onRangeClick)),
    refreshBtn?.addEventListener('click', onRefreshClick),
    clearBtn?.addEventListener('click', onOpenClear),
    confirmCancel?.addEventListener('click', onCloseClear),
    confirmDelete?.addEventListener('click', onConfirmDelete),
    overlay?.addEventListener('click', onOverlayClick),
    document.addEventListener('keydown', onKeydown),
    loadPricing().then(() => load(currentRange)),
    function () {
      (overlay?.classList.remove('open'),
        rangeButtons.forEach((button) => button.removeEventListener('click', onRangeClick)),
        refreshBtn?.removeEventListener('click', onRefreshClick),
        clearBtn?.removeEventListener('click', onOpenClear),
        confirmCancel?.removeEventListener('click', onCloseClear),
        confirmDelete?.removeEventListener('click', onConfirmDelete),
        overlay?.removeEventListener('click', onOverlayClick),
        document.removeEventListener('keydown', onKeydown),
        overlay?.remove());
    }
  );
}
