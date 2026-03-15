// api/seed.js
// 使い方:
//   https://own-hoshizu.vercel.app/api/seed?token=YOUR_SEED_TOKEN
//
// 環境変数:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   SEED_TOKEN          ← 自分で決めた合言葉
//   SEED_COUNT          ← 投入数（省略時500）

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SEED_TOKEN    = process.env.SEED_TOKEN;
const SEED_COUNT    = parseInt(process.env.SEED_COUNT || '500');
const SEED_DONE_KEY = 'shared:own_seed_done'; // 実行済みフラグ

async function kvSet(key, value) {
  const res = await fetch(
    `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
  );
  return res.json();
}

async function kvGet(key) {
  const res = await fetch(
    `${UPSTASH_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
  );
  const json = await res.json();
  return json.result;
}

// ── 名前プール ──
const jpNames = [
  'しずか','はるか','みなと','そら','ゆき','あかり','ひびき','なつめ','こころ','いずみ',
  'たける','りく','かいと','ゆうま','れん','あおい','つむぎ','ことは','みお','さくら',
  'ひなた','のぞみ','まひろ','いちか','ゆいな','りお','かなで','みずき','ほのか','あやね',
  'けいた','しょうた','りょう','だいき','まさき','ゆうき','こうた','たいき','はると','あきら',
  'みらい','ふうか','ちひろ','えま','りな','まな','るか','ひろ','なお','きら',
  'せな','いお','らん','ゆな','めい','あん','ねね','ももか','ここあ','れいな',
  'とわ','はな','つばさ','しおり','あすか','かほ','のの','ゆめ','まつり','すず',
  'けんと','そうた','ゆうと','りんた','かずき','のぶ','たつや','しんじ','まもる','いさむ',
  'みく','えり','さやか','まいこ','ゆかり','あやか','みほ','のりこ','ふみ','よしこ',
  'さとみ','はるみ','あきこ','みつえ','かずこ','すみこ','ちか','なみ','まき','あい',
];

const enPrefixes = [
  'Nova','Echo','Drift','Kira','Lux','Veil','Arc','Flux','Orb','Zeno',
  'Myth','Haze','Byte','Prism','Wren','Sable','Fern','Rune','Cael','Tyne',
  'Lyra','Crest','Dusk','Helm','Jax','Knox','Lark','Nox','Orin','Stel',
  'Rime','Tide','Weft','Yore','Zeal','Aeon','Brin','Coda','Dyne','Edda',
];

const enSuffixes = [
  '_7','_k','.x','_0','.9','_21','_4','_5','_2','_m',
  '.7','-x','_39','.3','_11','_8','-k','_01','.0','_v2',
];

function randomName(i) {
  const r = i % 3;
  if (r === 0) {
    return jpNames[Math.floor(Math.random() * jpNames.length)];
  } else if (r === 1) {
    return enPrefixes[Math.floor(Math.random() * enPrefixes.length)]
         + enSuffixes[Math.floor(Math.random() * enSuffixes.length)];
  } else {
    return jpNames[Math.floor(Math.random() * jpNames.length)]
         + Math.floor(Math.random() * 99);
  }
}

function randNormal(mean, std) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.min(100, Math.round(mean + std * n)));
}

function randomFobs() {
  return {
    frontier: randNormal(55, 20),
    order:    randNormal(50, 22),
    bond:     randNormal(45, 20),
    sense:    randNormal(60, 18),
  };
}

function calcMbti(f) {
  return (f.bond     < 50 ? 'I':'E')
       + (f.sense    > 50 ? 'N':'S')
       + (f.frontier > 50 ? 'T':'F')
       + (f.order    < 50 ? 'P':'J');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // トークン確認
  const { token } = req.query;
  if (!SEED_TOKEN || token !== SEED_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 実行済みチェック
  const done = await kvGet(SEED_DONE_KEY);
  if (done) {
    return res.status(200).json({
      message: `既に実行済みです（${done}）`,
      skipped: true
    });
  }

  // ダミー投入
  let success = 0;
  const errors = [];

  for (let i = 0; i < SEED_COUNT; i++) {
    const fobs = randomFobs();
    const x    = Math.round((fobs.frontier + fobs.order) / 2);
    const y    = Math.round((fobs.bond     + fobs.sense) / 2);
    const star = {
      name:  randomName(i),
      x, y,
      size:  fobs.order,
      color: fobs.sense,
      fobs,
      vis:   'public',
      mbti:  calcMbti(fobs),
      dummy: true,
      ts:    Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
    };

    const key = `shared:own_dummy_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    try {
      await kvSet(key, JSON.stringify(star));
      success++;
    } catch(e) {
      errors.push(e.message);
    }
  }

  // 実行済みフラグを立てる（ワンタイム）
  await kvSet(SEED_DONE_KEY, new Date().toISOString());

  return res.status(200).json({
    message: `完了: ${success} / ${SEED_COUNT} 個投入しました`,
    success,
    errors: errors.slice(0, 5),
  });
}
