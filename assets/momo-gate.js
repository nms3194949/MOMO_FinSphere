/*!
 * MOMO財商智庫｜自用工具密碼頁 assets/momo-gate.js
 * 放在自用頁面 <head> 的最前面（不要加 defer / async）：
 *   <script src="/MOMO_FinSphere/assets/momo-gate.js"></script>
 *
 * - 輸入密碼後，這台裝置記住 30 天（存在瀏覽器 localStorage）
 * - 更換密碼：開「自用工具」首頁 → 最下方「更換密碼」產生新的 HASH，貼到下面那一行
 * - 注意：這是前端密碼，用來擋一般人；repo 是公開的，原始碼在 GitHub 上仍看得到
 */
(function () {
  'use strict';

  // ▼ 密碼的 SHA-256（計算方式：sha256('momo-gate:' + 密碼)）
  var HASH = '3b62b60d000992260777b9381ce9e59828ffa7202f65e7f98a0b3975745c74b1';
  // ▲
  var SALT = 'momo-gate:';
  var KEY = 'momo_gate_v1';
  var DAYS = 30;

  window.__momoPrivate = true; // 讓 momo-site.js 知道這是自用頁：不送 GA、不加公開頁尾

  // 不讓搜尋引擎收錄
  var m = document.createElement('meta');
  m.name = 'robots'; m.content = 'noindex,nofollow';
  document.head.appendChild(m);

  function ok() {
    try {
      var t = JSON.parse(localStorage.getItem(KEY) || 'null');
      return t && t.h === HASH && t.exp > Date.now();
    } catch (e) { return false; }
  }

  window.momoGateLogout = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };

  window.momoGateHash = function (pw) {
    var data = new TextEncoder().encode(SALT + pw);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  };

  if (ok()) return;

  // 未登入：先藏起整頁內容
  var hide = document.createElement('style');
  hide.id = 'momo-gate-hide';
  hide.textContent = 'html{visibility:hidden!important;background:#f6f1e7!important}' +
    '#momo-gate{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:#f6f1e7;font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;color:#0c152a}' +
    '#momo-gate *{box-sizing:border-box}' +
    '#momo-gate .g-box{width:100%;max-width:340px;background:#fffdf8;border:1px solid #e4dccb;border-radius:16px;padding:28px 22px;text-align:center}' +
    '#momo-gate img{width:56px;height:56px;border-radius:50%;display:block;margin:0 auto 10px}' +
    '#momo-gate h1{font-size:19px;margin:0 0 4px}' +
    '#momo-gate p{margin:0 0 16px;color:#7a8296;font-size:14px}' +
    '#momo-gate input{width:100%;padding:12px 14px;border:1px solid #e4dccb;border-radius:10px;font-size:16px;background:#fff;color:#0c152a}' +
    '#momo-gate input:focus{outline:2px solid #d2c696;border-color:#d2c696}' +
    '#momo-gate button{width:100%;margin-top:10px;padding:12px;border:0;border-radius:999px;background:#0c152a;color:#fffdf8;font-size:16px;font-weight:700;cursor:pointer}' +
    '#momo-gate .g-err{color:#b4562b;font-size:14px;min-height:22px;margin-top:8px}';
  document.head.appendChild(hide);

  function mount() {
    if (document.getElementById('momo-gate')) return;
    var g = document.createElement('div');
    g.id = 'momo-gate';
    g.innerHTML =
      '<form class="g-box" autocomplete="on">' +
        '<img src="/icon-192.png" alt="">' +
        '<h1>MOMO專用工具</h1>' +
        '<p>請輸入密碼（這台裝置會記住 ' + DAYS + ' 天）</p>' +
        '<input type="password" name="password" autocomplete="current-password" placeholder="密碼" required autofocus>' +
        '<button type="submit">進入</button>' +
        '<div class="g-err" aria-live="polite"></div>' +
      '</form>';
    document.body.appendChild(g);
    var form = g.querySelector('form'), input = g.querySelector('input'), err = g.querySelector('.g-err');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.momoGateHash(input.value).then(function (h) {
        if (h === HASH) {
          try { localStorage.setItem(KEY, JSON.stringify({ h: HASH, exp: Date.now() + DAYS * 864e5 })); } catch (x) {}
          g.remove(); hide.remove();
          window.dispatchEvent(new Event('resize')); // 讓圖表重新計算尺寸
        } else {
          err.textContent = '密碼不正確';
          input.select();
        }
      });
    });
    setTimeout(function () { input.focus(); }, 50);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
