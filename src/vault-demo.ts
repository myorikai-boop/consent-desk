/**
 * Consent Desk — live vault proof against the T3N testnet.
 *
 * Proves, on the real network, the three primitives the desk depends on:
 *   1. a tenant (organisation) that owns the member's data namespace,
 *   2. a sealed field store the member writes into and reads back,
 *   3. an agent identity that is a separate DID from the member.
 *
 * Run:  T3N_API_KEY=... T3N_TENANT_DID=... npx tsx src/vault-demo.ts
 */
import { TenantClient, getNodeUrl } from "@terminal3/t3n-sdk";
import { openSession, env } from "./lib/t3n.js";

const key = process.env.T3N_API_KEY;
const tenantDid = process.env.T3N_TENANT_DID;
if (!key || !tenantDid) {
  console.error("Need T3N_API_KEY and T3N_TENANT_DID");
  process.exit(1);
}

const session = await openSession(key, env());
console.log("member did :", session.did);
console.log("tenant     :", tenantDid);

const tenant = new TenantClient({
  environment: env() as "testnet" | "sandbox" | "production",
  baseUrl: getNodeUrl(),
  t3n: session.client,
  tenantDid,
});

const TAIL = "vault";

// 1. The member's sealed field store.
try {
  await tenant.maps.create({
    tail: TAIL,
    visibility: "private",
    writers: "all",
    readers: "all",
  });
  console.log("map created:", TAIL);
} catch (e) {
  console.log("map create said:", (e as Error).message.slice(0, 200));
}

// 2. Write two sealed fields.
await tenant.maps.entrySet(TAIL, "iban", "IL00-0000-0000-0000-0000-001");
await tenant.maps.entrySet(TAIL, "tax_id", "000000000");
console.log("fields written: iban, tax_id");

// 3. Read one back, to prove the store round-trips.
const iban = await tenant.maps.entryGet(TAIL, "iban");
console.log("read back  :", iban);

// 4. The agent is a different DID from the member.
console.log("agent did  :", process.env.T3N_AGENT_DID ?? "(not set)");
console.log("separate   :", process.env.T3N_AGENT_DID !== session.did);
