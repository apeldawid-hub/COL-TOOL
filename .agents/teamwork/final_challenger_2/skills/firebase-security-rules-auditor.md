# Dump of firebase-security-rules-auditor
Audits Firebase security rules for vulnerabilities, privilege escalation, role bypasses, tenant isolation, create vs update inconsistencies, resource exhaustion, and ownership checks.
Checks:
1. Update bypass (create vs update)
2. Authority source (user-provided vs auth token)
3. Business logic vs rules
4. Storage abuse / DoS
5. Type safety
6. Field-level vs identity-level security
Tenant isolation: request.auth.token.storeId == storeId
Scoring: 1 (Critical) to 5 (Secure).
