//! z-consent-desk v0.1.0 — sealed execution for agent requests that need PII.
//!
//! Two exports:
//!   * `release` — the agent's request. The body carries `{{profile.<field>}}`
//!     markers; the host fills them inside the enclave and performs the call.
//!     The contract never sees the plaintext, so a prompt-injected agent has
//!     nothing to exfiltrate.
//!   * `ledger` — reads back the tenant's own consent ledger so members and
//!     operators can see what was asked for, by whom and with what outcome.
#![warn(clippy::style)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

pub const CONTRACT_VERSION: &str = "0.1.0";

wit_bindgen::generate!({
    world: "consent-desk",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod ledger;
mod release;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::consent_desk::contracts::Guest for Component {
    fn release(
        req: exports::z::consent_desk::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("release: missing input")?;
        release::release(&input)
    }

    fn ledger(
        req: exports::z::consent_desk::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let input = req.input.ok_or("ledger: missing input")?;
        ledger::ledger(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3);
        for part in parts {
            assert!(part.parse::<u32>().is_ok());
        }
    }
}
