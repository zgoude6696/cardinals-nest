/** Only used when creating demo accounts in an empty database. */
export function demoBootstrapPassword(environment?: string, configured?: string): string {
  if (environment === 'production' && (!configured || configured.length < 12)) {
    throw new Error('Set DEMO_BOOTSTRAP_PASSWORD to at least 12 characters before the first hosted start.');
  }
  return configured || 'changeme';
}
