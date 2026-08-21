# BirdCoder topology profiles

Authoritative profile env files for `specs/topology.spec.json` (`schemaVersion: 5`).

Pattern: `{deploymentProfile}.{environment}.env`

| Profile id | File |
| --- | --- |
| `standalone.development` | `standalone.development.env` |
| `standalone.test` | `standalone.test.env` |
| `standalone.staging` | `standalone.staging.env` |
| `standalone.production` | `standalone.production.env` |
| `cloud.development` | `cloud.development.env` |
| `cloud.test` | `cloud.test.env` |
| `cloud.staging` | `cloud.staging.env` |
| `cloud.production` | `cloud.production.env` |

Retired `hosting` / `serviceLayout` tokens are not used.

Validate:

```bash
node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root . --spec specs/topology.spec.json
```
