import hashlib
import json

from missiontwin.normalize import REFERENCE_ROOT, checksum_matches, normalize


def test_reference_normalization_is_read_only_and_quarantines_unknowns(tmp_path):
    manifest_path = REFERENCE_ROOT / "manifest.json"
    before = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    result = normalize(output=tmp_path)
    assert result["activation"] == "REVIEW_ONLY"
    assert result["normalized_record_count"] > 6000
    assert result["quarantined_record_count"] > 0
    assert "TOWED" in result["reference_only_systems"]
    assert "VLS" in result["canonical_only_systems"]
    assert hashlib.sha256(manifest_path.read_bytes()).hexdigest() == before
    records = json.loads((tmp_path / "records.json").read_text())["records"]
    assert not any(record["forecast_eligible"] for record in records)
    assert not any(record["source"]["file"].startswith("validation/") for record in records)


def test_manifest_accepts_only_line_ending_equivalence(tmp_path):
    original = b"# SYNTHETIC\nship_id,quantity\r\nKESSLER,1\r\n"
    expected = hashlib.sha256(original).hexdigest()
    path = tmp_path / "fixture.csv"
    path.write_bytes(original.replace(b"\r\n", b"\n"))
    assert checksum_matches(path, expected)
    path.write_bytes(path.read_bytes().replace(b"KESSLER,1", b"KESSLER,2"))
    assert not checksum_matches(path, expected)