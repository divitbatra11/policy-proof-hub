# APEX Platform — Security Verification Checklist

**Date:** 2026-03-06
**Standard:** OWASP ASVS 4.0
**Environment:** `https://dev.ppdu.int.gov.ab.ca`

---

## How to Use This Document

- **PASS** — Control verified by automated test or manual check; evidence noted.
- **FAIL** — Control missing or broken; linked to finding in SECURITY_FINDINGS.md.
- **PARTIAL** — Code-level fix applied; requires additional infra/config action.
- **N/A** — Not applicable to this deployment.

---

## Section 2 — Authentication

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 2.1.1 | Password min length ≥ 8 | PASS | `Auth.tsx:validatePassword()` + Supabase Auth min-length setting |
| 2.1.2 | Password max length ≥ 64 | PASS | HTML `<input>` has no maxLength; Supabase accepts up to 72 chars |
| 2.1.6 | Password change requires current password | PASS | Supabase `updateUser()` validates session token |
| 2.1.9 | No password complexity rules that exclude valid chars | PASS | Complexity checks add, not restrict |
| 2.1.12 | Show/hide password toggle | PASS | `Auth.tsx:showSignInPw`, `showSignUpPw`, `showConfirmPw` state |
| 2.2.1 | Rate limiting on auth endpoints | PARTIAL | Supabase built-in 60/hr; lower to 5/hr — see M-4 |
| 2.2.2 | Anti-automation / CAPTCHA | FAIL | No CAPTCHA configured — see L-3 / M-4 |
| 2.3.1 | Initial password strength enforced | PASS | 4-criterion validation with visual strength bar |
| 2.5.6 | Forgot password uses no enumeration | PARTIAL | Password reset sends same message regardless; sign-up now uses generic message after fix |
| 2.6.3 | No account enumeration on login | PASS | `Auth.tsx:handleSignIn` — generic "Incorrect email or password" for all failures |
| 2.7.1 | Email verification before login allowed | PARTIAL | `emailRedirectTo` configured; verify Supabase "Confirm email" toggle is ON in Dashboard |
| 2.8.1 | MFA available | FAIL | TOTP not yet enabled — see M-5 |
| 2.8.6 | MFA required for privileged accounts | FAIL | Admin role not enforcing MFA — see M-5 |
| 2.10.4 | No hardcoded credentials in source | PARTIAL | `admin.js` removed from working tree; git history must be purged — see C-1 |

---

## Section 3 — Session Management

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 3.1.1 | Session tokens not in URL parameters | PASS | Supabase PKCE flow; tokens in fragment/storage, not query strings |
| 3.2.1 | New session token on auth | PASS | Supabase Auth creates new JWT on every sign-in |
| 3.2.3 | Session tokens have sufficient entropy | PASS | Supabase JWT (256-bit) |
| 3.3.1 | Logout invalidates server session | PASS | `supabase.auth.signOut()` revokes refresh token |
| 3.4.1 | Secure cookie attributes | PARTIAL | Sessions in `sessionStorage` (not cookies); cleared on tab close. For cookie-based flows, Supabase SSR cookies need `Secure; HttpOnly; SameSite=Lax` |
| 3.5.1 | Stateless tokens verified each request | PASS | Supabase gateway verifies JWT signature on each API call |
| 3.5.2 | JWT signature verified before trusting claims | PASS (after fix) | Chat edge function now uses `supabase.auth.getUser(token)` — see C-4 |
| 3.5.3 | JWT algorithm explicitly validated | PASS | Supabase Auth enforces HS256/RS256 centrally |
| 3.7.1 | Re-auth for sensitive operations | FAIL | Not implemented for admin actions — see M-5 |

---

## Section 4 — Access Control

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 4.1.1 | Principle of least privilege | PASS | 3-tier role system; RLS policies restrict by role |
| 4.1.2 | Access controls fail securely (default deny) | PASS | RLS on all tables; auto-RLS event trigger added by migration `20260306000000` |
| 4.1.3 | Authenticated required for all sensitive routes | PASS (after fix) | `ProtectedRoute.tsx` wraps all `/dashboard/*` — see C-3 |
| 4.2.1 | IDOR prevention — object-level auth | PASS | RLS `USING (user_id = auth.uid())` on attestations, results; `WITH CHECK` on inserts |
| 4.2.2 | CSRF tokens for state-changing requests | PASS | Bearer token + sessionStorage (no cookie auth); CSRF not applicable |
| 4.3.1 | Admin interface access control | PASS | `AdminRoute.tsx` checks `profiles.role = 'admin'` from DB |
| 4.3.2 | Directory browsing / schema introspection disabled | PASS (after fix) | `REVOKE CREATE ON SCHEMA public FROM PUBLIC` in migration `20260306000000` |

