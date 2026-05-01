const CHANNEL_LABELS = Object.freeze({
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  slack: 'Slack',
});

function channelLabel(name) {
  return CHANNEL_LABELS[name] ?? name ?? 'Channel';
}

export async function fetchHistory() {
  const events = [];
  try {
    const res = await window.electronAPI?.invoke?.('get-agent-runs'),
      runs = Array.isArray(res?.runs) ? res.runs : [];
    for (const [index, run] of runs.entries()) {
      events.push({
        id:
          run.id ||
          `agent__${run.agentId ?? 'unknown'}__${run.startedAt ?? run.timestamp ?? index}`,
        type: 'agent',
        source: run.agentName || 'Agent',
        channel: null,
        status: run.status || 'success',
        timestamp: run.startedAt || run.timestamp || new Date().toISOString(),
        summary: run.summary || '',
        fullResponse: run.fullResponse || '',
        replyText: run.fullResponse || '',
        inboundMessage: '',
        channelFrom: null,
        jobName: run.workspacePath || '',
        error: run.error || null,
        skipReason: null,
        trigger: run.trigger || null,
        receivedAt: run.startedAt || run.timestamp || null,
        repliedAt: run.finishedAt || null,
        provider: run.provider || null,
        model: run.model || null,
        externalId: null,
        targetId: run.projectId || null,
        conversationId: null,
        inputTokens: run.inputTokens ?? 0,
        outputTokens: run.outputTokens ?? 0,
        sourceKind: run.source || 'manual',
      });
    }
  } catch {}
  try {
    const res = await window.electronAPI?.invoke?.('get-channel-messages'),
      messages = Array.isArray(res?.messages) ? res.messages : [];
    for (const [index, entry] of messages.entries()) {
      const timestamp =
          entry.receivedAt || entry.timestamp || entry.repliedAt || new Date().toISOString(),
        channelName = channelLabel(entry.channel);
      events.push({
        id: entry.id || `channel__${entry.channel ?? 'unknown'}__${timestamp}__${index}`,
        type: 'channel',
        source: channelName,
        channel: entry.channel || 'channel',
        status: entry.error || 'error' === entry.status ? 'error' : 'success',
        timestamp: timestamp,
        summary: entry.incoming || '',
        fullResponse: entry.reply || '',
        replyText: entry.reply || '',
        inboundMessage: entry.incoming || '',
        channelFrom: entry.from || 'User',
        jobName: entry.from || 'User',
        error: entry.error || null,
        skipReason: null,
        trigger: null,
        receivedAt: entry.receivedAt || timestamp,
        repliedAt: entry.repliedAt || entry.timestamp || null,
        provider: entry.provider || null,
        model: entry.model || null,
        externalId: entry.externalId || null,
        targetId: entry.targetId || null,
        conversationId: entry.conversationId || null,
      });
    }
  } catch {}
  return (
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    events.slice(0, 200)
  );
}
export async function fetchRunning() {
  try {
    const res = await window.electronAPI?.invoke?.('get-running-jobs');
    return Array.isArray(res?.running) ? res.running : [];
  } catch {
    return [];
  }
}
