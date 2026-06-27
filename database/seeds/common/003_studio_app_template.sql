-- seed: studio_app_template
-- Language-neutral application templates (basic-react, tauri-desktop, flutter-mobile, capacitor-h5).
-- Portable idempotent upsert: INSERT ... ON CONFLICT DO NOTHING (SQLite 3.24+ and PostgreSQL).

INSERT INTO studio_app_template
    (id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, slug, name, category, status)
VALUES
    (
        'basic-react',
        '550e8400-e29b-4000-0000-000000000001',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'basic-react',
        'Basic React',
        'web',
        'active'
    ),
    (
        'tauri-desktop',
        '550e8400-e29b-4000-0000-000000000002',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'tauri-desktop',
        'Tauri Desktop',
        'desktop',
        'active'
    ),
    (
        'flutter-mobile',
        '550e8400-e29b-4000-0000-000000000003',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'flutter-mobile',
        'Flutter Mobile',
        'mobile',
        'active'
    ),
    (
        'capacitor-h5',
        '550e8400-e29b-4000-0000-000000000004',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'capacitor-h5',
        'Capacitor H5',
        'mobile',
        'active'
    )
ON CONFLICT DO NOTHING;
