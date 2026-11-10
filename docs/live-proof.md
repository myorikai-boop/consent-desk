# Live proof on T3N testnet, 10 November 2026

Everything below was executed against `https://cn-api.sg.testnet.t3n.terminal3.io` with the
claimed API key. Raw output is what the terminal printed.

## Identities

| Role | DID |
|---|---|
| Member (owner of the data) | `did:t3n:219aaed4ca7b28a9e74a58272de6388134c79e7f` |
| Tenant (organisation "Consent Desk") | `did:t3n:5dc7c5afe5f89c130aab384ae4298522249348a2` |
| Agent (`payout-agent`, org-owned) | `did:t3n:b018a19ef3cdfa4f63bc7b7b3a0b004dff3f9f58` |

The agent is a distinct DID from the member, provisioned under the org and holding its own
credential (`t3n_key_…`, keyed to its own key id). The member's key never touches the agent.

## 1. Sealed field store (`src/vault-demo.ts`)

```
member did : did:t3n:219aaed4ca7b28a9e74a58272de6388134c79e7f
map created: vault
fields written: iban, tax_id
read back  : IL00-0000-0000-0000-0000-001
agent did  : did:t3n:b018a19ef3cdfa4f63bc7b7b3a0b004dff3f9f58
separate   : true
```

The map is canonical under the member's own namespace (`z:219aaed4…:vault`) — the node refuses
any map name that is not rooted in the caller's own DID, which is why the member, not the org,
owns the store.

## 2. Consent verdicts (`src/consent-proof.ts`)

Grant signed by the member: one grantee, one contract (`tee:org-data`), one function (`data-get`).

```
granted fn (data-get):
{"authorised":true,"disclosed":true,
 "satisfied":[{"grant":"member_delegation","contract":"tee:org-data","functions":["data-get"],"scopes":[]}],
 "missing":[]}

out-of-grant fn (data-write):
{"authorised":false,"disclosed":true,"satisfied":[],
 "missing":[{"grant":"member_delegation","contract":"tee:org-data","functions":["data-write"],"scopes":[]}]}
```

That pair is the whole product in two lines: the agent acting for the member is authorised for
the exact function the member signed, and refused the moment it reaches for another one.

## 3. What is proven and what is not

Proven live: claimant identity, tenant creation, org-owned agent provisioning, sealed map
create, write, read, member-signed grant, and the authorised/refused verdict pair.

Not yet done, and not claimed: publishing our own WASM contract (the source is in
`contracts/consent-desk`; a `wasm32-wasip2` build is needed), the sealed release that fills a
placeholder inside the enclave, the demo video, and the grant submission itself. The agent also
has no credit balance yet: `agent create --initial-credits` failed with
`insufficient credit (available=0, requested=100)`, so funding the agent is the next
operational step.

## Reproduce

```
export T3N_API_KEY=... T3N_AGENT_KEY=... \
       T3N_TENANT_DID=did:t3n:219aaed4... T3N_AGENT_DID=did:t3n:b018a19e... \
       T3N_MEMBER_DID=did:t3n:219aaed4...
npx tsx src/vault-demo.ts
npx tsx src/consent-proof.ts
```
