# Import team members

Coaches and Team Captains can open **Team → Import Members**. Download the CSV template, fill it in, and upload it. Review every row before clicking **Import Members**. Only rows marked Ready in the preview are eligible; the server validates them again before creation. The member list refreshes after import.

```csv
First Name,Last Name,Username,Initial Password,Roles,Subteams
Avery,Smith,asmith,ChangeMe123!,Team Member,Mechanical
Jordan,Lee,jlee,ChangeMe123!,"Team Captain;Team Member","Software;Mechanical"
```

- UTF-8 comma-separated CSV, optionally with a BOM; LF or CRLF line endings.
- All six named columns and all six values are required. Columns can be reordered; additional columns are ignored. Header names are case-sensitive with surrounding whitespace ignored.
- Quoted fields, escaped double quotes and embedded newlines are supported. Blank lines are ignored. Broken quoting rejects the file; mismatched column counts reject the affected rows.
- Separate multiple roles/subteams with semicolons. Matching ignores case and surrounding whitespace; configured spelling is saved. The importer lists the current configured names.
- Usernames are trimmed/lowercased. Existing accounts (including archived ones) and every occurrence of a duplicate CSV username are skipped, never updated.
- Initial passwords are trimmed and must have at least eight characters, matching manual account creation's minimum. Use a unique temporary password per person; the template is only an example.
- Limit: 100 members and 256 KB per file. Split larger rosters into batches.
- First/last names combine into the existing `name`; subteams map to `departments`. No schema changes.
- Preview and commit require the same Coach/Team Captain server guard as manual creation. Passwords go through the shared creation helper and existing bcrypt hashing (10 rounds).
- Uploaded files are never stored. Passwords are absent from reports and errors, and the browser clears its CSV reference after import or modal closure. Nothing is written to browser storage.
- Each member is created independently. A failed row does not undo successful rows. If a connection drops, upload again to re-preview: already-created usernames will be skipped. Concurrent duplicate inserts are protected by PostgreSQL's existing unique username constraint.

## Validation

`npx tsx server/memberImport.test.ts` covers valid and multi-member files, multiple roles/subteams, canonical names, duplicate/existing usernames, invalid configuration, quoted values, missing columns/values, malformed/empty files, BOM, limits, preview without writes, authentication/authorization, bcrypt verification, partial failures, retries, changed settings, and exclusion of rows not ready in preview. Tests use in-memory storage and never a real database.

`npm run build` checks the production bundle. Local Chrome UI verification used an in-memory fixture for preview → import → results → refreshed members, including desktop and 390px mobile rendering. The extension's file-picker upload was blocked by its file-URL permission, so the fixture exercised the same input change handler with a test File. Real OS file selection remains a manual smoke check.
