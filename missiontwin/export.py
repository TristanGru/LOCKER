"""Produce a replacement synthetic JSON export without modifying canonical inputs."""
import argparse
import csv
import json
from pathlib import Path
import shutil

from .domain import DATA_DIR
from .sources import DirectoryAdapter


def export_json(source: Path, output: Path):
    source, output = source.resolve(), output.resolve()
    if output.exists() or source == output or source in output.parents:
        raise ValueError('Output must be a new directory outside the source tree')
    output.mkdir(parents=True)
    try:
        DirectoryAdapter().stage(source, output)
        for path in output.rglob('*.csv'):
            lines = path.read_text(encoding='utf-8-sig').splitlines()
            if not lines:
                raise ValueError(f'Empty dataset in export: {path}')
            # The synthetic banner line is optional in the current data contract.
            reader = csv.DictReader(lines[1:] if lines[0].startswith('#') else lines)
            path.with_suffix('.csv.json').write_text(json.dumps({'columns': reader.fieldnames, 'rows': list(reader)}, indent=2), encoding='utf-8')
            path.unlink()
    except Exception:
        shutil.rmtree(output)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DATA_DIR)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    export_json(args.source, args.output)
    print(f'Replacement export: {args.output.resolve()} (use MISSIONTWIN_ADAPTER=json-export)')


if __name__ == '__main__':
    main()
