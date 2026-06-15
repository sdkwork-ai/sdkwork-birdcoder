use sdkwork_birdcoder_project_service::pagination::paginate_vec;

#[test]
fn paginate_vec_uses_bounded_default_page_size_when_limit_is_absent() {
    let (paged_items, normalized_offset, requested_page_size, total) =
        paginate_vec((0..75).collect::<Vec<_>>(), None, None);
    assert_eq!(normalized_offset, 0);
    assert_eq!(requested_page_size, Some(20));
    assert_eq!(total, 75);
    assert_eq!(paged_items.len(), 20);
    assert_eq!(paged_items.first(), Some(&0));
    assert_eq!(paged_items.last(), Some(&19));
}

#[test]
fn paginate_vec_clamps_requested_page_size_to_maximum() {
    let (paged_items, normalized_offset, requested_page_size, total) =
        paginate_vec((0..250).collect::<Vec<_>>(), Some(10), Some(500));
    assert_eq!(normalized_offset, 10);
    assert_eq!(requested_page_size, Some(200));
    assert_eq!(total, 250);
    assert_eq!(paged_items.len(), 200);
    assert_eq!(paged_items.first(), Some(&10));
    assert_eq!(paged_items.last(), Some(&209));
}

