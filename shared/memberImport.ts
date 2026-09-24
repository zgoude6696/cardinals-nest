/** Public import reports never contain the uploaded CSV or passwords. */
export const MEMBER_CSV_COLUMNS = ['First Name', 'Last Name', 'Username', 'Initial Password', 'Roles', 'Subteams'] as const;
export const MAX_IMPORT_ROWS = 100;
export const MAX_IMPORT_BYTES = 256 * 1024;
export interface MemberImportRow {
  row: number;
  name: string;
  username: string;
  roles: string[];
  subteams: string[];
  errors: string[];
  existingUsername: boolean;
  status: 'ready' | 'invalid' | 'created' | 'failed';
}
export interface MemberImportReport {
  errors: string[];
  rows: MemberImportRow[];
}
