/** Read a VYBIT_* env variable injected by the server into the page */
export function env(key: string): string | undefined {
  return (window as any).__VYBIT_ENV__?.[key];
}

/** True when VYBIT_DEBUG is set to any truthy value */
export function isDebug(): boolean {
  const v = env('VYBIT_DEBUG');
  return v !== undefined && v !== '' && v !== '0' && v !== 'false';
}

/** Log only when VYBIT_DEBUG is enabled */
export function debugLog(prefix: string, ...args: any[]): void {
  if (isDebug()) console.log(`[${prefix}]`, ...args);
}

/** Warn only when VYBIT_DEBUG is enabled */
export function debugWarn(prefix: string, ...args: any[]): void {
  if (isDebug()) console.warn(`[${prefix}]`, ...args);
}
