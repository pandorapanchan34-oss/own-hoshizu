// api/storage.js
// Vercel Functions + Upstash KV
// 環境変数に設定:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function kv(cmd, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${[cmd, ...args].map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const json = await res.json();
  return json.result;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { method } = req;

    // GET /api/storage?op=get&key=xxx
    // GET /api/storage?op=list&prefix=xxx
    if (method === 'GET') {
      const { op, key, prefix } = req.query;

      if (op === 'get') {
        const value = await kv('GET', key);
        return res.json({ key, value });
      }

      if (op === 'list') {
        // SCAN で prefix マッチ
        let cursor = 0;
        let keys = [];
        do {
          const result = await fetch(
            `${UPSTASH_URL}/scan/${cursor}/match/${encodeURIComponent((prefix || '') + '*')}/count/100`,
            { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
          ).then(r => r.json());
          cursor = result.result[0];
          keys = keys.concat(result.result[1]);
        } while (cursor !== '0' && keys.length < 500);
        return res.json({ keys });
      }
    }

    // POST /api/storage  body: { op, key, value }
    if (method === 'POST') {
      const { op, key, value } = req.body;

      if (op === 'set') {
        await kv('SET', key, value);
        return res.json({ key, value });
      }

      if (op === 'del') {
        await kv('DEL', key);
        return res.json({ key, deleted: true });
      }
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
