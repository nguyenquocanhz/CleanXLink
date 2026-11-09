// Chạy trong isolated world: đưa cài đặt từ chrome.storage sang script MAIN world
// qua attribute data-cxl-settings trên <html>.
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const push = (s) => {
    const el = document.documentElement;
    if (el) el.setAttribute('data-cxl-settings', JSON.stringify(s || {}));
  };
  const load = () => api.storage.sync.get(null, push);
  load();
  api.storage.onChanged.addListener((_, area) => area === 'sync' && load());
})();
