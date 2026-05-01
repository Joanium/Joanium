let _config = null;
let _inflight = null;

export async function getPromptConfigs() {
  if (_config) return _config;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      _config = (await window.electronAPI?.invoke?.('get-prompt-configs')) ?? {};
    } catch {
      _config = {};
    }
    return _config;
  })();
  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}
