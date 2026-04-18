# Intellectual Property Policy

Version 1.0.0 — Effective 2026-04-18

African Data Layer respects intellectual-property rights and expects users to do the same. This document describes how to file and resolve IP-infringement notices.

## 1. Designated contact
- Email: legal@africandatalayer.com
- Web form: Settings → Legal → Report IP Infringement (`/api/privacy?view=ip-report`)
- Postal: African Data Layer, Bonamoussadi, Douala, Cameroon

## 2. Filing a notice
A complete notice must include:
1. Reporter's full name and email.
2. Target kind (`submission`, `point`, or `other`) and a reference (submission ID, point ID, or URL) when available.
3. A description of the infringement (minimum 20 characters) identifying the protected work and the alleged unauthorised use.
4. A sworn statement, under penalty of perjury, that the information is accurate and that the reporter is the rights holder or authorised to act on their behalf.
5. A signature (typed full name).

Submitting knowingly false notices may create legal liability for the reporter.

## 3. Triage and response
- Reports are queued in the admin IP Reports tab.
- Status flow: `open` → `reviewing` → `resolved` or `rejected`.
- Initial response: within 10 business days.
- Confirmed infringements result in content takedown, scrubbing of the offending submission(s), and a written notice to the uploader.

## 4. Counter-notice
A user whose content was removed may submit a counter-notice by email (legal@africandatalayer.com) including the original report reference, an explanation of why the takedown was incorrect, and a sworn statement. We restore content if the original reporter does not pursue further action within 14 days.

## 5. Repeat infringers
Accounts with two confirmed infringements within 12 months are suspended. A third confirmed infringement results in permanent termination and forfeiture of pending rewards.

## 6. Audit trail
Each report and admin action is recorded in `security_audit_log` (`ip_report_filed`, `ip_report_updated`) and retained for 24 months.
