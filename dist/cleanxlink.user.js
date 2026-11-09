// ==UserScript==
// @name         CleanXLink
// @namespace    cleanxlink
// @version      1.1.0
// @description  Gỡ t.co trên X, bỏ tham số theo dõi và đổi link X/Bluesky/Reddit sang dạng embed (fxtwitter, fxbsky, vxreddit) khi copy.
// @match        https://x.com/*
// @match        https://*.x.com/*
// @match        https://twitter.com/*
// @match        https://*.twitter.com/*
// @match        https://bsky.app/*
// @match        https://reddit.com/*
// @match        https://*.reddit.com/*
// @match        https://facebook.com/*
// @match        https://*.facebook.com/*
// @match        https://instagram.com/*
// @match        https://*.instagram.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Đổi cài đặt: mở Console (F12) trên trang và chạy, ví dụ:
//   localStorage.cleanxlink = JSON.stringify({ xDomain: 'fixupx.com', style: 'g', translate: 'vi' })
// Các khoá: stripTracking, fixup, xDomain, style, translate, bsky, reddit (xem DEFAULTS bên dưới).

/*
 * CleanXLink — gỡ t.co + đổi link sang dạng embed (Fixups) khi copy
 *
 * Trên x.com / twitter.com:
 *  1. Hook fetch + XMLHttpRequest để đọc JSON API của X, lấy cặp
 *     { url: "https://t.co/xxx", expanded_url: "https://link-that" }.
 *  2. Theo dõi DOM, thay href t.co của thẻ <a> bằng link thật.
 *
 * Trên mọi trang được hỗ trợ (X, Bluesky, Reddit, Facebook, Instagram):
 *  3. Làm sạch clipboard khi copy (Ctrl+C, nút "Sao chép liên kết"...):
 *     - t.co -> link thật
 *     - bỏ tham số theo dõi (?s=&t=, mibextid, igsh, utm_*...)
 *     - Fixups: x.com -> fxtwitter.com / fixupx.com, bsky.app -> fxbsky.app,
 *       reddit.com -> vxreddit.com, kèm kiểu embed (d./g./t./m./i./o.) và dịch (/vi).
 *
 * Chạy trong "MAIN world" (extension) hoặc @grant none (userscript).
 * Cài đặt đọc từ attribute data-cxl-settings (do src/bridge.js ghi từ chrome.storage),
 * hoặc localStorage["cleanxlink"] (userscript), cuối cùng là DEFAULTS.
 */
