export const APP_NAME = 'Cardinal’s Nest';
export const TEAM_BRAND = {
  teamNumber: 6696,
  teamName: 'Cardinal Dynamics',
  themeColor: '#bc262a',
  logoUrl: '/cardinal-dynamics.png',
} as const;

// Adapt untouched upstream identity at read time; never migrate team records.
// Custom settings, roles, departments, credentials and timezone stay intact.
export function resolveTeamBrand<T extends { teamNumber: number; teamName: string; themeColor: string; logoUrl: string | null }>(settings: T): T {
  const legacyIdentity = settings.teamNumber === 10991 && /^(pio[ -]?bytes?)( hub)?$/i.test(settings.teamName.trim());
  return legacyIdentity ? { ...settings, ...TEAM_BRAND } : settings;
}
