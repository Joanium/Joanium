function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPatternRegex(
  pattern,
  { useRegex = false, flags = '', errorPrefix = 'Invalid pattern' } = {},
) {
  try {
    return new RegExp(useRegex ? pattern : escapeRegexLiteral(pattern), flags);
  } catch (error) {
    throw new Error(`${errorPrefix}: ${error.message}`);
  }
}
