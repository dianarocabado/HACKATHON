from pipeline.common import HTTP_TIMEOUT_S, PROCESSED_DIR, RAW_DIR, ROOT


def test_data_dirs_live_under_repo_root():
    assert RAW_DIR.parent == PROCESSED_DIR.parent == ROOT / "data"


def test_timeout_matches_project_rule():
    assert HTTP_TIMEOUT_S == 8
