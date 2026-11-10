import type { Session } from "./t3n.js";

export interface ConsentRequest {
  grantee: string;
  contractId: string;
  versionReq: string;
  /** exactly one function per grant row — T3N's grant shape is one function per row */
  functions: string[];
  hosts: string[];
}

const consents: Array<{
  memberDid: string;
  grants: Array<{ grantee: string; contractId: string; function: string; hosts: string[]; grantedAt: string }>;
  revoked: string[];
}> = [];

/**
 * The member (data owner) signs this, not the agent and not us.
 * Generated grants are additive: updateMemberDelegation reads the current policy,
 * merges by (grantee, contract_id, function) and writes the whole document back,
 * so other agents' grants survive.
 */
export async function grant(
  memberSession: Session,
  req: ConsentRequest,
): Promise<{ memberDid: string; granted: string[] }> {
  const { fanOutGrant, readOnlyScopes } = await import("@terminal3/t3n-sdk");

  const rows = fanOutGrant(
    {
      grantee: req.grantee,
      contract_id: req.contractId,
      version_req: req.versionReq,
      scopes: readOnlyScopes(req.functions),
      allowed_hosts: req.hosts,
    },
    req.functions,
  );

  const update = (memberSession.client as any).updateMemberDelegation;
  if (typeof update !== "function") {
    throw new Error("updateMemberDelegation is unavailable in this SDK build");
  }
  await update.call(memberSession.client, rows);

  const record = consents.find((c) => c.memberDid === memberSession.did);
  const grantedAt = new Date().toISOString();
  const entry = req.functions.map((fn) => ({
    grantee: req.grantee,
    contractId: req.contractId,
    function: fn,
    hosts: req.hosts,
    grantedAt,
  }));

  if (record) record.grants.push(...entry);
  else consents.push({ memberDid: memberSession.did, grants: entry, revoked: [] });

  return { memberDid: memberSession.did, granted: req.functions };
}

export async function revokeAll(memberSession: Session): Promise<void> {
  const update = (memberSession.client as any).updateMemberDelegation;
  if (typeof update !== "function") throw new Error("updateMemberDelegation unavailable");
  // An empty grant list is the documented way to revoke everything.
  await update.call(memberSession.client, []);
  const record = consents.find((c) => c.memberDid === memberSession.did);
  if (record) {
    record.grants = [];
    record.revoked.push(new Date().toISOString());
  }
}

export async function readConsents(memberSession: Session): Promise<unknown> {
  const get = (memberSession.client as any).getMemberDelegation;
  if (typeof get !== "function") throw new Error("getMemberDelegation unavailable");
  return get.call(memberSession.client);
}

export function listConsents() {
  return consents;
}
