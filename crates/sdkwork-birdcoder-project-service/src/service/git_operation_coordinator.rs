use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};

#[derive(Clone, Default)]
pub(super) struct GitOperationCoordinator {
    project_locks: Arc<tokio::sync::Mutex<HashMap<String, Weak<tokio::sync::RwLock<()>>>>>,
}

impl GitOperationCoordinator {
    pub(super) async fn project_lock(&self, project_id: &str) -> Arc<tokio::sync::RwLock<()>> {
        let mut project_locks = self.project_locks.lock().await;
        project_locks.retain(|_, project_lock| project_lock.strong_count() > 0);
        if let Some(project_lock) = project_locks.get(project_id).and_then(Weak::upgrade) {
            return project_lock;
        }

        let project_lock = Arc::new(tokio::sync::RwLock::new(()));
        project_locks.insert(project_id.to_owned(), Arc::downgrade(&project_lock));
        project_lock
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::GitOperationCoordinator;

    #[tokio::test]
    async fn reuses_one_lock_for_the_same_project() {
        let coordinator = GitOperationCoordinator::default();
        let first = coordinator.project_lock("project-a").await;
        let second = coordinator.project_lock("project-a").await;

        assert!(Arc::ptr_eq(&first, &second));
    }

    #[tokio::test]
    async fn keeps_different_projects_independent() {
        let coordinator = GitOperationCoordinator::default();
        let first = coordinator.project_lock("project-a").await;
        let second = coordinator.project_lock("project-b").await;

        assert!(!Arc::ptr_eq(&first, &second));
        let _first_guard = first.write().await;
        assert!(second.try_write().is_ok());
    }

    #[tokio::test]
    async fn write_lock_blocks_intermediate_overview_reads() {
        let coordinator = GitOperationCoordinator::default();
        let project_lock = coordinator.project_lock("project-a").await;
        let write_guard = project_lock.write().await;

        assert!(project_lock.try_read().is_err());
        drop(write_guard);
        assert!(project_lock.try_read().is_ok());
    }
}
