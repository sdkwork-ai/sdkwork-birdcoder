# BirdCoder topology profiles

Authoritative profile env files for `specs/topology.spec.json`.

Pattern: `{hosting}.{serviceLayout}.{environment}.env`

Validate:

```bash
node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root . --spec specs/topology.spec.json
```
