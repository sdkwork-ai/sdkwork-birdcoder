export const SDKWORK_IAM_WORKSPACE_REL = '../sdkwork-iam';
export const SDKWORK_APPBASE_WORKSPACE_REL = '../sdkwork-appbase';

export const IAM_APP_SDK_REL =
  'sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi/src/index.ts';
export const IAM_BACKEND_SDK_REL =
  'sdks/sdkwork-iam-backend-sdk/sdkwork-iam-backend-sdk-typescript/generated/server-openapi/src/index.ts';

export const IAM_CONTRACTS_INDEX_REL =
  'apps/sdkwork-iam-common/packages/sdkwork-iam-contracts/src/index.ts';
export const IAM_RUNTIME_INDEX_REL =
  'apps/sdkwork-iam-common/packages/sdkwork-iam-runtime/src/index.ts';
export const IAM_SERVICE_INDEX_REL =
  'apps/sdkwork-iam-common/packages/sdkwork-iam-service/src/index.ts';
export const IAM_SDK_PORTS_INDEX_REL =
  'apps/sdkwork-iam-common/packages/sdkwork-iam-sdk-ports/src/index.ts';

export const IAM_AUTH_RUNTIME_PC_REACT_INDEX_REL =
  'apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/index.ts';
export const IAM_AUTH_PC_REACT_ROOT_REL = 'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react';
export const IAM_USER_PC_REACT_ROOT_REL = 'apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react';

export function joinIamWorkspacePath(...segments) {
  return [SDKWORK_IAM_WORKSPACE_REL, ...segments].join('/');
}
