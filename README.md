# Consent Desk

An operations layer for agents that need to act on private data without ever seeing it.
Built on [Terminal 3](https://terminal3.io) (T3N): a per-agent DID, a member-signed
delegation grant, sealed execution inside a TEE, and a tamper-evident activity log.

The problem it solves is narrow and real: an agent can write a perfect application,
schedule a payout, or file a form, but the moment that work needs a passport number,
a bank account or a customer's address, teams either hand the agent a long-lived API
key or stall the project. Consent Desk removes that fork. The member grants exactly
one function on exactly one contract, and exactly which external hosts it may reach.
The agent sends `{{member.bank_account}}`. T3N fills it inside the enclave.

## What is in the box

| Path | What it does |
| --- | --- |
| `src/lib/t3n.ts` | Authenticated session for any principal (tenant, member, agent). Trust anchor verified, DID read back from the session. |
| `src/lib/vault.ts` | Creates a tenant-scoped KV map per member field under `z:<tid>:`, and produces the placeholder the agent is allowed to send. |
| `src/lib/consent.ts` | Member-signed grants via `updateMemberDelegation` (read-merge-write, so other agents' grants survive). Revocation is one call. |
| `src/lib/audit.ts` | Local mirror of every consent action, append-only JSONL, plus a summary used by the dashboard. |
| `src/server.ts` | HTTP API: `/api/status`, `/api/fields`, `/api/consent`, `/api/consent/revoke`, `/api/audit`. |
| `web/index.html` | Dashboard: tenant and agent DIDs, sealed fields, live grants, activity trail. |
| `contracts/consent-desk` | Rust → WASM TEE contract. `release` performs the sealed fill and the allowlisted outbound call; `ledger` reads back the tenant's own record of every release. |
| `ci/github-actions.yml` | Build + test definition (native unit tests, `wasm32-wasip2` component, artifact upload). Copy to `.github/workflows/ci.yml` to enable it. |

## Run it

```bash
npm install
cp .env.example .env          # add T3N_API_KEY (and AGENT_KEY once the agent exists)
npm run connect               # prints did:t3n:… for the tenant
npm run serve                 # dashboard on http://localhost:8787
```

The agent needs its **own** key and its **own** credits. A tenant key cannot act as an
agent, and an agent DID starts at a zero balance.

## The trust model, in one paragraph

Authentication proves the agent is who it says. It does not authorise anything. The
data owner signs a grant naming the grantee DID, one contract, one function, the
scopes it may read, and the hosts it may reach. A call outside that scope fails at
egress with `host/http.egress_denied` and is logged. The agent never holds the value,
so a prompt-injected agent has nothing to exfiltrate: it can only ask for work to be
done, and every ask is checked and recorded.

## Status

Working: session auth, vault map creation, grant and revoke, activity trail, dashboard,
and the TEE contract source (`release` refuses any body without a `{{profile.*}}` marker,
so a stray call can never leak a plaintext value).
Next: claim the T3N key, deploy the compiled component, run the first real sealed release
end to end, then onboard members and cut the demo.
