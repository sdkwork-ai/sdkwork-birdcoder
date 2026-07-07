#!/usr/bin/env python3
"""Wrap commerce repository sqlx::query literals with any_sql()."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "crates/sdkwork-birdcoder-commerce-repository-sqlx/src/repository/sqlite_commerce_repository.rs"


def main() -> None:
    source = PATH.read_text(encoding="utf-8")
    updated = source

    def wrap_match(match: re.Match[str]) -> str:
        inner = match.group(1)
        if inner.startswith("&any_sql("):
            return match.group(0)
        return f"sqlx::query(&any_sql({inner}))"

    updated = re.sub(
        r"sqlx::query\((\"(?:\\.|[^\"])*\")\)",
        wrap_match,
        updated,
        flags=re.DOTALL,
    )
    updated = re.sub(
        r"sqlx::query\(\s*\n\s*(\"(?:\\.|[^\"])*\")\s*\n\s*\)",
        lambda m: f"sqlx::query(&any_sql(\n            {m.group(1)}\n        ))",
        updated,
        flags=re.DOTALL,
    )

    if updated != source:
        PATH.write_text(updated, encoding="utf-8")
        print("updated commerce any_sql wrappers")
    else:
        print("no commerce changes")


if __name__ == "__main__":
    main()
