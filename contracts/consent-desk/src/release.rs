//! `release`: the one function an agent is granted.
//!
//! The body the agent sends is a template. Every value that matters is a
//! `{{profile.<field>}}` marker, resolved by the host from the granting
//! member's profile after this contract hands the template over. The response
//! payload is not returned to the caller on purpose: an upstream that echoes
//! the submitted fields would otherwise hand the sealed data straight back to
//! the agent.

use alloc::string::{String, ToString};
use alloc::vec::Vec;

#[derive(serde::Deserialize)]
pub struct ReleaseReq {
    pub member_ref: String,
    pub purpose: String,
    pub endpoint: String,
    #[serde(default)]
    pub headers: Option<Vec<(String, String)>>,
    pub body: serde_json::Value,
}

#[derive(serde::Serialize)]
pub struct ReleaseOut {
    pub status: u16,
    pub member_ref: String,
    pub purpose: String,
    pub at: u64,
    pub ledger_key: String,
    pub bytes_out: usize,
}

const PLACEHOLDER_PREFIX: &str = "{{profile.";

pub fn release(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: ReleaseReq =
        serde_json::from_slice(input).map_err(|e| alloc::format!("release: bad input: {e}"))?;

    let body_bytes = serde_json::to_vec(&req.body).map_err(|e| e.to_string())?;
    let body_text = core::str::from_utf8(&body_bytes).map_err(|e| e.to_string())?;
    if !body_text.contains(PLACEHOLDER_PREFIX) {
        return Err(
            "release: body carries no {{profile.*}} marker — refusing to send a request that does not need sealed data"
                .to_string(),
        );
    }

    #[cfg(target_arch = "wasm32")]
    {
        let out = release_wasm(&req, body_bytes)?;
        serde_json::to_vec(&out).map_err(|e| e.to_string())
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = req;
        Err("release is only implemented on the wasm32 target".to_string())
    }
}

#[cfg(target_arch = "wasm32")]
use crate::host::interfaces::{http_with_placeholders as hwp, logging};

#[cfg(target_arch = "wasm32")]
use crate::ledger;

#[cfg(target_arch = "wasm32")]
fn release_wasm(req: &ReleaseReq, body: Vec<u8>) -> Result<ReleaseOut, String> {
    let _ = logging::info(&alloc::format!(
        "release: member={} purpose={}",
        req.member_ref,
        req.purpose
    ));

    let bytes_out = body.len();
    let resp = hwp::call(&hwp::Request {
        method: hwp::Verb::Post,
        url: req.endpoint.clone(),
        headers: req.headers.clone(),
        payload: Some(body),
    })
    .map_err(|e| alloc::format!("release: {}", format_http_error(e)))?;

    let at = ledger::now();
    let ledger_key = ledger::append(
        &req.member_ref,
        &req.purpose,
        &req.endpoint,
        resp.code,
        at,
    )?;

    Ok(ReleaseOut {
        status: resp.code,
        member_ref: req.member_ref.clone(),
        purpose: req.purpose.clone(),
        at,
        ledger_key,
        bytes_out,
    })
}

#[cfg(target_arch = "wasm32")]
fn format_http_error(e: hwp::HttpError) -> String {
    match e {
        hwp::HttpError::EgressDenied(host) => {
            alloc::format!("egress denied for host {host} (not on this contract's allowlist)")
        }
        hwp::HttpError::PlaceholderDenied(marker) => {
            alloc::format!("placeholder not permitted: {marker}")
        }
        hwp::HttpError::PlaceholderUnknown(field) => {
            alloc::format!("the granting member's profile has no field {field}")
        }
        hwp::HttpError::PlaceholderNoUserContext => {
            "no user context bound to this call — refusing to resolve member data".to_string()
        }
        hwp::HttpError::UpstreamError(reason) => alloc::format!("upstream: {reason}"),
    }
}

#[cfg(test)]
mod tests {
    use super::release;

    #[test]
    fn rejects_body_without_placeholders() {
        let input = serde_json::to_vec(&serde_json::json!({
            "member_ref": "m-1",
            "purpose": "payout",
            "endpoint": "https://api.example.com/payouts",
            "body": { "amount": 10 }
        }))
        .unwrap();
        let err = release(&input).unwrap_err();
        assert!(err.contains("no {{profile.*}} marker"), "got: {err}");
    }
}
