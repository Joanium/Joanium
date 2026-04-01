import { REFRESH_BUTTON_HTML, CLEAR_BUTTON_HTML, ensureUsageStyles, getHTML } from './Templates/UsageTemplate.js';
import { loadPricing, loadRecords, filteredRecords, computeStats, setRange, _records } from './Data/UsageData.js';
import {
  renderSummary, renderInsights, renderChart, renderHeatmap,
  renderDow, renderCostTable, renderModelRows, renderProviders,
  renderActivity, showEmpty, showSections,
} from './Renderers/UsageRenderers.js';

function render(range) {
  const records = filteredRecords();
  const stats = computeStats(records);

  if (!_records.length) {
    showEmpty();
    return;
  }

  showSections();
  renderSummary(stats, records);
  renderInsights(stats, records);
  renderChart(stats.byDay, range);
  renderHeatmap(stats.byHour);
  renderDow(stats.byDow);
  renderCostTable(stats.byModel);
  renderModelRows(stats.byModel);
  renderProviders(stats.byProvider);
  renderActivity(records);
}

async function load(range) {
  await loadRecords();
  render(range);
}

export function mount(outlet) {
  ensureUsageStyles();
  outlet.innerHTML = getHTML(REFRESH_BUTTON_HTML, CLEAR_BUTTON_HTML);

  let currentRange = 'today';
  setRange(currentRange);

  const rangeButtons = [...outlet.querySelectorAll('.usage-range-btn')];
  const refreshBtn = outlet.querySelector('#refresh-btn');
  const clearBtn = outlet.querySelector('#clear-usage-btn');
  const overlay = document.getElementById('confirm-overlay');
  const confirmCancel = document.getElementById('confirm-cancel');
  const confirmDelete = document.getElementById('confirm-delete');

  const onRangeClick = event => {
    const button = event.currentTarget;
    rangeButtons.forEach(entry => entry.classList.remove('active'));
    button.classList.add('active');
    currentRange = button.dataset.range;
    setRange(currentRange);
    render(currentRange);
  };

  const onRefreshClick = async () => {
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing...'; }
    await load(currentRange);
    if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = REFRESH_BUTTON_HTML; }
  };

  const onOpenClear = () => overlay?.classList.add('open');
  const onCloseClear = () => overlay?.classList.remove('open');
  const onOverlayClick = event => { if (event.target === overlay) overlay.classList.remove('open'); };
  const onConfirmDelete = async () => {
    overlay?.classList.remove('open');
    await window.electronAPI?.clearUsage?.();
    const { setRecords } = await import('./Data/UsageData.js');
    setRecords([]);
    render(currentRange);
  };
  const onKeydown = event => { if (event.key === 'Escape') overlay?.classList.remove('open'); };

  rangeButtons.forEach(button => button.addEventListener('click', onRangeClick));
  refreshBtn?.addEventListener('click', onRefreshClick);
  clearBtn?.addEventListener('click', onOpenClear);
  confirmCancel?.addEventListener('click', onCloseClear);
  confirmDelete?.addEventListener('click', onConfirmDelete);
  overlay?.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeydown);

  loadPricing().then(() => load(currentRange));

  return function cleanup() {
    overlay?.classList.remove('open');
    rangeButtons.forEach(button => button.removeEventListener('click', onRangeClick));
    refreshBtn?.removeEventListener('click', onRefreshClick);
    clearBtn?.removeEventListener('click', onOpenClear);
    confirmCancel?.removeEventListener('click', onCloseClear);
    confirmDelete?.removeEventListener('click', onConfirmDelete);
    overlay?.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onKeydown);
  };
}
