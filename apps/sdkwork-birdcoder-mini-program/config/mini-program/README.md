# Mini Program Runtime Profiles

`runtime-env.<standalone|cloud>.<development|test|staging|production>.json` files are generated from the repository deployment authority by `node ../../../scripts/birdcoder-client-env.mjs --surface miniProgram`. They are public runtime inputs, contain no token or secret, and must not be edited directly.
