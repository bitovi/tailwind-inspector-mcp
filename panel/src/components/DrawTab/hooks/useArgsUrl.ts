/**
 * Builds a Storybook iframe URL with optional args query parameter.
 *
 * Storybook's args URL format: `&args=key1:value1;key2:value2`
 * Values are URI-encoded. Semicolons separate key:value pairs.
 */
export function buildArgsUrl(
  storyId: string,
  args: Record<string, unknown> = {},
  base = '/storybook',
): string {
  const url = `${base}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
  const entries = Object.entries(args).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return url;

  const argsStr = entries
    .map(([k, v]) => `${encodeURIComponent(k)}:${encodeURIComponent(String(v))}`)
    .join(';');

  return `${url}&args=${argsStr}`;
}
