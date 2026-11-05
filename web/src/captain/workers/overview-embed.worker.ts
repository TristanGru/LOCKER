import { env, pipeline } from '@huggingface/transformers';

// Local-only, CPU/WASM. No CDN or remote-model fallback.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.useBrowserCache = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/wasm/';
  env.backends.onnx.wasm.numThreads = 1;
}
let extractor: any;
let corpusKey = '';
let vectors: number[][] = [];
let idle: ReturnType<typeof setTimeout>;
async function embed(texts: string[]): Promise<number[][]> {
  extractor ||= await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8', device: 'wasm' });
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  const rows = out.tolist() as number[][];
  if (rows.some(v => v.length !== 384 || v.some(n => !Number.isFinite(n)))) throw new Error('Invalid embedding vector');
  return rows;
}
self.onmessage = async (event) => {
  const { id, packetId, question, records } = event.data;
  try {
    if (typeof question !== 'string' || question.length > 1000 || records.length > 300) throw new Error('Embedding budget exceeded');
    const manifest = await fetch('/models/overview-manifest.json').then(r => { if (!r.ok) throw new Error('Model assets not bundled'); return r.json(); });
    if (manifest.model !== 'Xenova/all-MiniLM-L6-v2' || manifest.dimensions !== 384) throw new Error('Model manifest mismatch');
    clearTimeout(idle);
    if (corpusKey !== packetId) {
      const next: number[][] = [];
      for (let i = 0; i < records.length; i += 8) next.push(...await embed(records.slice(i, i + 8).map((r:any) => r.text.slice(0, 1600))));
      vectors = next; corpusKey = packetId;
    }
    const [query] = await embed([question]);
    const ranked = vectors.map((v, i) => ({ id: records[i].id, score: v.reduce((s, n, j) => s + n * query[j], 0) })).sort((a,b) => b.score-a.score).slice(0,6);
    self.postMessage({ id, ids: ranked.map(r => r.id) });
    idle = setTimeout(async () => { await extractor?.dispose(); extractor = undefined; vectors = []; corpusKey = ''; }, 300000);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
