# Testing report

## What was checked while building

| Check | Result |
|---|---|
| Frontend bundle (esbuild, all 60+ modules, every local import/export resolved, JSX compiled) | ✅ Passed with no errors or warnings |
| Chart colour palette (colour-vision-deficiency separation, chroma, lightness) | ✅ Passed validator; gold series is backed by legends + tooltips |
| Backend C# compile | ⚠️ **Not run** — the .NET SDK was not available in the build environment. The code was reviewed by hand; run `dotnet build` first and report any error. |
| npm install / `vite build` | ⚠️ **Not run** — package downloads were blocked in the build environment. Run `npm install && npm run build`. |
| Live API + MySQL end-to-end | ⚠️ **Not run** — needs your local MySQL. Use the checklist below. |

## Manual end-to-end checklist

Run backend + frontend, then tick each item.

### Authentication & roles
- [ ] Registry: in Development the 200 demo records load on first start; Check file on the demo CSV again → 0 new, 200 unchanged, 0 problems
- [ ] Registry: CSV with a missing column → clear message naming the column; a bad row → listed with its line number, others still import
- [ ] Sign-up with a wrong NID or date of birth → "could not find a pension record", no details revealed
- [ ] Sign-up with matching details → record preview → finish → active dashboard, no approval banner
- [ ] Second sign-up with the same record → "an account already exists"
- [ ] Deactivated record → cannot be used to sign up
- [ ] Registry edit of a claimed record's monthly amount → pensioner's amount changes and they get a notification
- [ ] Wrong password 5× → account locked message (423)
- [ ] Pensioner opening `/admin/dashboard` → redirected to `/app/dashboard`
- [ ] Admin (non-super) cannot see **Admin users**; `PUT /api/admin/settings` returns 403

### Pensioner portal
- [ ] Language switch (top bar) changes all labels to Bangla and back; persists after refresh
- [ ] Text size A / A+ / A++ and "Reduce motion" work and persist
- [ ] Sidebar collapses on desktop; becomes a drawer on mobile (< 1024 px)
- [ ] Top-bar search jumps to pages; keyboard ↑/↓/Enter work
- [ ] Bank: add account → shows masked number + Pending; 4th account blocked; remove works
- [ ] Nominees: total share cannot exceed 100% (client + server); edit keeps NID when left empty
- [ ] AI face: models load (spinner, then camera with a green box); "No face", "More than one face" and "Come closer" hints appear correctly
- [ ] AI face: enrol (blink or head-turn challenge) → "Face enrolled and verified", valid-until set
- [ ] AI face: same person again → "Face matched", distance below limit; a different person → "Face did not match", record shown as AI failed
- [ ] AI face: challenge not done within 20 s → timeout message, nothing saved
- [ ] Admin: Life verification list shows method + distance; Pensioner detail → Reset face enrolment → next check enrols again
- [ ] Manual fallback: Send a photo instead → camera capture → submit; upload rejects > 5 MB
- [ ] Withdrawal "New" button disabled with clear reasons until eligible
- [ ] When eligible: amount outside min/max rejected; review step shows balance after; confirm creates request
- [ ] Withdrawal detail timeline updates as admin reviews/approves/marks paid; cancel works only while Pending
- [ ] Payment history filters (status, year, search) and sorting; transactions tab date filters
- [ ] Statement: date range, totals, PDF downloads and opens
- [ ] Notifications: unread badge in bell + sidebar; mark one / all read; delete
- [ ] Assistant (floating + page): "What is my balance?", "কবে টাকা তুলতে পারব?" return real data with action links
- [ ] Support: submit complaint; admin response appears
- [ ] Profile: update phone/address; change password (wrong current password shows field error)

### Admin portal
- [ ] Dashboard cards link to the correct pages; analytics monthly/yearly toggle; donuts show data
- [ ] Pensioners: search (also from top bar), filter by status/type, sort by name/amount/balance, detail tabs
- [ ] Suspend → pensioner sees banner and cannot withdraw; reactivate
- [ ] Bank verification: verify / reject with reason
- [ ] Payments: generate for a month (no duplicates on repeat); process one / all; pensioner without valid life verification → Failed with reason; retry
- [ ] Withdrawals: review → approve (balance debited, ledger entry) → mark transferred with reference; reject needs reason
- [ ] Life verifications: photo loads (authorized), approve sets validity per settings
- [ ] Reports: summary for range; PDF and CSV download
- [ ] Audit logs: every action above is listed; filter by action/date/search
- [ ] Settings (super admin): invalid values (e.g. MaxWithdrawalsPerMonth = 0) rejected

### Accessibility
- [ ] Tab through the whole app; focus ring visible; "Skip to content" link appears
- [ ] Modals trap focus and close with Esc; focus returns to the trigger
- [ ] Tables become stacked cards on phones with labels

## Completed improvements (summary)
- Full design system (tokens, typography, components) in the requested palette
- Pensioner portal: 13 pages; Admin portal: 15 pages; all connected to real endpoints
- Loading skeletons, empty and error states, toasts, confirmation and reason dialogs everywhere
- Bangla/English, font-size control, reduced-motion, keyboard and screen-reader support
- Server-side validation, role policies, audit logging, secure uploads, masked sensitive data, PDF/CSV export
