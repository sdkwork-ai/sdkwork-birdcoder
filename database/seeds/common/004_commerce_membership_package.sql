-- seed: commerce_membership_package
-- Language-neutral membership packages (free, pro, enterprise).
-- Portable idempotent upsert: INSERT ... ON CONFLICT DO NOTHING (SQLite 3.24+ and PostgreSQL).

INSERT INTO commerce_membership_package
    (
        id,
        uuid,
        tenant_id,
        organization_id,
        created_at,
        updated_at,
        version,
        is_deleted,
        group_id,
        name,
        description,
        price,
        original_price,
        point_amount,
        duration_days,
        plan_name,
        sort_weight,
        recommended
    )
VALUES
    (
        'free',
        '550e8400-e29b-4000-0000-000000000010',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'default',
        'Free',
        'Free membership plan with basic quotas.',
        '0',
        NULL,
        '0',
        '30',
        'free',
        '0',
        FALSE
    ),
    (
        'pro',
        '550e8400-e29b-4000-0000-000000000011',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'default',
        'Pro',
        'Pro membership plan with higher quotas and priority support.',
        '29',
        '39',
        '2900',
        '30',
        'pro',
        '1',
        TRUE
    ),
    (
        'enterprise',
        '550e8400-e29b-4000-0000-000000000012',
        0,
        0,
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z',
        0,
        FALSE,
        'default',
        'Enterprise',
        'Enterprise membership plan with custom quotas and dedicated support.',
        '299',
        NULL,
        '29900',
        '365',
        'enterprise',
        '2',
        FALSE
    )
ON CONFLICT DO NOTHING;
