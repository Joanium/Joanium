export const type = 'custom_context';
export const meta = { label: 'Custom Context', group: 'Other' };
export async function collect(ds) {
  return ds.context?.trim() || '(no context provided)';
}
