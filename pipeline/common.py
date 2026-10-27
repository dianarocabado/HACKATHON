"""Shared paths and HTTP defaults for the data pipeline."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"

# Every external call has an 8-second timeout (see CLAUDE.md).
HTTP_TIMEOUT_S = 8

ATRAI_BASE = "https://api.atrai.bike"
BRIGHT_SKY_BASE = "https://api.brightsky.dev"
