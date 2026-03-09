# APEX Platform — Security Findings Report

**Date:** 2026-03-06
**Assessors:** Principal AppSec Engineer / Senior Full-Stack Engineer / DB Security Specialist
**Scope:** Full-stack SPA (React + Vite) + Supabase (PostgreSQL, Auth, Storage, Edge Functions)
**Standard:** OWASP ASVS 4.0

---

## Executive Summary

| Severity | Count | Fixed | Requires Infra/Manual Action |
|----------|-------|-------|------------------------------|
| Critical | 4     | 2     | 2 (credential rotation)       |
| High     | 5     | 4     | 1 (signed URLs)               |
| Medium   | 6     | 4     | 2 (headers, MFA)              |
| Low      | 4     | 1     | 3 (CSP, bundle, CAPTCHA)      |

---

## CRITICAL

### C-1 — Exposed Service Role Key in Git History
**File:** `admin.js` (deleted from working tree, `.gitignore`d)
**ASVS:** 2.10.4, 6.4.1
**Exploit Scenario:** The file `admin.js` contains a hardcoded `SUPABASE_SERVICE_ROLE_KEY` that bypasses all RLS policies. If an attacker retrieves it from git history (`git log --all`, GitHub search, or a leaked clone), they gain unrestricted read/write access to the entire database — including all user PII, policy documents, attestations, and the ability to escalate any account to admin.
**Impact:** Full database compromise. Complete data exfiltration. Privilege escalation to any account.
**Fix Status:** ⚠️ MANUAL ACTION REQUIRED
**Required Action:**
1. Rotate `service_role` key immediately: Supabase Dashboard → Project Settings → API → Regenerate service_role key.
2. Rotate `anon` key as well (also visible in git history).
3. Remove `admin.js` from all git history using BFG Repo-Cleaner or `git filter-repo --invert-paths --path admin.js`.
4. If repo is pushed to a remote (GitHub, GitLab, etc.), force-push the cleaned history, then invalidate all clones.
5. Search for any deployed config that references the old keys and update.
**Verification:** Run `git log --all -p -- admin.js | grep SERVICE_ROLE` — should return nothing after cleanup.

---

### C-2 — Anon Key in Git History
**File:** `.env` (`.gitignore`d after initial commit)
**ASVS:** 2.10.4, 6.4.1
**Exploit Scenario:** The anon key is visible in git history. While the anon key is intended to be public, its presence in git allows automated scrapers to discover the Supabase project URL and anon key. Combined with any RLS misconfiguration, this is the first step in data access attacks.
**Impact:** Medium on its own; high amplifier for RLS gaps.
**Fix Status:** ⚠️ MANUAL ACTION REQUIRED
**Required Action:** Rotate anon key (same step as C-1). After rotation, update `.env` and all deployment secrets.

---

### C-3 — Dashboard Routes Lacked Authentication Guard ✅ FIXED
**File:** `src/App.tsx` (before fix)
**ASVS:** 4.1.1, 4.1.3
**Exploit Scenario:** Any unauthenticated user who knew a route (e.g. `/dashboard/policies`, `/dashboard/tasks`) could navigate directly to it. React Router rendered the page; each page component then issued Supabase queries that RLS would block, but the page structure, navigation, and any client-side state would still be rendered.
**Impact:** UI information leakage; routes that render without auth checks could expose layout/structure or race-condition data.
**Fix Applied:** Created `src/components/auth/ProtectedRoute.tsx` which checks `supabase.auth.getSession()`, subscribes to `onAuthStateChange`, and redirects to `/auth` with `replace: true` if no session. All 14 `/dashboard/*` routes in `App.tsx` now wrapped with `<ProtectedRoute>`.
**Verification:** Navigate to `/dashboard` with no session → redirected to `/auth`.

---

