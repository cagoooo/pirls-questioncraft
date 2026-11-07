// 共用頁尾（設定頁、工作台）
const TEACHER_URL = 'https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5';

export function renderFooter() {
  const version = chrome.runtime.getManifest().version;
  const el = document.createElement('footer');
  el.className = 'site-footer';
  el.innerHTML = `
    <div class="wrap footer-inner">
      <div class="footer-brand">
        <img src="../icons/icon-128.png" alt="" width="48" height="48">
        <div><strong>PIRLS 閱讀題組小幫手</strong><span>截圖或反白文字，一鍵變成 PIRLS 四層次閱讀理解題組</span></div>
      </div>
      <ul class="footer-points">
        <li><span class="fp-icon" aria-hidden="true">🔑</span><div><strong>用自己的金鑰</strong><small>金鑰只存在這台電腦，只會送到 Google Gemini</small></div></li>
        <li><span class="fp-icon" aria-hidden="true">🤖</span><div><strong>AI 出題要人看過</strong><small>匯出前請逐題檢查題幹、選項與正解</small></div></li>
        <li><span class="fp-icon" aria-hidden="true">🛡️</span><div><strong>不要截個資</strong><small>免費方案的內容可能被 Google 用來改進產品</small></div></li>
      </ul>
      <nav class="footer-links" aria-label="快速連結">
        <a href="../workbench/workbench.html">📝 工作台</a>
        <a href="../options/options.html">⚙️ 設定與金鑰</a>
        <a href="https://cagoooo.github.io/pirls-questioncraft/" target="_blank" rel="noopener noreferrer">🌐 網站版</a>
      </nav>
    </div>
    <div class="wrap footer-bottom">
      <p class="site-credit">Made with <span class="site-credit__heart" aria-label="愛心">❤️</span> by
        <a href="${TEACHER_URL}" target="_blank" rel="noopener noreferrer" class="site-credit__author">阿凱老師</a>
        <span class="footer-school"><span class="footer-dot" aria-hidden="true">・</span>桃園市龍潭區石門國民小學</span></p>
      <p class="version-tag">v${version}</p>
    </div>`;
  document.body.appendChild(el);
}
