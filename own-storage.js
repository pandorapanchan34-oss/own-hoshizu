// own-storage.js
// window.storage（Artifact環境）と /api/storage（Vercel本番）を自動切り替え

const OwnStorage = (() => {

  // Artifact環境かどうか判定
  const isArtifact = typeof window.storage !== 'undefined';

  async function get(key, shared = false) {
    if (isArtifact) {
      try { return await window.storage.get(key, shared); } catch(e) { return null; }
    }
    // Vercel: personal/sharedの区別はキープレフィックスで管理
    const k = shared ? `shared:${key}` : `personal:${key}`;
    const res = await fetch(`/api/storage?op=get&key=${encodeURIComponent(k)}`);
    return res.ok ? await res.json() : null;
  }

  async function set(key, value, shared = false) {
    if (isArtifact) {
      try { return await window.storage.set(key, value, shared); } catch(e) { return null; }
    }
    const k = shared ? `shared:${key}` : `personal:${key}`;
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'set', key: k, value })
    });
    return res.ok ? await res.json() : null;
  }

  async function list(prefix = '', shared = false) {
    if (isArtifact) {
      try { return await window.storage.list(prefix, shared); } catch(e) { return { keys: [] }; }
    }
    const p = shared ? `shared:${prefix}` : `personal:${prefix}`;
    const res = await fetch(`/api/storage?op=list&prefix=${encodeURIComponent(p)}`);
    if (!res.ok) return { keys: [] };
    const data = await res.json();
    // キーからプレフィックスを除去して返す
    return { keys: (data.keys || []).map(k => k.replace(/^(shared:|personal:)/, '')) };
  }

  async function del(key, shared = false) {
    if (isArtifact) {
      try { return await window.storage.delete(key, shared); } catch(e) { return null; }
    }
    const k = shared ? `shared:${key}` : `personal:${key}`;
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'del', key: k })
    });
    return res.ok ? await res.json() : null;
  }

  return { get, set, list, del };
})();
