//! Known model provider vendor codes and their display names.
//!
//! Import links may carry one or more `vendor` codes (see the `parser`
//! module); the display names below mirror the official vendor presets the
//! Settings → Model Access panel ships with, so imported channels show
//! readable vendor names in their offerings. Codes are stable identifiers:
//! unknown codes (self-hosted or future providers) fall back to the code
//! itself as the display name.

/// Known vendor codes with their display names, mirroring the official
/// model vendor presets of the Settings → Model Access panel.
pub const KNOWN_VENDOR_NAMES: &[(&str, &str)] = &[
    ("alibaba", "Alibaba Cloud"),
    ("anthropic", "Anthropic"),
    ("baidu", "Baidu AI Cloud"),
    ("bytedance", "ByteDance"),
    ("deepseek", "DeepSeek"),
    ("google", "Google"),
    ("meituan", "Meituan"),
    ("minimax", "MiniMax"),
    ("moonshot", "Moonshot Kimi"),
    ("openai", "OpenAI"),
    ("stepfun", "StepFun"),
    ("tencent", "Tencent Cloud"),
    ("xai", "xAI"),
    ("xiaomi", "Xiaomi MiMo"),
    ("zhipu", "Zhipu AI"),
];

/// Display name for a vendor code; unknown codes fall back to the code
/// itself so self-hosted or future providers still render.
pub fn vendor_display_name(code: &str) -> String {
    KNOWN_VENDOR_NAMES
        .iter()
        .find(|(known, _)| *known == code)
        .map(|(_, name)| (*name).to_owned())
        .unwrap_or_else(|| code.to_owned())
}

#[cfg(test)]
mod tests {
    use super::{vendor_display_name, KNOWN_VENDOR_NAMES};

    #[test]
    fn resolves_known_vendor_names() {
        assert_eq!(vendor_display_name("openai"), "OpenAI");
        assert_eq!(vendor_display_name("anthropic"), "Anthropic");
        assert_eq!(vendor_display_name("deepseek"), "DeepSeek");
        assert_eq!(vendor_display_name("moonshot"), "Moonshot Kimi");
    }

    #[test]
    fn falls_back_to_code_for_unknown_vendors() {
        assert_eq!(vendor_display_name("grok"), "grok");
        assert_eq!(vendor_display_name(""), "");
        assert_eq!(vendor_display_name("self-hosted-llm"), "self-hosted-llm");
    }

    #[test]
    fn every_known_vendor_has_a_code_and_a_name() {
        for (code, name) in KNOWN_VENDOR_NAMES {
            assert!(!code.is_empty(), "vendor code must not be empty");
            assert!(!name.is_empty(), "vendor name must not be empty");
        }
    }
}
