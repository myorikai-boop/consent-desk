import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  resolveTrustAnchor,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from "@terminal3/t3n-sdk";

export type Env = "testnet" | "production";

export interface Session {
  client: T3nClient;
  did: string;
  address: string;
}

let wasm: Awaited<ReturnType<typeof loadWasmComponent>> | null = null;

async function getWasm() {
  if (!wasm) wasm = await loadWasmComponent();
  return wasm;
}

/**
 * Opens an authenticated T3N session for any principal (tenant, user, or agent).
 * Each principal must sign with its own key: never reuse the tenant key for an agent.
 */
export async function openSession(key: string, env: Env = "testnet"): Promise<Session> {
  if (!key) throw new Error("missing T3N key");

  setEnvironment(env);
  const address = eth_get_address(key);

  const client = new T3nClient({
    // Verifies we are talking to a genuine T3N enclave, not a server that merely
    // claims to be one. Required: the client throws without a trust anchor.
    trustAnchor: await resolveTrustAnchor(env),
    wasmComponent: await getWasm(),
    handlers: {
      EthSign: metamask_sign(address, undefined, key),
    },
  });

  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));

  return { client, did: did.value, address };
}

export function env(): Env {
  return (process.env.T3N_ENV as Env) || "testnet";
}
