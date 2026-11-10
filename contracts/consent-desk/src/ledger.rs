//! Consent ledger: an append-only record of every release this tenant performed.
//!
//! The node already writes a tamper-evident activity log; this is the
//! tenant-readable view of the same events, keyed so a member can be answered
//! with "here is every time an agent acted in your name" without pulling the
//! whole chain.

use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;

#[derive(serde::Deserialize)]
pub struct LedgerReq {
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_limit() -> u32 {
    20
}

#[derive(serde::Serialize)]
pub struct LedgerEntry {
    pub key: String,
    pub member_ref: String,
    pub purpose: String,
    pub endpoint: String,
    pub status: u16,
    pub at: u64,
}

#[derive(serde::Serialize)]
pub struct LedgerOut {
    pub entries: Vec<LedgerEntry>,
}

pub fn ledger(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: LedgerReq =
        serde_json::from_slice(input).map_err(|e| format!("ledger: bad input: {e}"))?;
    let limit = req.limit.clamp(1, 100);

    #[cfg(target_arch = "wasm32")]
    {
        let out = LedgerOut {
            entries: ledger_wasm(limit)?,
        };
        serde_json::to_vec(&out).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = limit;
        Err("ledger is only implemented on the wasm32 target".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::kv_store,
    tenant::tenant_context,
};

#[cfg(target_arch = "wasm32")]
pub fn map_name() -> String {
    format!(
        "z:{}:consent_ledger",
        hex::encode(tenant_context::tenant_did())
    )
}

#[cfg(target_arch = "wasm32")]
pub fn now() -> u64 {
    tenant_context::cluster_timestamp_secs()
}

/// Append one entry. Keys are zero-padded timestamps so a range scan reads in
/// chronological order without a secondary index.
#[cfg(target_arch = "wasm32")]
pub fn append(
    member_ref: &str,
    purpose: &str,
    endpoint: &str,
    status: u16,
    at: u64,
) -> Result<String, String> {
    let key = format!("{at:013}:{member_ref}");
    let value = serde_json::to_vec(&serde_json::json!({
        "member_ref": member_ref,
        "purpose": purpose,
        "endpoint": endpoint,
        "status": status,
        "at": at,
    }))
    .map_err(|e| e.to_string())?;
    kv_store::put(&map_name(), key.as_bytes(), &value).map_err(|e| format!("ledger put: {e}"))?;
    Ok(key)
}

#[cfg(target_arch = "wasm32")]
fn ledger_wasm(limit: u32) -> Result<Vec<LedgerEntry>, String> {
    let pairs = kv_store::scan(&map_name(), b"", b"\xff", limit)
        .map_err(|e| format!("ledger scan: {e}"))?;

    let mut entries = Vec::with_capacity(pairs.len());
    for (k, v) in pairs {
        let key = String::from_utf8(k).unwrap_or_default();
        let parsed: serde_json::Value = match serde_json::from_slice(&v) {
            Ok(v) => v,
            Err(_) => continue,
        };
        entries.push(LedgerEntry {
            key,
            member_ref: parsed["member_ref"].as_str().unwrap_or_default().to_string(),
            purpose: parsed["purpose"].as_str().unwrap_or_default().to_string(),
            endpoint: parsed["endpoint"].as_str().unwrap_or_default().to_string(),
            status: parsed["status"].as_u64().unwrap_or(0) as u16,
            at: parsed["at"].as_u64().unwrap_or(0),
        });
    }
    entries.reverse(); // newest first
    Ok(entries)
}
