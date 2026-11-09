// Kiểm tra logic lõi bằng môi trường giả lập tối thiểu: node test/test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('../src/cleanxlink.js', import.meta.url), 'utf8');

function makeAnchor(href, text) {
  const attrs = { href };
  return {
    textContent: text,
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v; },
    attrs,
  };
}

function boot(hostname = 'x.com') {
  const anchors = [];
  const htmlAttrs = {};
  const document = {
    documentElement: {
      getAttribute: (k) => htmlAttrs[k] ?? null,
      setAttribute: (k, v) => { htmlAttrs[k] = v; },
    },
    activeElement: null,
    querySelectorAll: () => anchors.filter((a) => /\/\/t\.co\//.test(a.attrs.href)),
    addEventListener() {},
    createElement: () => ({ appendChild() {}, querySelectorAll: () => [], innerHTML: '' }),
  };
  const written = [];
  const window = { getSelection: () => '' };
  const ctx = {
    window, document,
    location: { hostname },
    navigator: { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve(); } } },
    MutationObserver: class { observe() {} },
    setTimeout: (f) => { f(); return 0; },
    URL, console,
  };
  vm.runInNewContext(code, ctx);
  const set = (s) => document.documentElement.setAttribute('data-cxl-settings', JSON.stringify(s));
  return { api: window.__cleanXLink, anchors, written, ctx, set };
}

/* ---------- t.co ---------- */
{
  const { api, anchors } = boot();
  const sample = { data: { tweet: { legacy: { entities: { urls: [
    { url: 'https://t.co/AbC123', expanded_url: 'https://example.com/very/long/path?q=1' },
  ] } } } } };
  anchors.push(makeAnchor('https://t.co/AbC123', 'example.com/very/long/pa…'));
  anchors.push(makeAnchor('https://t.co/NoMap1', 'github.com/foo'));
  anchors.push(makeAnchor('https://t.co/NoMap2', 'github.com/foo/bar/ba…'));

  assert.equal(api.harvest(sample), 1);
  api.scan();
  assert.equal(anchors[0].attrs.href, 'https://example.com/very/long/path?q=1');
  assert.equal(anchors[1].attrs.href, 'https://github.com/foo');
  assert.equal(anchors[2].attrs.href, 'https://t.co/NoMap2');
  assert.equal(api.cleanText('xem https://t.co/AbC123 nhé'), 'xem https://example.com/very/long/path?q=1 nhé');
  assert.equal(api.cleanText('https://t.co/Unknown'), 'https://t.co/Unknown');
}

/* ---------- Fixups: mặc định ---------- */
{
  const { api, written, ctx } = boot();
  const c = api.cleanText;
  assert.equal(c('https://x.com/jack/status/20?s=20&t=abcXYZ'), 'https://fxtwitter.com/jack/status/20');
  assert.equal(c('https://twitter.com/jack/status/20?lang=vi&s=46'), 'https://fxtwitter.com/jack/status/20?lang=vi');
  assert.equal(c('xem (https://x.com/a/status/1?s=20).'), 'xem (https://fxtwitter.com/a/status/1).');
  assert.equal(c('https://x.com/jack'), 'https://x.com/jack');                 // trang cá nhân: giữ nguyên
  assert.equal(c('https://bsky.app/profile/a.bsky.social/post/3k'), 'https://fxbsky.app/profile/a.bsky.social/post/3k');
  assert.equal(c('https://www.reddit.com/r/vn/comments/abc/t/?utm_source=share&utm_medium=web'), 'https://vxreddit.com/r/vn/comments/abc/t/');
  assert.equal(c('https://www.reddit.com/r/vn/s/XyZ'), 'https://vxreddit.com/r/vn/s/XyZ');
  assert.equal(c('https://redd.it/abc'), 'https://vxreddit.com/abc');
  assert.equal(c('https://www.facebook.com/share/p/1?mibextid=xyz'), 'https://www.facebook.com/share/p/1');
  assert.equal(c('https://www.instagram.com/p/C1/?igsh=abc'), 'https://www.instagram.com/p/C1/');
  assert.equal(c('https://google.com/?s=1'), 'https://google.com/?s=1');      // trang khác: không đụng
  await ctx.navigator.clipboard.writeText('https://x.com/a/status/1?s=20&t=zz');
  assert.equal(written.at(-1), 'https://fxtwitter.com/a/status/1');
}

/* ---------- Fixups: tuỳ chọn ---------- */
{
  const { api, set } = boot('bsky.app');
  set({ xDomain: 'fixupx.com', style: 'g', translate: 'vi' });
  assert.equal(api.cleanText('https://x.com/u/status/1?s=20'), 'https://g.fixupx.com/u/status/1/vi');
  assert.equal(api.cleanText('https://x.com/u/status/1/photo/1'), 'https://g.fixupx.com/u/status/1/photo/1');
  assert.equal(api.cleanText('https://bsky.app/profile/a/post/b'), 'https://g.fxbsky.app/profile/a/post/b/vi');

  set({ xDomain: 'x.com' });
  assert.equal(api.cleanText('https://x.com/u/status/1?s=20&t=a'), 'https://x.com/u/status/1');

  set({ fixup: false });
  assert.equal(api.cleanText('https://x.com/u/status/1?s=20'), 'https://x.com/u/status/1');
  assert.equal(api.cleanText('https://www.reddit.com/r/a/comments/b'), 'https://www.reddit.com/r/a/comments/b');

  set({ fixup: false, stripTracking: false });
  assert.equal(api.cleanText('https://x.com/u/status/1?s=20'), 'https://x.com/u/status/1?s=20');

  set({ reddit: false, bsky: false });
  assert.equal(api.cleanText('https://bsky.app/profile/a/post/b'), 'https://bsky.app/profile/a/post/b');
  assert.equal(api.cleanText('https://reddit.com/r/a/comments/b'), 'https://reddit.com/r/a/comments/b');
}

console.log('Tất cả test đều qua ✔');