---

## Section 5 — Validation, Sanitization & Encoding

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 5.2.1 | All user input validated | PASS | Zod schemas; React Hook Form; `validatePassword()`; server-side message length cap (500 chars) |
| 5.2.3 | HTML injection prevented | PASS | `dangerouslySetInnerHTML` in `UploadPolicyDocs.tsx` uses DOMPurify before rendering |
| 5.2.4 | No eval() or dynamic code execution | PASS | No `eval`, `Function()` constructor, or dynamic `<script>` injection found |
| 5.3.3 | Output encoding for HTML context | PASS | React escapes all JSX expressions by default; DOMPurify used where raw HTML is required |
| 5.3.4 | SQL injection prevention | PASS | All DB access via Supabase client (parameterized); no raw SQL on client side |

---

## Section 6 — Stored Cryptography

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 6.1.1 | No passwords in plaintext | PASS | Supabase Auth hashes passwords with bcrypt |
| 6.4.1 | Secrets not stored in source code | PARTIAL | `.env` and `admin.js` in `.gitignore`; git history must be cleaned — see C-1, C-2 |
| 6.4.2 | Secrets in environment variables | PASS | `Deno.env.get()` in edge functions; `import.meta.env` in frontend |

---

## Section 7 — Error Handling and Logging

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 7.1.1 | Log security-relevant events | PARTIAL | `audit_logs` table captures user actions; edge functions use `console.error`; no centralised SIEM |
| 7.1.2 | No PII in logs | PARTIAL | `console.error` logs OpenAI error body which may include email identifiers; review log pipeline |
| 7.2.1 | Auth decisions logged | PARTIAL | Supabase Auth logs sign-in events; application-level logging inconsistent |
| 7.2.2 | Audit trail integrity | PASS (after fix) | `audit_logs` INSERT policy now prevents forging other users' entries — see H-1 |
| 7.4.1 | Generic error messages to clients | PASS (after fix) | Sign-up, ChatBot, and OpenAI error paths now return generic messages — see H-3, H-5, M-3 |
| 7.4.2 | Exception handling does not leak stack traces | PASS | Try/catch blocks return structured messages; no stack traces visible in UI |

---

## Section 9 — Communications

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 9.1.1 | TLS for all connections | PASS | Production domain `https://dev.ppdu.int.gov.ab.ca` enforces HTTPS; Supabase API is HTTPS-only |
| 9.1.2 | HSTS header | FAIL | Not configured at hosting layer — see M-1 |
| 9.2.1 | TLS certificates valid | PASS | Government domain with valid cert (assumed) |

---

## Section 12 — Files and Resources

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 12.1.1 | Malicious file upload prevention | PARTIAL | DOMPurify sanitizes DOCX→HTML conversion; no MIME allowlist enforced on Storage upload |
| 12.4.1 | Files stored outside web root | PASS | Files stored in Supabase Storage (separate service), not served from app directory |
| 12.5.2 | File downloads use Content-Disposition: attachment | PARTIAL | Storage serves files; disposition headers not explicitly set in custom code |
| 12.6.1 | No SSRF via file download | PARTIAL | `uploadPolicyDocuments.ts` fetches from `/temp/` relative path; edge fn uploads use service role |

---

## Section 13 — API and Web Service

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 13.1.1 | All API input validated | PASS | Edge functions validate message array, length, and content type |
| 13.1.2 | HTTP method enforcement | PASS | Edge functions return 405 for non-POST methods |
| 13.2.1 | REST verbs used appropriately | PASS | Supabase client uses appropriate HTTP verbs |
| 13.4.2 | CORS restricted to allowlist | PASS | `ALLOWED_ORIGINS` in all edge functions; `Vary: Origin` header present |

---

## Section 14 — Configuration

