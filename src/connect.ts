import { openSession, env } from "./lib/t3n.js";

const key = process.env.T3N_API_KEY;
if (!key) {
  console.error("Set T3N_API_KEY first (claim page: https://www.terminal3.io/claim-page)");
  process.exit(1);
}

const session = await openSession(key, env());
console.log("Connected as:", session.did);
console.log("Address:", session.address);
console.log("Environment:", env());
