"""Build and run browser acceptance tests against an isolated, disposable API."""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    npm = shutil.which('npm')
    if not npm:
        raise SystemExit('Install Node.js 20+ and run npm ci in web/ first.')
    for task in ('typecheck', 'build'):
        subprocess.run([npm, 'run', task], cwd=ROOT / 'web', check=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='locker-acceptance-') as temp:
        scratch = Path(temp)
        data = scratch / 'data'
        shutil.copytree(ROOT / 'data/synthetic', data)
        env = {**os.environ, 'MISSIONTWIN_DATA': str(data), 'MISSIONTWIN_ADAPTER': 'directory',
               'MISSIONTWIN_ACTIVITY_LOG': str(scratch / 'activity.jsonl'), 'MISSIONTWIN_DEMO_MODE': '1',
               'LOCKER_DAVEY_LIVE': '0',
               'LOCKER_URL': f'http://127.0.0.1:{port}', 'LOCKER_TEST_DATA': str(data)}
        log = scratch / 'server.log'
        with log.open('w', encoding='utf-8') as output:
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'missiontwin.api:app',
                                        '--host', '127.0.0.1', '--port', str(port)],
                                       cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 120
            while True:
                try:
                    with urllib.request.urlopen(env['LOCKER_URL'] + '/api/ready', timeout=5) as response:
                        if response.status == 200:
                            break
                except (urllib.error.URLError, TimeoutError):
                    pass
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Isolated API failed readiness:\n' + log.read_text(encoding='utf-8'))
                time.sleep(.5)
            # The demo launcher evaluates a forecast before opening the browser.
            # Prewarm the isolated API too so cold graph imports do not consume a
            # browser assertion's deadline on the first page load.
            try:
                with urllib.request.urlopen(env['LOCKER_URL'] + '/api/dashboard', timeout=90) as response:
                    if response.status != 200:
                        raise RuntimeError(f'Initial dashboard returned HTTP {response.status}')
            except (urllib.error.URLError, TimeoutError) as error:
                raise RuntimeError('Isolated API failed initial dashboard:\n' + log.read_text(encoding='utf-8')) from error
            print(f'Acceptance API: {env["LOCKER_URL"]} (temporary sources and activity log)', flush=True)
            if len(sys.argv) > 1:
                browser = [npm, 'run', 'test:e2e', '--', *sys.argv[1:]]
                subprocess.run(browser, cwd=ROOT / 'web', env=env, check=True)
            else:
                # Release browser WebGL and local embedding workers between specs;
                # otherwise they can compete with the API's fix ranking work.
                for spec in sorted((ROOT / 'web/tests').glob('*.spec.ts')):
                    print(f'Browser acceptance: {spec.name}', flush=True)
                    subprocess.run([npm, 'run', 'test:e2e', '--', spec.name],
                                   cwd=ROOT / 'web', env=env, check=True)
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()


if __name__ == '__main__':
    main()
