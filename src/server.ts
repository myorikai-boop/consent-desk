import express from "express";
import path from "node:path";
import { openSession, env } from "./lib/t3n.js";
import { createFieldMap, listFields, placeholder } from "./lib/vault.js";
import { grant, revokeAll, listConsents, readConsents } from "./lib/consent.js";
import { record, readEvents, summary } from "./lib/audit.js";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "web")));

const tenantKey = process.env.T3N_API_KEY;
const agentKey = process.env.AGENT_KEY;

let tenantSession: Awaited<ReturnType<typeof openSession>> | null = null;

async function tenant() {
  if (!tenantKey) throw new Error("T3N_API_KEY is not set");
  if (!tenantSession) tenantSession = await openSession(tenantKey, env());
  return tenantSession;
}

app.get("/api/status", async (_req, res) => {
  try {
    const t = await tenant();
    res.json({
      ok: true,
      environment: env(),
      tenantDid: t.did,
      agentDid: process.env.AGENT_DID || null,
      contractId: process.env.TENANT_CONTRACT || null,
      audit: summary(),
      fields: listFields(),
      consents: listConsents(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * A member asks for a field to be sealed in the vault. We never accept the value
 * through this endpoint in production: the member writes it themselves into their
 * own map, and we only keep the reference.
 */
app.post("/api/fields", async (req, res) => {
  const { ownerDid, path: fieldPath, label } = req.body ?? {};
  if (!ownerDid || !fieldPath) {
    return res.status(400).json({ ok: false, error: "ownerDid and path are required" });
  }
  try {
    const t = await tenant();
    const field = await createFieldMap(t, ownerDid, fieldPath, label || fieldPath);
    await record({
      actorDid: t.did,
      subjectDid: ownerDid,
      action: "vault.field.created",
      outcome: "allowed",
      note: field.mapName,
    });
    res.json({ ok: true, field, placeholder: placeholder(fieldPath) });
  } catch (err) {
    await record({ actorDid: "system", action: "vault.field.create", outcome: "error", note: String(err) });
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/consent", async (req, res) => {
  const { functions, hosts, contractId, versionReq } = req.body ?? {};
  if (!agentKey || !process.env.AGENT_DID) {
    return res.status(400).json({ ok: false, error: "AGENT_KEY and AGENT_DID must be configured" });
  }
  try {
    const userSession = await openSession(agentKey, env()); // stand-in for the member session in the demo flow
    const result = await grant(userSession, {
      grantee: process.env.AGENT_DID,
      contractId: contractId || process.env.TENANT_CONTRACT || "",
      versionReq: versionReq || "1.0.0",
      functions: functions ?? ["payout.run"],
      hosts: hosts ?? ["api.example-payout.com"],
    });
    await record({
      actorDid: userSession.did,
      subjectDid: userSession.did,
      action: "consent.granted",
      contractId: contractId,
      hosts,
      outcome: "allowed",
      note: result.granted.join(","),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    await record({ actorDid: "system", action: "consent.grant", outcome: "error", note: String(err) });
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/consent/revoke", async (_req, res) => {
  if (!agentKey) return res.status(400).json({ ok: false, error: "AGENT_KEY missing" });
  try {
    const userSession = await openSession(agentKey, env());
    await revokeAll(userSession);
    await record({ actorDid: userSession.did, action: "consent.revoked", outcome: "allowed" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/consent", async (_req, res) => {
  if (!agentKey) return res.status(400).json({ ok: false, error: "AGENT_KEY missing" });
  try {
    const userSession = await openSession(agentKey, env());
    res.json({ ok: true, policy: await readConsents(userSession) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/audit", async (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  res.json({ ok: true, summary: summary(), events: await readEvents(limit) });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Consent Desk on http://localhost:${port}`);
});
