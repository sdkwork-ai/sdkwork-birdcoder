export const MAX_CONCURRENT_COMPOSER_ATTACHMENT_UPLOADS = 4;

export interface ComposerAttachmentUploadTask {
  readonly id: string;
  run(signal: AbortSignal): Promise<void>;
}

export class ComposerAttachmentUploadScheduler {
  readonly #activeControllers = new Map<string, AbortController>();
  readonly #maxConcurrentUploads: number;
  #pendingTasks: ComposerAttachmentUploadTask[] = [];

  constructor(maxConcurrentUploads = MAX_CONCURRENT_COMPOSER_ATTACHMENT_UPLOADS) {
    if (!Number.isSafeInteger(maxConcurrentUploads) || maxConcurrentUploads < 1) {
      throw new RangeError('Attachment upload concurrency must be a positive integer.');
    }
    this.#maxConcurrentUploads = maxConcurrentUploads;
  }

  get activeCount(): number {
    return this.#activeControllers.size;
  }

  get pendingCount(): number {
    return this.#pendingTasks.length;
  }

  enqueue(task: ComposerAttachmentUploadTask): void {
    this.cancel(task.id);
    this.#pendingTasks.push(task);
    this.#pump();
  }

  cancel(taskId: string): void {
    this.#pendingTasks = this.#pendingTasks.filter((task) => task.id !== taskId);
    this.#activeControllers.get(taskId)?.abort();
  }

  clear(): void {
    this.#pendingTasks = [];
    this.#activeControllers.forEach((controller) => controller.abort());
  }

  #pump(): void {
    while (
      this.#activeControllers.size < this.#maxConcurrentUploads
      && this.#pendingTasks.length > 0
    ) {
      const taskIndex = this.#pendingTasks.findIndex(
        (pendingTask) => !this.#activeControllers.has(pendingTask.id),
      );
      if (taskIndex < 0) {
        break;
      }
      const [task] = this.#pendingTasks.splice(taskIndex, 1);
      if (!task) {
        continue;
      }

      const controller = new AbortController();
      this.#activeControllers.set(task.id, controller);
      void Promise.resolve()
        .then(() => task.run(controller.signal))
        .catch(() => undefined)
        .finally(() => {
          if (this.#activeControllers.get(task.id) === controller) {
            this.#activeControllers.delete(task.id);
          }
          this.#pump();
        });
    }
  }
}
