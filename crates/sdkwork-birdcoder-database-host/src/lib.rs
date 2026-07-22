use std::path::PathBuf;
use std::sync::Arc;

use sdkwork_database_config::DatabaseConfig;
use sdkwork_database_id::{
    NodeAllocatorConfig, NodeLease, SnowflakeIdGenerator, SnowflakeNodeAllocator,
};
use sdkwork_database_lifecycle::{lifecycle_options_from_env, LifecycleOrchestrator};
use sdkwork_database_spi::{DatabaseAssetProvider, DatabaseManifest, DefaultDatabaseModule};
use sdkwork_database_sqlx::{create_pool_from_config, DatabasePool};

const PROCESS_SERVICE_NAME: &str = "sdkwork-birdcoder";

#[derive(Clone)]
pub struct BirdcoderDatabaseHost {
    pool: DatabasePool,
    module: Arc<DefaultDatabaseModule>,
    id_generator: SnowflakeIdGenerator,
    node_lease: NodeLease,
}

impl BirdcoderDatabaseHost {
    pub fn pool(&self) -> &DatabasePool {
        &self.pool
    }

    pub fn module(&self) -> Arc<DefaultDatabaseModule> {
        self.module.clone()
    }

    pub fn id_generator(&self) -> &SnowflakeIdGenerator {
        &self.id_generator
    }

    pub fn node_lease(&self) -> &NodeLease {
        &self.node_lease
    }
}

pub async fn bootstrap_birdcoder_database(
    pool: DatabasePool,
) -> Result<BirdcoderDatabaseHost, String> {
    let app_root = resolve_app_root();
    let module = Arc::new(
        DefaultDatabaseModule::from_app_root(&app_root)
            .map_err(|error| format!("load birdcoder database module failed: {error}"))?,
    );
    let manifest = DatabaseManifest::from_file(module.manifest_path())
        .map_err(|error| format!("read birdcoder database manifest failed: {error}"))?;
    let options = lifecycle_options_from_env("BIRDCODER", &manifest);
    let orchestrator = LifecycleOrchestrator::new(pool.clone(), module.clone())
        .with_applied_by("sdkwork-birdcoder");

    orchestrator
        .init()
        .await
        .map_err(|error| format!("birdcoder database init failed: {error}"))?;

    if options.auto_migrate {
        orchestrator
            .migrate()
            .await
            .map_err(|error| format!("birdcoder database migrate failed: {error}"))?;
    }

    let allocator_config = NodeAllocatorConfig::from_service_name(PROCESS_SERVICE_NAME);
    let (id_generator, node_lease) =
        SnowflakeNodeAllocator::allocate_process_generator(&pool, &allocator_config)
            .await
            .map_err(|error| format!("allocate BirdCoder Snowflake node lease failed: {error}"))?;

    Ok(BirdcoderDatabaseHost {
        pool,
        module,
        id_generator,
        node_lease,
    })
}

pub async fn bootstrap_birdcoder_database_from_env() -> Result<BirdcoderDatabaseHost, String> {
    let _ = dotenvy::dotenv();
    let config = DatabaseConfig::from_env("BIRDCODER")
        .map_err(|error| format!("read birdcoder database config failed: {error}"))?;
    let pool = create_pool_from_config(config)
        .await
        .map_err(|error| format!("create birdcoder database pool failed: {error}"))?;
    bootstrap_birdcoder_database(pool).await
}

fn resolve_app_root() -> PathBuf {
    std::env::var("SDKWORK_BIRDCODER_APP_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../..")
                .canonicalize()
                .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."))
        })
}
