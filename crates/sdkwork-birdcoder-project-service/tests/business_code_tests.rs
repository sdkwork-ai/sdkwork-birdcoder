use sdkwork_birdcoder_project_service::business_code::build_project_business_code;

#[test]
fn generated_project_business_codes_preserve_unique_suffix_for_long_common_paths() {
    let root_path_a = "D:/workspace/very-long-common-prefix/that-used-to-truncate-the-project-code-before-the-unique-suffix/a";
    let root_path_b = "D:/workspace/very-long-common-prefix/that-used-to-truncate-the-project-code-before-the-unique-suffix/b";
    let project_code_a = build_project_business_code("100000000000000101", "Repeated Folder", Some(root_path_a));
    let project_code_b = build_project_business_code("100000000000000102", "Repeated Folder", Some(root_path_b));
    assert_ne!(project_code_a, project_code_b);
    assert!(project_code_a.len() <= 64);
    assert!(project_code_b.len() <= 64);
    assert!(project_code_a.ends_with("100000000000000101"));
    assert!(project_code_b.ends_with("100000000000000102"));
}

