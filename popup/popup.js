const api = typeof browser !== 'undefined' ? browser : chrome;
const KEYS = ['stripTracking', 'fixup', 'xDomain', 'style', 'translate', 'bsky', 'reddit'];
const el = (id) => document.getElementById(id);
const read = (id) => (el(id).type === 'checkbox' ? el(id).checked : el(id).value);
const write = (id, v) => { if (el(id).type === 'checkbox') el(id).checked = !!v; else el(id).value = v; };

function preview() {
  const s = Object.fromEntries(KEYS.map((k) => [k, read(k)]));
  const id = '1830000000000000000';
  let host = 'x.com';
  let path = `/fxembed/status/${id}`;
  if (s.fixup && s.xDomain !== 'x.com') {
    host = (s.style ? s.style + '.' : '') + s.xDomain;
    if (s.translate) path += '/' + s.translate;
  }
  const q = s.stripTracking ? '' : '?s=20&t=abc';
  el('out').textContent = `https://${host}${path}${q}`;
  const xOn = s.fixup;
  ['xDomain', 'style', 'translate', 'bsky', 'reddit'].forEach((k) => (el(k).disabled = !xOn));
}

api.storage.sync.get(null, (saved) => {
  for (const k of KEYS) if (saved && k in saved) write(k, saved[k]);
  preview();
});

for (const k of KEYS) {
  el(k).addEventListener('change', () => {
    api.storage.sync.set({ [k]: read(k) });
    preview();
  });
}
