pub const DEFAULT_LIST_PAGE_SIZE: usize = 20;
pub const MAX_LIST_PAGE_SIZE: usize = 200;

pub fn paginate_vec<T>(
    items: Vec<T>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> (Vec<T>, usize, Option<usize>, usize) {
    let total = items.len();
    let normalized_offset = offset.unwrap_or(0).min(total);
    let page_size = limit
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_LIST_PAGE_SIZE)
        .min(MAX_LIST_PAGE_SIZE);
    let requested_page_size = Some(page_size);
    let paged_items = items
        .into_iter()
        .skip(normalized_offset)
        .take(page_size)
        .collect::<Vec<_>>();

    (paged_items, normalized_offset, requested_page_size, total)
}
