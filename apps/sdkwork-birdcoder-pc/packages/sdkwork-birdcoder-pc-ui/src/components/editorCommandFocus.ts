let activeEditorCommandTarget: object | null = null;

export function claimEditorCommandTarget(target: object): void {
  activeEditorCommandTarget = target;
}

export function releaseEditorCommandTarget(target: object): void {
  if (activeEditorCommandTarget === target) {
    activeEditorCommandTarget = null;
  }
}

export function ownsEditorCommandTarget(target: object): boolean {
  return activeEditorCommandTarget === target;
}
