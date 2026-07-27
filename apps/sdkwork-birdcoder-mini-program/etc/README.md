# Mini Program Source Configuration

This application root delegates public endpoint topology to `../../../etc/sdkwork.deployment.config.json` and `../../../specs/topology.spec.json`.

`node ../../../scripts/birdcoder-client-env.mjs --surface miniProgram` generates eight public runtime inputs under `config/mini-program/` for:

- `standalone.development`, `standalone.test`, `standalone.staging`, `standalone.production`
- `cloud.development`, `cloud.test`, `cloud.staging`, `cloud.production`

The generated JSON files contain deployment identity and public endpoint URLs only. WeChat credentials and developer-local configuration are not source configuration.