(() => {
  'use strict';
  if (window.__cleanXLink) return;

  const DEFAULTS = {
    stripTracking: true,      // bỏ ?s=&t=, mibextid, igsh, utm_*...
    fixup: true,              // bật đổi link sang dạng embed
    xDomain: 'fxtwitter.com', // 'fxtwitter.com' | 'fixupx.com' | 'x.com' (giữ nguyên)
    style: '',                // '' | 'd' | 'g' | 't' | 'm' | 'i' | 'o'
    translate: '',            // '' | 'vi' | 'en' | 'ja' ...
    bsky: true,               // bsky.app -> fxbsky.app
    reddit: true,             // reddit.com -> vxreddit.com
    debug: false,
  };

  function settings() {
    let s = null;
    try {
      const attr = document.documentElement && document.documentElement.getAttribute('data-cxl-settings');
      if (attr) s = JSON.parse(attr);
    } catch (_) { /* ignore */ }
    if (!s) {
      try {
        const ls = window.localStorage && window.localStorage.getItem('cleanxlink');
        if (ls) s = JSON.parse(ls);
      } catch (_) { /* ignore */ }
    }
    return Object.assign({}, DEFAULTS, s || {});
  }

  const IS_X = /(^|\.)(x|twitter)\.com$/i.test(location.hostname);
  const TCO_TEST = /^https?:\/\/t\.co\/[A-Za-z0-9]+/i;
  const TCO_ALL = /https?:\/\/t\.co\/[A-Za-z0-9]+/gi;
  const URL_ALL = /https?:\/\/[^\s"'<>]+/gi;

  /** t.co code -> link thật */
  const map = new Map();
  const log = (...a) => settings().debug && console.debug('[CleanXLink]', ...a);

  const keyOf = (tco) => {
    const m = /t\.co\/([A-Za-z0-9]+)/i.exec(tco);
    return m ? m[1] : null;
  };

  /* ------------------------------------------------------------------ */
  /* Fixups: đổi link sang dạng embed + bỏ tham số theo dõi              */
  /* ------------------------------------------------------------------ */
  const STYLES = ['d', 'g', 't', 'm', 'i', 'o'];
  const TRACKING = {
    x: ['s', 't', 'ref_src', 'ref_url', 'src', 'ref'],
    reddit: [/^utm_/, 'share_id', 'rdt', 'ref', 'ref_source'],
    facebook: ['mibextid', 'fbclid', 'rdid', 'share_url', /^utm_/],
    instagram: ['igsh', 'igshid', 'img_index', /^utm_/],
    bsky: [/^utm_/],
  };

  function stripParams(u, list) {
    for (const p of [...u.searchParams.keys()]) {
      if (list.some((x) => (x instanceof RegExp ? x.test(p) : x === p))) u.searchParams.delete(p);
    }
  }

  const styled = (domain, style) => (STYLES.includes(style) ? style + '.' : '') + domain;

  function addTranslate(u, lang, postRe) {
    if (!lang || !/^[a-z]{2}(-[a-z]{2,4})?$/i.test(lang)) return;
    const path = u.pathname.replace(/\/+$/, '');
    if (postRe.test(path)) u.pathname = path + '/' + lang.toLowerCase();
  }

  function fixupUrl(raw, s = settings()) {
    let u;
    try { u = new URL(raw); } catch (_) { return raw; }
    const host = u.hostname.toLowerCase().replace(/^(www|mobile|m|old|new|np)\./, '');
    const path = u.pathname;

    // X / Twitter — chỉ link bài viết
    if ((host === 'x.com' || host === 'twitter.com') && /^\/[^/]+\/status\/\d+/.test(path)) {
      if (s.stripTracking) stripParams(u, TRACKING.x);
      if (s.fixup && s.xDomain && s.xDomain !== 'x.com') {
        u.hostname = styled(s.xDomain, s.style);
        addTranslate(u, s.translate, /^\/[^/]+\/status\/\d+$/);
      }
      return u.href;
    }

    // Bluesky — chỉ link bài viết
    if (host === 'bsky.app' && /^\/profile\/[^/]+\/post\/[^/]+/.test(path)) {
      if (s.stripTracking) stripParams(u, TRACKING.bsky);
      if (s.fixup && s.bsky) {
        u.hostname = styled('fxbsky.app', s.style);
        addTranslate(u, s.translate, /^\/profile\/[^/]+\/post\/[^/]+$/);
      }
      return u.href;
    }

    // Reddit — bài viết, link chia sẻ /s/, redd.it
    const isRedditPost = host === 'reddit.com' && /\/(comments|s)\//.test(path);
    const isReddIt = host === 'redd.it' && /^\/[A-Za-z0-9]+/.test(path);
    if (isRedditPost || isReddIt) {
      if (s.stripTracking) stripParams(u, TRACKING.reddit);
      if (s.fixup && s.reddit) u.hostname = 'vxreddit.com';
      return u.href;
    }

    // Facebook / Instagram — chỉ bỏ tham số theo dõi
    if (s.stripTracking) {
      if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) { stripParams(u, TRACKING.facebook); return u.href; }
      if (/(^|\.)instagram\.com$/.test(host)) { stripParams(u, TRACKING.instagram); return u.href; }
    }
    return raw;
  }

  /** Làm sạch một chuỗi văn bản (có thể chứa nhiều link) */
  function cleanText(text, { fixup = true } = {}) {
    if (typeof text !== 'string' || !text) return text;
    let out = text.replace(TCO_ALL, (m) => map.get(keyOf(m)) || m);
    if (!fixup) return out;
    const s = settings();
    return out.replace(URL_ALL, (m) => {
      // Tách dấu câu dính cuối link: "xem https://x.com/a/status/1)." -> giữ ")."
      const tail = /[).,!?;:\]}]+$/.exec(m);
      const core = tail ? m.slice(0, -tail[0].length) : m;
      return fixupUrl(core, s) + (tail ? tail[0] : '');
    });
  }

  /* ------------------------------------------------------------------ */
  /* 1. Thu thập cặp t.co -> expanded_url từ JSON (chỉ trên X)          */
  /* ------------------------------------------------------------------ */
  function harvest(root) {
    if (!root || typeof root !== 'object') return 0;
    const stack = [root];
    let added = 0;
    let guard = 0;
    while (stack.length && guard++ < 1_000_000) {
      const o = stack.pop();
      if (Array.isArray(o)) {
        for (const v of o) if (v && typeof v === 'object') stack.push(v);
        continue;
      }
      const u = o.url;
      const e = o.expanded_url;
      if (typeof u === 'string' && typeof e === 'string' && TCO_TEST.test(u) && !TCO_TEST.test(e)) {
        const k = keyOf(u);
        if (k && map.get(k) !== e) {
          map.set(k, e);
          added++;
        }
      }
      for (const k in o) {
        const v = o[k];
        if (v && typeof v === 'object') stack.push(v);
      }
    }
    if (added) {
      log('learned', added, 'links, total', map.size);
      scheduleScan();
    }
    return added;
  }

  const looksJson = (ct) => !ct || /json/i.test(ct);

  if (IS_X) {
    // fetch
    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (...args) {
        const p = origFetch.apply(this, args);
        p.then((res) => {
          try {
            if (looksJson(res.headers.get('content-type'))) {
              res.clone().json().then(harvest, () => {});
            }
          } catch (_) { /* ignore */ }
        }, () => {});
        return p;
      };
    }

    // XMLHttpRequest
    const XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (XHR) {
      const origSend = XHR.send;
      XHR.send = function (...args) {
        this.addEventListener('load', function () {
          try {
            if (!looksJson(this.getResponseHeader('content-type'))) return;
            let data = null;
            if (this.responseType === 'json') data = this.response;
            else if (this.responseType === '' || this.responseType === 'text') data = JSON.parse(this.responseText);
            if (data) harvest(data);
          } catch (_) { /* ignore */ }
        });
        return origSend.apply(this, args);
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Sửa href t.co của thẻ <a> (chỉ trên X)                           */
  /* ------------------------------------------------------------------ */
  // Lấy link từ chữ hiển thị (chỉ khi chữ là URL đầy đủ, không bị cắt "…")
  function fromText(text) {
    let t = (text || '').trim();
    if (!t || t.endsWith('…') || /\s/.test(t) || !t.includes('.')) return null;
    if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
    try {
      const u = new URL(t);
      return u.hostname === 't.co' ? null : u.href;
    } catch (_) {
      return null;
    }
  }

  function resolveAnchor(a) {
    const href = a.getAttribute('href');
    if (!href || !TCO_TEST.test(href)) return null;
    return map.get(keyOf(href)) || fromText(a.textContent);
  }

  function fixAnchor(a) {
    const real = resolveAnchor(a);
    if (!real) return false;
    a.setAttribute('data-cxl-tco', a.getAttribute('href'));
    a.setAttribute('href', real);
    return true;
  }

  function scan() {
    const list = document.querySelectorAll('a[href*="//t.co/"]');
    let n = 0;
    for (const a of list) if (fixAnchor(a)) n++;
    if (n) log('fixed', n, 'anchors');
  }

  let scanTimer = 0;
  function scheduleScan() {
    if (!IS_X || scanTimer || !document.documentElement) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 60);
  }

  if (IS_X) {
    const startObserver = () => {
      new MutationObserver(scheduleScan).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href'],
      });
      scheduleScan();
    };
    if (document.documentElement) startObserver();
    else document.addEventListener('readystatechange', startObserver, { once: true });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Làm sạch clipboard (mọi trang được hỗ trợ)                       */
  /* ------------------------------------------------------------------ */
  // navigator.clipboard.writeText (nút "Sao chép liên kết")
  try {
    const cb = navigator.clipboard;
    if (cb && typeof cb.writeText === 'function') {
      const origWrite = cb.writeText.bind(cb);
      cb.writeText = (t) => origWrite(cleanText(t));
    }
  } catch (_) { /* ignore */ }

  // DataTransfer.setData (khi trang tự set dữ liệu trong sự kiện copy)
  try {
    const DT = window.DataTransfer && window.DataTransfer.prototype;
    if (DT) {
      const origSetData = DT.setData;
      DT.setData = function (type, data) {
        if (/^(text\/plain|text)$/i.test(type)) data = cleanText(data);
        else if (/^text\/uri-list$/i.test(type)) data = cleanText(data);
        else if (/^text\/html$/i.test(type)) data = cleanText(data, { fixup: false });
        return origSetData.call(this, type, data);
      };
    }
  } catch (_) { /* ignore */ }

  // Ctrl+C thông thường / execCommand('copy')
  document.addEventListener('copy', (e) => {
    if (!e.clipboardData) return;
    const ae = document.activeElement;
    const isField = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') &&
      typeof ae.selectionStart === 'number';

    let text = '';
    if (isField) text = ae.value.slice(ae.selectionStart, ae.selectionEnd);
    else text = String(window.getSelection() || '');
    if (!text) return;

    const cleaned = cleanText(text);
    if (cleaned === text) return; // không có gì cần sửa -> để trình duyệt copy như bình thường

    e.clipboardData.setData('text/plain', cleaned);
    if (!isField) {
      const sel = window.getSelection();
      const box = document.createElement('div');
      for (let i = 0; i < sel.rangeCount; i++) box.appendChild(sel.getRangeAt(i).cloneContents());
      box.querySelectorAll('a[href*="//t.co/"]').forEach(fixAnchor);
      e.clipboardData.setData('text/html', box.innerHTML);
    }
    e.preventDefault();
  }, true);

  // Dữ liệu nhúng sẵn trong trang (nếu có)
  if (IS_X) {
    document.addEventListener('DOMContentLoaded', () => {
      try { if (window.__INITIAL_STATE__) harvest(window.__INITIAL_STATE__); } catch (_) { /* ignore */ }
      scheduleScan();
    });
  }

  // Mở cho console để debug: __cleanXLink.map, __cleanXLink.cleanText("..."), __cleanXLink.settings()
  Object.defineProperty(window, '__cleanXLink', {
    value: Object.freeze({ map, harvest, cleanText, fixupUrl, scan, settings, DEFAULTS }),
    configurable: false,
  });
})();
