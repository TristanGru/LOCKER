"""Explicit connected-machine setup; runtime never downloads models.

Downloads Xenova/all-MiniLM-L6-v2 at a resolved immutable revision and copies
Transformers.js' matching WASM assets. Generated assets are ignored by Git.
Run with the project Python after npm ci in web/; then rebuild the frontend.
"""
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MODEL = 'Xenova/all-MiniLM-L6-v2'
FILES = ['README.md', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']
# Immutable Hugging Face revision for the model and tokenizer artifacts.
REVISION = '751bff37182d3f1213fa05d7196b954e230abad9'


def main():
    target = ROOT / 'web/public/models' / MODEL
    target.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for name in FILES:
        path = target / name
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f'https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}'
        print('Downloading', name, flush=True)
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        temp = path.with_suffix(path.suffix + '.tmp')
        temp.write_bytes(data)
        temp.replace(path)
        hashes[name] = hashlib.sha256(data).hexdigest()
    wasm = ROOT / 'web/public/wasm'
    wasm.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'web/node_modules/@huggingface/transformers/dist'
    for name in ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']:
        shutil.copy2(source / name, wasm / name)
        hashes['wasm/' + name] = hashlib.sha256((wasm / name).read_bytes()).hexdigest()
    shutil.copy2(source.parent / 'LICENSE', target.parent / 'TRANSFORMERS-LICENSE.txt')
    runtime_license = ROOT / 'web/node_modules/onnxruntime-web/LICENSE'
    if runtime_license.exists():
        shutil.copy2(runtime_license, wasm / 'ONNX-RUNTIME-LICENSE.txt')
    manifest = {'model': MODEL, 'revision': REVISION, 'dtype': 'q8', 'pooling': 'mean', 'normalize': True,
                'dimensions': 384, 'transformers_js': '3.8.1', 'sha256': hashes}
    (ROOT / 'web/public/models/overview-manifest.json').write_text(json.dumps(manifest, indent=2))
    print('Local embedding assets ready. Run npm --prefix web run build.')


if __name__ == '__main__':
    main()
