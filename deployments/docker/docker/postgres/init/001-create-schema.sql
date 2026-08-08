-- sdkwork-birdcoder standalone compose (deployments/docker/docker-compose.yml)
-- Creates the canonical workspace PostgreSQL schema used by the container.
-- The postgres image only creates the database from POSTGRES_DB; the
-- sdkwork-database lifecycle pins search_path to the same-named schema, so
-- the schema must exist before migrations run.
CREATE SCHEMA IF NOT EXISTS sdkwork_ai_test;
GRANT ALL ON SCHEMA sdkwork_ai_test TO sdkwork_ai_test;
