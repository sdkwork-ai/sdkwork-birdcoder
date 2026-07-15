pub fn sanitize_business_code_segment(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut previous_was_separator = false;

    for character in value.chars() {
        let upper = character.to_ascii_uppercase();
        if upper.is_ascii_alphanumeric() {
            normalized.push(upper);
            previous_was_separator = false;
        } else if !previous_was_separator {
            normalized.push('-');
            previous_was_separator = true;
        }
    }

    normalized.trim_matches('-').to_owned()
}

pub fn take_first_chars(value: &str, max_length: usize) -> String {
    value.chars().take(max_length).collect()
}

pub fn take_last_chars(value: &str, max_length: usize) -> String {
    let character_count = value.chars().count();
    value
        .chars()
        .skip(character_count.saturating_sub(max_length))
        .collect()
}

pub fn join_business_code_parts(parts: &[&str]) -> String {
    parts
        .iter()
        .filter(|part| !part.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join("-")
}

pub fn build_business_code_with_required_suffix(
    prefix: &str,
    primary_segment: &str,
    fallback_segment: &str,
    max_length: usize,
) -> String {
    let suffix_segment = if fallback_segment.len() > max_length {
        take_last_chars(fallback_segment, max_length)
    } else {
        fallback_segment.to_owned()
    };

    if primary_segment.is_empty() {
        let composed = join_business_code_parts(&[prefix, suffix_segment.as_str()]);
        if composed.len() <= max_length {
            return composed;
        }

        let max_prefix_length = max_length.saturating_sub(suffix_segment.len() + 1);
        if !prefix.is_empty() && max_prefix_length > 0 {
            let prefix_head = take_first_chars(prefix, max_prefix_length)
                .trim_end_matches('-')
                .to_owned();
            return join_business_code_parts(&[prefix_head.as_str(), suffix_segment.as_str()]);
        }
        return take_last_chars(suffix_segment.as_str(), max_length);
    }

    let separator_count = if prefix.is_empty() { 1 } else { 2 };
    let fixed_length = prefix.len() + separator_count + suffix_segment.len();
    if fixed_length >= max_length {
        let composed = join_business_code_parts(&[prefix, suffix_segment.as_str()]);
        if composed.len() <= max_length {
            return composed;
        }
        return take_last_chars(suffix_segment.as_str(), max_length);
    }

    let max_primary_length = max_length - fixed_length;
    let primary_head = take_first_chars(primary_segment, max_primary_length)
        .trim_end_matches('-')
        .to_owned();
    join_business_code_parts(&[prefix, primary_head.as_str(), suffix_segment.as_str()])
}

pub fn build_business_code(prefix: &str, primary_value: &str, fallback_id: &str) -> String {
    const MAX_BUSINESS_CODE_LENGTH: usize = 64;
    let primary_segment = sanitize_business_code_segment(primary_value);
    let fallback_segment = sanitize_business_code_segment(fallback_id);
    let normalized_prefix = sanitize_business_code_segment(prefix);
    if !fallback_segment.is_empty() {
        return build_business_code_with_required_suffix(
            normalized_prefix.as_str(),
            primary_segment.as_str(),
            fallback_segment.as_str(),
            MAX_BUSINESS_CODE_LENGTH,
        );
    }

    if primary_segment.is_empty() {
        return take_first_chars(normalized_prefix.as_str(), MAX_BUSINESS_CODE_LENGTH);
    }

    let seed = if primary_segment.is_empty() {
        normalized_prefix.as_str()
    } else {
        primary_segment.as_str()
    };
    take_first_chars(
        join_business_code_parts(&[normalized_prefix.as_str(), seed]).as_str(),
        MAX_BUSINESS_CODE_LENGTH,
    )
}

pub fn build_project_business_code(
    project_id: &str,
    name: &str,
    root_path: Option<&str>,
) -> String {
    let primary_value = root_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(name);
    build_business_code("PROJ", primary_value, project_id)
}
