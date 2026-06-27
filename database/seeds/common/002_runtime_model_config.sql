-- seed: runtime_model_config
-- Language-neutral default model catalog (gpt-4o, claude-3-5-sonnet, gemini-pro).
-- Portable idempotent upsert: INSERT ... ON CONFLICT DO NOTHING (SQLite 3.24+ and PostgreSQL).

INSERT INTO runtime_model_config
    (id, tenant_id, organization_id, config_key, config_json, schema_version, source, updated_at, created_at)
VALUES
    (
        'gpt-4o',
        0,
        0,
        'gpt-4o',
        '{"provider":"openai","model_id":"gpt-4o","context_window":128000,"max_tokens":16384,"cost_per_1k_input":0.005,"cost_per_1k_output":0.015}',
        1,
        'server',
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z'
    ),
    (
        'claude-3-5-sonnet',
        0,
        0,
        'claude-3-5-sonnet',
        '{"provider":"anthropic","model_id":"claude-3-5-sonnet","context_window":200000,"max_tokens":8192,"cost_per_1k_input":0.003,"cost_per_1k_output":0.015}',
        1,
        'server',
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z'
    ),
    (
        'gemini-pro',
        0,
        0,
        'gemini-pro',
        '{"provider":"google","model_id":"gemini-pro","context_window":32768,"max_tokens":8192,"cost_per_1k_input":0.0005,"cost_per_1k_output":0.0015}',
        1,
        'server',
        '2026-06-26T00:00:00Z',
        '2026-06-26T00:00:00Z'
    )
ON CONFLICT DO NOTHING;
