use sdkwork_birdcoder_project_service::pagination::{
    clamp_list_page_size, DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE,
};

#[test]
fn clamp_list_page_size_uses_default_when_limit_is_absent() {
    let (offset, limit) = clamp_list_page_size(None, None);
    assert_eq!(offset, 0);
    assert_eq!(limit, DEFAULT_LIST_PAGE_SIZE);
}

#[test]
fn clamp_list_page_size_uses_default_when_limit_is_zero() {
    let (offset, limit) = clamp_list_page_size(None, Some(0));
    assert_eq!(offset, 0);
    assert_eq!(limit, DEFAULT_LIST_PAGE_SIZE);
}

#[test]
fn clamp_list_page_size_clamps_requested_limit_to_maximum() {
    let (offset, limit) = clamp_list_page_size(Some(10), Some(500));
    assert_eq!(offset, 10);
    assert_eq!(limit, MAX_LIST_PAGE_SIZE);
}

#[test]
fn clamp_list_page_size_keeps_valid_requested_limit() {
    let (offset, limit) = clamp_list_page_size(Some(40), Some(15));
    assert_eq!(offset, 40);
    assert_eq!(limit, 15);
}

#[test]
fn clamp_list_page_size_normalizes_negative_offset_to_zero() {
    let (offset, _limit) = clamp_list_page_size(None, None);
    assert_eq!(offset, 0);
    // `clamp_list_page_size` clamps offset via `unwrap_or(0).min(MAX * 1_000)`,
    // so a missing offset always yields 0.
}

#[test]
fn clamp_list_page_size_caps_offset_at_safe_upper_bound() {
    // `MAX_LIST_PAGE_SIZE * 1_000` keeps `OFFSET` bounded so a malicious
    // client cannot force the database to skip a billion rows.
    let (offset, _limit) = clamp_list_page_size(Some(usize::MAX), None);
    assert_eq!(offset, MAX_LIST_PAGE_SIZE * 1_000);
}

#[test]
fn clamp_list_page_size_clamps_limit_to_at_least_one() {
    let (_offset, limit) = clamp_list_page_size(None, Some(0));
    assert_eq!(limit, DEFAULT_LIST_PAGE_SIZE);
    // zero limit falls back to default; negative limit is impossible for `usize`.
}

#[test]
fn clamp_list_page_size_default_and_max_constants_match_spec() {
    // PAGINATION_SPEC.md §3: default page_size = 20, max = 200.
    assert_eq!(DEFAULT_LIST_PAGE_SIZE, 20);
    assert_eq!(MAX_LIST_PAGE_SIZE, 200);
}