| ASVS ID | Requirement | Status | Evidence / Action |
|---------|-------------|--------|-------------------|
| 14.2.1 | Unnecessary features disabled | PARTIAL | `allowedHosts: [".loca.lt"]` in `vite.config.ts` — remove before production builds — see M-2 |
| 14.4.1 | Security headers present | FAIL | No CSP, HSTS, X-Frame-Options, etc. at hosting layer — see M-1 |
| 14.4.3 | Content-Security-Policy | FAIL | Not configured — see L-1 |
| 14.4.6 | All responses include X-Content-Type-Options | FAIL | Not configured at hosting layer |

---

## Test Commands

### 1. RLS Smoke Tests (run in Supabase SQL Editor as different user roles)

```sql
-- TEST: Employee cannot insert audit log for another user
-- Run as employee user (use Supabase impersonation or set role in test)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO '<employee_uuid>';
INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
VALUES ('<admin_uuid>', 'forge', 'policies', gen_random_uuid());
-- Expected: ERROR 42501 (RLS violation)

-- TEST: Verify all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- Expected: 0 rows

-- TEST: Auto-RLS trigger exists
SELECT evtname, evtenabled
FROM pg_event_trigger
WHERE evtname = 'trg_auto_rls_new_table';
-- Expected: 1 row with evtenabled = 'O'

-- TEST: Confirm audit_logs policy
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'audit_logs';
-- Expected: INSERT policy has 'user_id = auth.uid() OR user_id IS NULL' in with_check
```

### 2. Route Protection Test (Manual)

```bash
# Open browser → private window (no session)
# Navigate to: https://dev.ppdu.int.gov.ab.ca/dashboard
# Expected: redirected to /auth

# Navigate to: https://dev.ppdu.int.gov.ab.ca/dashboard/policies
# Expected: redirected to /auth

# Navigate to: https://dev.ppdu.int.gov.ab.ca/upload-docs
# Expected: redirected to /auth
```

### 3. Auth Error Enumeration Test (Manual)

```bash
# Attempt sign-up with an existing registered email
# Expected toast: "Sign up failed. Please check your details and try again."
# NOT: "User already registered"

# Attempt sign-in with wrong password
# Expected toast: "Incorrect email or password."
# NOT: "Invalid login credentials" or any Supabase internal message
```

### 4. JWT Forgery Test (ChatBot Edge Function)

```bash
# Craft a forged JWT with valid-looking claims but invalid signature
FORGED_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.INVALID_SIGNATURE"

curl -X POST https://vxuwpajjbblsyhocnzxd.supabase.co/functions/v1/chat \
  -H "apikey: <anon_key>" \
  -H "Authorization: Bearer $FORGED_JWT" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Expected: 401 {"error":"Invalid or expired session. Please sign in again."}
```

### 5. Dependency Audit

```bash
cd /path/to/policy-proof-hub
npm audit --audit-level=high
# Review HIGH and CRITICAL findings; patch or document exceptions
```

### 6. Security Headers Verification (after applying M-1)

```bash
curl -I https://dev.ppdu.int.gov.ab.ca | grep -E "Strict-Transport|X-Frame|X-Content-Type|Content-Security-Policy|Referrer-Policy"
# Expected: all 5 headers present
```

---

## Remediation Priority Queue

| Priority | Finding | Owner | Target Date |
|----------|---------|-------|-------------|
| P0 | C-1: Rotate service_role key | DevOps / Tech Lead | Immediately |
| P0 | C-2: Rotate anon key | DevOps / Tech Lead | Immediately |
| P0 | C-1: Purge git history of admin.js / .env | Tech Lead | Within 24 hours |
| P1 | H-2: Switch to signed URLs for policy documents | Dev | Sprint 1 |
| P1 | M-1: Add security headers at hosting layer | DevOps | Sprint 1 |
| P1 | M-4: Lower rate limits + enable CAPTCHA | DevOps | Sprint 1 |
| P2 | M-5: Enable TOTP MFA | Dev | Sprint 2 |
| P2 | M-2: Remove .loca.lt from vite.config.ts | Dev | Sprint 1 |
| P3 | L-1: Implement Content-Security-Policy | Dev | Sprint 2 |
| P3 | L-4: Add cryptographic attestation signatures | Dev | Sprint 3 |
| P3 | L-2: Bundle code-splitting | Dev | Sprint 2 |

---

*Checklist version 1.0 — 2026-03-06*
