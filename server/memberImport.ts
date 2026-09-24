import Papa from 'papaparse';
import { MEMBER_CSV_COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type MemberImportReport, type MemberImportRow } from '../shared/memberImport';
import { storage } from './storage';
import { createMember, MemberCreationError } from './createMember';

type Settings = { roles: { name: string }[]; departments: { name: string }[] };
type ParsedRow = { report: MemberImportRow; password: string };

export function validateMemberCsv(csv: unknown, settings: Settings, usernames: string[]) {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  if (typeof csv !== 'string' || !csv.trim()) return { errors: ['CSV file is empty'], rows };
  if (Buffer.byteLength(csv, 'utf8') > MAX_IMPORT_BYTES) return { errors: ['CSV must be 256 KB or smaller'], rows };
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy', delimiter: ',' });
  // A quote error may shift every subsequent column. Reject the whole file rather than guessing.
  if (parsed.errors.length) return { errors: ['Malformed CSV: check quoted fields and commas'], rows };
  const [header = [], ...records] = parsed.data;
  const columns = header.map(c => c.trim());
  for (const col of MEMBER_CSV_COLUMNS) {
    if (!columns.includes(col)) errors.push(`Missing required column: ${col}`);
    if (columns.filter(c => c === col).length > 1) errors.push(`Duplicate column: ${col}`);
  }
  if (!records.length) errors.push('CSV contains no member rows');
  if (records.length > MAX_IMPORT_ROWS) errors.push(`Import at most ${MAX_IMPORT_ROWS} members at a time`);
  if (errors.length) return { errors, rows };
  const existing = new Set(usernames.map(u => u.toLowerCase().trim()));
  const counts = new Map<string, number>();
  const usernameIndex = columns.indexOf('Username');
  for (const record of records) {
    const key = (record[usernameIndex] || '').trim().toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const canonical = (value: string, configured: { name: string }[], label: string, issues: string[]) => {
    const names = new Map(configured.map(c => [c.name.toLowerCase(), c.name]));
    return [...new Set(value.split(';').map(s => s.trim()).filter(Boolean).map(s => {
      const match = names.get(s.toLowerCase());
      if (!match) issues.push(`Unknown ${label}: ${s}`);
      return match || s;
    }))];
  };
  records.forEach((record, index) => {
    // Do not echo shifted columns: a malformed row could place its password in the name field.
    if (record.length !== columns.length) {
      rows.push({ password: '', report: { row: index + 2, name: '', username: '', roles: [], subteams: [], errors: ['Malformed row: column count does not match header'], existingUsername: false, status: 'invalid' } });
      return;
    }
    const get = (col: string) => record[columns.indexOf(col)]?.trim() || '';
    const issues: string[] = [];
    for (const col of MEMBER_CSV_COLUMNS) if (!get(col)) issues.push(`${col} is required`);
    const password = get('Initial Password');
    if (password && password.length < 8) issues.push('Initial Password must be at least 8 characters');
    const username = get('Username').toLowerCase();
    if (username && counts.get(username)! > 1) issues.push('Duplicate username in CSV');
    const existingUsername = existing.has(username);
    if (existingUsername) issues.push('Username already exists');
    const roles = canonical(get('Roles'), settings.roles, 'role', issues);
    const subteams = canonical(get('Subteams'), settings.departments, 'subteam', issues);
    if (get('Roles') && !roles.length) issues.push('At least one role is required');
    if (get('Subteams') && !subteams.length) issues.push('At least one subteam is required');
    rows.push({ password, report: { row: index + 2, name: `${get('First Name')} ${get('Last Name')}`.trim(), username, roles, subteams, errors: issues, existingUsername, status: issues.length ? 'invalid' : 'ready' } });
  });
  return { errors, rows };
}

export async function processMemberImport(csv: unknown, commit: boolean, selectedRows: number[] = []): Promise<MemberImportReport> {
  const [settings, users] = await Promise.all([storage.getTeamSettings(), storage.getUsers()]);
  const parsed = validateMemberCsv(csv, settings, users.map(u => u.username));
  if (commit && !parsed.errors.length) {
    for (const row of parsed.rows) {
      if (row.report.status !== 'ready') continue;
      if (!selectedRows.includes(row.report.row)) {
        row.report.status = 'invalid';
        row.report.errors = ['Not selected as ready during preview; upload again to include this row'];
        continue;
      }
      try {
        await createMember({ name: row.report.name, username: row.report.username, password: row.password, roles: row.report.roles, departments: row.report.subteams });
        row.report.status = 'created';
      } catch (error) {
        row.report.status = 'failed';
        row.report.errors = [error instanceof MemberCreationError ? error.message : 'Could not create member; re-preview before retrying'];
        row.report.existingUsername = row.report.errors[0] === 'Username already exists';
      }
    }
  }
  return { errors: parsed.errors, rows: parsed.rows.map(r => r.report) };
}
