# Flutter Source Configuration

Flutter build-time SDKWORK bindings are materialized from the repository deployment authority.
Tracked files contain no access tokens or secrets.

`pnpm config:materialize` derives all eight
`env/sdkwork.<standalone|cloud>.<development|test|staging|production>.json` files. Flutter commands
load the selected file with `--dart-define-from-file` and then set the exact iOS or Android runtime
target. Do not edit the derived JSON files directly; use `pnpm config:check` to detect drift.
