import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface AuditEvent {
  at: string;
  actorDid: string;
  action: string;
  subjectDid?: string;
  contractId?: string;
  function?: string;
  hosts?: string[];
  outcome: "allowed" | "denied" | "error";
  note?: string;
}

const LOG_PATH = process.env.AUDIT_LOG || path.join(process.cwd(), "data", "audit.jsonl");

const memory: AuditEvent[] = [];

export async function record(event: Omit<AuditEvent, "at">): Promise<AuditEvent> {
  const full: AuditEvent = { at: new Date().toISOString(), ...event };
  memory.push(full);
  try {
    await appendFile(LOG_PATH, JSON.stringify(full) + "\n", { flag: "a" });
  } catch {
    // A dashboard that cannot write to disk still keeps the in-memory trail.
  }
  return full;
}

export async function readEvents(limit = 200): Promise<AuditEvent[]> {
  if (existsSync(LOG_PATH)) {
    const raw = await readFile(LOG_PATH, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent)
      .slice(-limit)
      .reverse();
  }
  return memory.slice(-limit).reverse();
}

export function summary() {
  const allowed = memory.filter((e) => e.outcome === "allowed").length;
  const denied = memory.filter((e) => e.outcome === "denied").length;
  const actors = new Set(memory.map((e) => e.actorDid)).size;
  const members = new Set(memory.map((e) => e.subjectDid).filter(Boolean)).size;
  return { total: memory.length, allowed, denied, actors, members };
}
