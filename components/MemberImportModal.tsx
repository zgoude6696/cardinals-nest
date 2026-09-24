import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { MEMBER_CSV_COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type MemberImportReport } from '../shared/memberImport';

export default function MemberImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const { settings } = useTeamSettings();
  const csv = useRef('');
  const dialog = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<MemberImportReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { csv.current = ''; previous?.focus(); };
  }, []);
  const close = () => { if (!busy) { csv.current = ''; onClose(); } };
  const template = () => {
    const role = settings.roles.find(r => r.name === 'Team Member')?.name || settings.roles[0]?.name || '';
    const subteam = settings.departments[0]?.name || '';
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const text = `${MEMBER_CSV_COLUMNS.join(',')}\r\n${['Jane', 'Doe', 'jdoe', 'ChangeMe123!', role, subteam].map(quote).join(',')}\r\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'cardinals-nest-members-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const preview = async (file?: File) => {
    csv.current = ''; setReport(null); setComplete(false); setError('');
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { setError('Choose a CSV file of 256 KB or smaller.'); return; }
    setBusy('preview');
    try {
      csv.current = await file.text();
      setReport(await api.users.previewImport(csv.current));
    } catch {
      csv.current = ''; setError('Could not validate the file. Check your connection and upload it again.');
    } finally { setBusy(null); }
  };
  const commit = async () => {
    if (busy || complete || !csv.current || !ready) return;
    setBusy('import'); setError('');
    try {
      const result = await api.users.commitImport(csv.current, rows.filter(r => r.status === 'ready').map(r => r.row));
      setReport(result); setComplete(true);
      await onImported();
    } catch {
      // A network interruption can happen after creation. Never blindly retry the batch.
      setReport(null);
      setError('The request did not finish. Some members may have been created. Upload the CSV again to recheck existing usernames before retrying.');
      await onImported().catch(() => {});
    } finally { csv.current = ''; setBusy(null); }
  };
  const rows = report?.rows || [];
  const ready = rows.filter(r => r.status === 'ready').length;
  const invalid = rows.filter(r => r.errors.length).length;
  const created = rows.filter(r => r.status === 'created').length;
  const existing = rows.filter(r => r.existingUsername).length;
  const button = 'px-4 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-600 disabled:opacity-50';
  return <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-3 md:p-6">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="member-import-title"
      onKeyDown={e => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
          const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
          if (!nodes?.length) { e.preventDefault(); return; }
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }}
      className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-5 md:p-8 shadow-2xl border-t-4 border-teamColor">
      <div className="flex justify-between items-start gap-4">
        <h2 id="member-import-title" className="text-2xl font-black">{complete ? 'Import complete' : 'Import Members'}</h2>
        <button className={button} disabled={!!busy} onClick={close} aria-label="Close member import">Close</button>
      </div>
      <p className="mt-3 text-sm">Download Template / Upload CSV → Preview &amp; Validate → Import</p>
      <p className="mt-2 text-sm">All six columns are required. Use semicolons for multiple roles or subteams, such as Team Captain;Team Member. Usernames are saved in lowercase. Initial passwords need at least 8 characters.</p>
      <p className="mt-2 text-sm">Up to {MAX_IMPORT_ROWS} members per file. Existing accounts are skipped. Passwords are never shown in the preview; uploaded files are not stored.</p>
      <details className="my-3 text-sm"><summary className="cursor-pointer font-bold">Configured roles and subteams</summary>
        <p>Roles: {settings.roles.map(r => r.name).join('; ') || 'None configured'}</p>
        <p>Subteams: {settings.departments.map(d => d.name).join('; ') || 'None configured'}</p>
      </details>
      <div className="flex flex-wrap items-center gap-3 my-4">
        <button className={button} onClick={template} disabled={!!busy}>Download CSV Template</button>
        <label className="text-sm font-bold">Upload CSV
          <input className="block mt-2 max-w-full" type="file" accept=".csv,text/csv" disabled={!!busy}
            onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void preview(file); }} />
        </label>
      </div>
      {busy && <p role="status">{busy === 'preview' ? 'Validating CSV…' : 'Importing members… Please keep this window open.'}</p>}
      {error && <p role="alert" className="text-red-600 dark:text-red-300 my-3">{error}</p>}
      {!!report?.errors.length && <div role="alert" className="text-red-600 dark:text-red-300">{report.errors.map(e => <p key={e}>{e}</p>)}</div>}
      {rows.length > 0 && <>
        <p role="status" className="font-bold my-4">{complete ? `${created} members created · ${rows.length - created} skipped` : `${rows.length} total rows · ${ready} ready to import · ${invalid} rows with errors`} · {existing} existing usernames</p>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-600 rounded-xl">
          <table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-900"><tr>{['Row', 'Name', 'Username', 'Roles', 'Subteams', 'Status'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.row} className="border-t border-slate-200 dark:border-slate-600">
              <td className="p-3">{row.row}</td><td className="p-3 break-words">{row.name || '—'}</td><td className="p-3 break-all">{row.username || '—'}</td><td className="p-3">{row.roles.join('; ')}</td><td className="p-3">{row.subteams.join('; ')}</td>
              <td className="p-3 min-w-40">{row.errors.length ? <span className="text-red-600 dark:text-red-300">✕ {row.errors.join('; ')}</span> : <span className="text-green-700 dark:text-green-300">✓ {row.status === 'created' ? 'Created' : 'Ready'}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      {!complete && <button className={`${button} mt-5 bg-teamColor text-white`} disabled={!!busy || !ready || !!report?.errors.length} onClick={commit}>Import Members{ready ? ` (${ready})` : ''}</button>}
    </div>
  </div>;
}
