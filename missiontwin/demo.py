"""One-command local demo launcher, offline by default after installing dependencies."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

from .domain import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=ROOT / 'data/synthetic')
    parser.add_argument('--adapter', choices=('directory', 'json-export'), default='directory')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-build', action='store_true', help='Use an already built web/dist')
    args = parser.parse_args()
    if not args.no_build:
        npm = shutil.which('npm')
        if not npm:
            parser.error('Install Node.js 20+ and run npm ci in web/ first')
        for command in ('typecheck', 'build'):
            subprocess.run([npm, 'run', command], cwd=ROOT / 'web', check=True)
    if not (ROOT / 'web/dist/index.html').exists():
        parser.error('web/dist is missing; run without --no-build')
    os.environ.update(MISSIONTWIN_DEMO_MODE='1', MISSIONTWIN_DATA=str(args.data.resolve()), MISSIONTWIN_ADAPTER=args.adapter)
    from .api import AppState, create_app
    import uvicorn
    state = AppState()
    health = state.sources()
    if health['configuration_errors'] or any(health['coverage'].values()):
        parser.error('Source preflight failed: ' + '; '.join(health['configuration_errors'] +
                     [s + ': ' + '; '.join(gaps) for s, gaps in health['coverage'].items() if gaps]))
    state.fc()
    live_davey = os.environ.get('LOCKER_DAVEY_LIVE') == '1'
    mode = 'Ask Davey live after submit' if live_davey else 'offline'
    print(f'LOCKER demo ({mode}): http://0.0.0.0:{args.port} | source {state.baseline.source_revision}', flush=True)
    print('Exercise-only decisions. No real source writes. ' +
          ('Ask Davey can call the configured model after a submitted question.' if live_davey else 'No external model calls.'),
          flush=True)
    uvicorn.run(create_app(state), host='0.0.0.0', port=args.port)


if __name__ == '__main__':
    main()
