# PC Source Configuration

The PC renderer owns only its dev bind and runtime binding names. Public origins and API Base URLs
come from the repository deployment authority.

`pnpm workflow:materialize-client-env` derives `.env.<standalone|cloud>.<environment>` files in the PC root from
the parent deployment profiles. The derived files are safe build inputs, contain no live token, and
must not be edited directly. `pnpm check:client-env` verifies that all eight files match the authority.
