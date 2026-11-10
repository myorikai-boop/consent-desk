import type { Session } from "./t3n.js";

export interface VaultField {
  path: string;
  label: string;
  /** never the value itself — only where the value lives and who may read it */
  mapName: string;
  ownerDid: string;
  createdAt: string;
}

const fields = new Map<string, VaultField>();

/**
 * Creates a tenant-scoped KV map for one member's sensitive field.
 * The map lives under the tenant's z:<tid>: prefix, so reads and writes are
 * checked against the tenant boundary inside the enclave: there is no ACL to
 * misconfigure. The agent never receives the value, only the map path.
 */
export async function createFieldMap(
  session: Session,
  ownerDid: string,
  path: string,
  label: string,
): Promise<VaultField> {
  const mapName = `member.${short(ownerDid)}.${path}`;

  // TenantClient is constructed from the authenticated session's tenant DID.
  const tenant: any = (session.client as any).tenant;
  if (!tenant?.maps?.create) {
    throw new Error("tenant maps are unavailable in this SDK build");
  }

  await tenant.maps.create({
    name: mapName,
    readers: [ownerDid],
    writers: [ownerDid],
  });

  const field: VaultField = {
    path,
    label,
    mapName,
    ownerDid,
    createdAt: new Date().toISOString(),
  };
  fields.set(`${ownerDid}:${path}`, field);
  return field;
}

export function listFields(ownerDid?: string): VaultField[] {
  const all = [...fields.values()];
  return ownerDid ? all.filter((f) => f.ownerDid === ownerDid) : all;
}

export function getField(ownerDid: string, path: string): VaultField | undefined {
  return fields.get(`${ownerDid}:${path}`);
}

/**
 * A placeholder is what an agent actually sends: {{member.passport_no}}.
 * T3N fills it inside the TEE, so the model, the logs and the app never hold
 * the plaintext value.
 */
export function placeholder(path: string): string {
  return `{{member.${path}}}`;
}

function short(did: string): string {
  return did.replace(/^did:t3n:/, "").slice(0, 10);
}
