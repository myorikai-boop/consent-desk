# Terminal 3 — Build+Scale Agent Micro Grant: submission pack

## One-liner
Consent Desk is the permission desk between a person and the agents working for them:
the agent gets one scoped function, the member's data is filled inside the T3N enclave,
and every release is written to a ledger the member can read.

## Why it wins on the grant's own criteria
The grant pays for **traction: credits consumed by unique DIDs**, plus visibility.

| Criterion | What we do |
|---|---|
| Unique DIDs | Every member gets a `did:t3n`, every agent gets its own. A member with three agents = four DIDs, all doing real work. |
| Credits consumed | Each release is one enclave fill plus one outbound call. A single payroll or payout workflow is dozens of releases per member per month. |
| Visibility | Live dashboard, public repo, demo video, and a written "how we did it" post that names T3N. |

## What is built
1. **Session layer** (`src/lib/t3n.ts`): authenticated session per principal, trust-anchor verified, and the DID is always read from the session, never from the caller's claim.
2. **Vault** (`src/lib/vault.ts`): one KV map per member under `z:<tid>:`, one key per field. The helper returns a `{{profile.<field>}}` marker, never a value, so a careless caller cannot serialise PII.
3. **Consent** (`src/lib/consent.ts`): the member signs a grant through `updateMemberDelegation` — one function, one contract, an explicit egress allowlist. Revocation is a signed update, not a delete.
4. **TEE contract** (`contracts/consent-desk`): `release` performs the sealed fill and the allowlisted call; it refuses any body that carries no placeholder, and it never returns the upstream payload. `ledger` reads the tenant's own record of every release.
5. **Audit + dashboard** (`src/lib/audit.ts`, `web/index.html`): append-only trail and a live view of DIDs, sealed fields, grants and releases.

## Demo script (75 seconds)
1. (0:00) Open the dashboard. Two DIDs are already present: the member and one agent.
2. (0:10) Show the member's sealed fields. Note that the screen shows markers, not values.
3. (0:20) Issue the grant: one function, one contract, one host.
4. (0:30) The agent asks for a release: `purpose = "monthly payout"`, body contains `{{profile.iban}}` and `{{profile.tax_id}}`.
5. (0:45) Release executes. The response is a status and a ledger key. No PII on screen.
6. (0:55) Open the ledger: the entry shows who acted, for what purpose, against which host, and the result.
7. (1:05) Revoke. Run the same release again: the call is refused.
8. (1:12) Same release against a host that is not on the allowlist: egress denied.

## Traction plan (first 30 days after launch)
1. Five members from the operator's own network, each with one agent doing a real monthly task (payout, invoicing, benefits).
2. Each member: 1 member DID + 1-3 agent DIDs, 10-40 releases a month.
3. Target: 25+ unique DIDs and 500+ releases in month one, all visible on the dashboard and in the ledger.

## Honest limitations
- The T3N sandbox key is not yet claimed, so the demo will be recorded against the sandbox environment, not mainnet.
- The compiled WASM component has not yet been built in CI; the source and the world definition are complete, and the build target is `wasm32-wasip2`.
- Member onboarding is manual in this version. Self-serve onboarding is the first post-grant task.