### C-4 — JWT Verified by Signature-less Decode in Chat Edge Function ✅ FIXED
**File:** `supabase/functions/chat/index.ts` (before fix)
**ASVS:** 3.5.2, 3.5.3
**Exploit Scenario:** The previous implementation decoded the JWT payload using `atob()` (base64) without cryptographic signature verification. An attacker could craft a JWT with a valid-looking payload (role=`authenticated`, a real user's `sub`) and pass it as the Bearer token. The Supabase API gateway validates the `apikey` header but not the user Bearer token. The forged token would pass all checks, allowing the attacker to impersonate any user and access their tasks, policies, and profile data through the AI assistant.
**Impact:** Data exfiltration of all other users' tasks and policies via the chat endpoint.
**Fix Applied:** Replaced `decodeJWT()` with `supabase.auth.getUser(token)` which calls the Supabase Auth service, verifies the HMAC-SHA256 signature, expiry, and revocation status.
**Verification:** Send a hand-crafted JWT with a forged `sub` → should receive `401 Invalid or expired session`.

---

## HIGH

### H-1 — audit_logs INSERT Policy Allows Audit Forgery ✅ FIXED
**File:** `supabase/migrations/20251001195055_*.sql` (original), `20260306000000_security_hardening.sql` (fix)
**ASVS:** 7.2.1, 7.2.2
**Exploit Scenario:** The original policy `WITH CHECK (true)` allowed any authenticated user to insert an audit log row with any `user_id`. An attacker could:
- Frame another user by inserting logs showing them performing unauthorized actions
- Pollute the audit trail to obscure real malicious activity
**Impact:** Audit trail integrity compromised; forensic investigation would be unreliable.
**Fix Applied:** Migration `20260306000000` drops the old policy and creates `"Users can insert own audit logs"` with `WITH CHECK (user_id = auth.uid() OR user_id IS NULL)`.
**Verification:** Attempt `INSERT INTO audit_logs (user_id, ...) VALUES ('<another_user_uuid>', ...)` as a different user → should be rejected by RLS.

---

### H-2 — Policy Documents Served via Public (Unauthentic) URLs
**File:** `src/utils/uploadPolicyDocuments.ts`, `supabase/functions/upload-sample-policies/index.ts`
**ASVS:** 12.5.2, 4.1.3
**Exploit Scenario:** Both utilities call `supabase.storage.from('policy-documents').getPublicUrl(...)` and store the resulting URL in `policy_versions.file_url`. The `policy-documents` bucket is created with `public: false`, meaning the Supabase CDN rejects unauthenticated requests. However, the stored URL uses the `/object/public/` path pattern. If the bucket is ever inadvertently set to public (a single dashboard click), all policy documents become permanently accessible without authentication to anyone with the URL.
**Impact:** Disclosure of sensitive government policy documents; the stored URL never expires.
**Fix Status:** ⚠️ MANUAL ACTION REQUIRED
**Required Action:**
1. Change all calls to `getPublicUrl()` to use `createSignedUrl()` with a short TTL (e.g. 3600 seconds) — generate at view time in the component, not stored in the DB.
2. Verify the `policy-documents` bucket is set to `public: false` in Supabase Dashboard → Storage.
3. Update `policy_versions.file_url` column meaning: either store only the `storage_path` (not a full URL), or rename to `storage_path` and generate signed URLs at render time.

---

### H-3 — Sign-Up Error Messages Enable Account Enumeration ✅ FIXED
**File:** `src/pages/Auth.tsx` (before fix)
**ASVS:** 2.5.6, 2.6.3
**Exploit Scenario:** The original code propagated the raw Supabase error message directly to the user toast (e.g. `"User already registered"`) revealing whether a given email address is associated with an account.
**Impact:** Allows targeted phishing; enumeration of all registered government employee accounts.
**Fix Applied:** The catch block now maps all sign-up errors to generic messages. "Password does not meet requirements" is the only specific variant (reveals no PII).
**Verification:** Attempt sign-up with an existing email → generic message displayed, not "User already registered".

---

### H-4 — ppdu_briefs UPDATE Policy Missing WITH CHECK ✅ FIXED
**File:** Migration `20260206000000_create_ppdu_briefs_table.sql` (original), `20260306000000_security_hardening.sql` (fix)
**ASVS:** 4.2.1
**Exploit Scenario:** The UPDATE RLS policy had `USING (auth.uid() = created_by OR auth.uid() = updated_by)` but no `WITH CHECK`. Without WITH CHECK, PostgreSQL copies USING to WITH CHECK automatically, which is fine, but an edge case exists: a user who is the `updated_by` on a brief they did not create could theoretically change the `created_by` field to themselves in a single UPDATE, becoming the owner.
**Impact:** Ownership hijacking of shared PPDU briefs; a less-privileged user could gain effective ownership.
**Fix Applied:** Migration `20260306000000` adds explicit `WITH CHECK` matching the USING condition.
**Verification:** As user B (only `updated_by`), attempt `UPDATE ppdu_briefs SET created_by = auth.uid()` → rejected.

---

### H-5 — OpenAI Raw Error Body Returned to Client ✅ FIXED
**File:** `supabase/functions/chat/index.ts` (before fix)
**ASVS:** 7.4.1
**Exploit Scenario:** When OpenAI returned non-2xx responses, the full error body (including model quotas, account identifiers, internal error codes) was forwarded directly to the browser client via `{ error: "OpenAI error 500", detail: <raw body> }`.
**Impact:** Reveals AI service configuration, billing identifiers, or error codes that could aid reconnaissance.
**Fix Applied:** Raw error body is now logged server-side only. Client receives a generic `"AI service temporarily unavailable"` message.
**Verification:** Trigger an OpenAI error (e.g. invalid key) → client sees generic message; `detail` field absent.

---

## MEDIUM

### M-1 — No HTTP Security Headers
**File:** `vite.config.ts`, hosting layer
**ASVS:** 14.4.1–14.4.6
**Exploit Scenario:** Without security headers, the application is vulnerable to:
- Clickjacking (`X-Frame-Options` / `frame-ancestors` absent)
- MIME sniffing attacks (`X-Content-Type-Options` absent)
- Protocol downgrade (`Strict-Transport-Security` absent)
- Data leakage via `Referer` header (`Referrer-Policy` absent)
**Fix Status:** ⚠️ REQUIRES HOSTING CONFIG
**Required Action:** Apply the following headers at the reverse proxy / CDN layer (Apache, nginx, or Azure Front Door serving `dev.ppdu.int.gov.ab.ca`):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com; font-src 'self'; frame-ancestors 'none'
```

Note: `'unsafe-inline'` for scripts can be tightened with nonces once the build pipeline supports it. Start with the above and iterate.

---

### M-2 — `loca.lt` Tunnel Allowed in Vite Config
**File:** `vite.config.ts`
**ASVS:** 14.2.1
**Exploit Scenario:** `allowedHosts: [".loca.lt"]` permits any `.loca.lt` subdomain to act as a Vite dev server host. If left in a staging/production build, a compromised DNS entry or a SSRF attack could route traffic through an attacker-controlled tunnel.
**Fix Status:** ⚠️ REVIEW BEFORE PRODUCTION BUILD
**Required Action:** Remove `.loca.lt` from `allowedHosts` in `vite.config.ts` before building for staging or production. Keep only for local dev tunnelling sessions.

---

### M-3 — ChatBot Exposes Internal Error Details in Non-Dev Mode ✅ FIXED
**File:** `src/components/chat/ChatBot.tsx` (before fix)
**ASVS:** 7.4.1
**Fix Applied:** Added `import.meta.env.DEV` guard so detailed errors only appear in development builds.

---

### M-4 — No Rate Limiting on Auth Endpoints (Client-Side Only)
**File:** `src/pages/Auth.tsx`
**ASVS:** 2.2.1, 2.2.2
**Exploit Scenario:** The sign-in, sign-up, and password reset forms have no client-side rate limiting or CAPTCHA. An attacker can script unlimited attempts. Supabase Auth has a built-in 60-req/hour limit, but this may be too permissive for a government application handling sensitive PII.
**Fix Status:** ⚠️ MANUAL ACTION REQUIRED — SUPABASE DASHBOARD
**Required Action:**
1. Supabase Dashboard → Authentication → Rate Limits: Lower the email send limit to 5/hour per IP.
2. Consider adding Cloudflare Turnstile or hCaptcha (Supabase has native Captcha support under Auth → Settings → Enable CAPTCHA protection).
3. Enable "Protect sign-ups" (email allowlist / domain restriction if employees use government email `@gov.ab.ca`).

---

### M-5 — No MFA Enforcement for Privileged Operations
**File:** All admin routes, `src/components/auth/AdminRoute.tsx`
**ASVS:** 2.8.1, 2.8.6
**Exploit Scenario:** Admin and publisher accounts are protected by password only. If an admin's email/password is compromised (phishing, credential stuffing), an attacker gains full platform access.
**Fix Status:** ⚠️ MANUAL ACTION REQUIRED — SUPABASE DASHBOARD
**Required Action:**
1. Supabase Dashboard → Authentication → Multi-Factor Authentication → Enable TOTP.
2. Enforce MFA at the application level for all `role = 'admin'` logins by checking `session.user.factors` in `AdminRoute.tsx`.
3. For high-value actions (bulk user create/delete, policy publish), re-authenticate with `supabase.auth.reauthenticate()`.

---

### M-6 — task_checklist_items UPDATE Without Explicit WITH CHECK ✅ FIXED
**File:** Migration `20260225090000` (original), `20260306000000` (fix)
**Fix Applied:** Added matching `WITH CHECK` clause.

---

## LOW

### L-1 — Content-Security-Policy Not Configured
**ASVS:** 14.4.3
**Description:** No CSP header is set. While `unsafe-inline` is currently needed for TailwindCSS-in-JS styles, a strict CSP should be a milestone goal.
**Recommendation:** See M-1 for initial CSP. Migrate to nonce-based CSP once Vite build pipeline supports it.

---

### L-2 — Bundle Size (~2.6 MB) Creates DoS Surface
**ASVS:** 12.1.1
**Description:** The monolithic JS bundle delays Time-to-Interactive and is expensive to re-download after any change.
**Recommendation:** Configure Vite `build.rollupOptions.output.manualChunks` to split vendor, PDF, and chart libraries. Target < 500 KB initial chunk.

---

### L-3 — No Bot Protection on Registration/Reset
**ASVS:** 2.6.2
**Description:** See M-4. CAPTCHA not configured.
**Recommendation:** Enable Supabase CAPTCHA integration with Cloudflare Turnstile.

---

### L-4 — Attestation Lacks Cryptographic Non-Repudiation
**ASVS:** 10.3.2
**Description:** Attestations are recorded as a database timestamp with `ip_address` and `user_agent`. There is no cryptographic proof that the user signed the document (e.g. HMAC over policy_version_id + user_id + timestamp using a server secret).
**Recommendation:** When recording an attestation, compute `HMAC-SHA256(service_role_secret, policy_version_id || user_id || signed_at)` and store it. The `audit_logs` table should record each attestation with this signature for forensic purposes.

---

## Supabase Settings Runbook

Apply the following settings in the Supabase Dashboard for `vxuwpajjbblsyhocnzxd`:

### Authentication → General
| Setting | Recommended Value |
|---------|-------------------|
| Site URL | `https://dev.ppdu.int.gov.ab.ca` |
| Additional redirect URLs | `https://dev.ppdu.int.gov.ab.ca/auth` |
| Minimum password length | `8` |
| Password strength | `Strong` (zxcvbn score 3+) |
| Enable email confirmations | `ON` |
| Secure email change | `ON` (require confirmation on both old & new email) |

### Authentication → Rate Limits
| Limit | Recommended Value |
|-------|-------------------|
| Email send rate limit | `5 per hour` |
| SMS rate limit | `N/A` |
| Token refresh rate limit | `360 per hour` |

### Authentication → CAPTCHA
| Setting | Value |
|---------|-------|
| Enable CAPTCHA | `ON` |
| CAPTCHA provider | Cloudflare Turnstile |

### Authentication → MFA
| Setting | Value |
|---------|-------|
| Enable TOTP | `ON` |
| Enforce MFA for admin role | Implement in AdminRoute.tsx via `session.user.factors` check |

### Storage
| Bucket | Public | Max file size | Allowed MIME types |
|--------|--------|---------------|--------------------|
| `policy-documents` | `OFF` | `50 MB` | `application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `task-attachments` | `OFF` | `20 MB` | `image/*,application/pdf,text/*` |

### API
- Rotate **anon** key → update all deployment secrets + `.env`
- Rotate **service_role** key → update all edge function secrets
- Enable **JWT expiry** of `3600` seconds (1 hour)

---

*Report version 1.0 — 2026-03-06*
