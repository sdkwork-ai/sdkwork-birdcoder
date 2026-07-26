# PC Source Configuration

The PC renderer owns only its dev bind and runtime binding names. Public origins and API Base URLs
come from the repository deployment authority.

`pnpm config:materialize` derives `.env.<standalone|cloud>.<environment>` files in the PC root from
the parent deployment profiles. The derived files are safe build inputs, contain no live token, and
must not be edited directly. `pnpm config:check` verifies that all eight files match the authority.
