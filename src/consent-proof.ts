/**
 * Consent Desk — live consent proof on T3N testnet.
 * 1. As the agent: ask whether it may read the member's vault. Expect refused.
 * 2. As the member: sign a narrow grant (one contract, one function, one scope).
 * 3. As the agent: ask again. Expect allowed.
 */
import { discoverCheckDelegation, getNodeUrl, readOnlyScopes } from "@terminal3/t3n-sdk";
import { openSession, env } from "./lib/t3n.js";

const baseUrl = getNodeUrl();
const agentKey = process.env.T3N_AGENT_KEY!;
const agentDid = process.env.T3N_AGENT_DID!;
const memberKey = process.env.T3N_API_KEY!;

const target = {
  contract_id: "tee:org-data",
  function: "data-get",
  scopes: readOnlyScopes(["vault"]),
};

async function ask(label: string, fn = "data-get") {
  try {
    const r: any = await discoverCheckDelegation(
      { baseUrl, apiKey: agentKey } as any,
      {
        contract: target.contract_id,
        pii_did: process.env.T3N_MEMBER_DID!,
        functions: [fn],
        scopes: ["vault"],
      } as any,
    );
    console.log(label, JSON.stringify(r).slice(0, 400));
  } catch (e) {
    console.log(label, "ERR", (e as Error).message.slice(0, 200));
  }
}

await ask("granted fn (data-get):    ");
await ask("out-of-grant fn (data-write):", "data-write");
await ask("out-of-grant scope:", "data-get", "other-scope");

const member = await openSession(memberKey, env());
const doc: any = await member.client.updateMemberDelegation([
  {
    grantee: agentDid,
    contract_id: target.contract_id,
    function: target.function,
    scopes: target.scopes,
    allowed_hosts: [],
  },
] as any);
console.log("grant signed by", member.did, "->", JSON.stringify(doc).slice(0, 300));

await ask("still granted (data-get):  ");
