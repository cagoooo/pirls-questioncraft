// 讀取這頁全文：先用 Mozilla Readability（Firefox 閱讀模式同一套）挑出正文，失敗再用最大文字區塊。
// 由背景程式在 vendor/Readability.js 之後注入；最後一個運算式的值會回傳給背景程式。
(() => {
  const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figcaption,tr,dt,dd,section,article,div';

  const tidy = (s) => s
    .replace(/ /g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 已解析（沒有版面）的 DOM 沒有 innerText，自己在區塊之間補換行
  function blocksToText(root) {
    root.querySelectorAll('script,style,noscript,figure img,svg').forEach((n) => n.remove());
    root.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    root.querySelectorAll(BLOCK).forEach((el) => {
      el.prepend('\n');
      el.append('\n');
    });
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => h.append('\n'));
    return tidy(root.textContent || '');
  }

  let title = document.title || '';
  let text = '';
  let method = '';

  try {
    if (typeof Readability === 'function') {
      const article = new Readability(document.cloneNode(true), { charThreshold: 200, keepClasses: false }).parse();
      if (article?.content) {
        const parsed = new DOMParser().parseFromString(article.content, 'text/html');
        text = blocksToText(parsed.body);
        title = (article.title || title).trim();
        method = 'readability';
      }
    }
  } catch (e) {
    console.warn('[PIRLS] Readability 失敗：', e);
  }

  if (text.length < 200) {
    // 備用：<article>／<main>／字最多的區塊
    const candidates = [...document.querySelectorAll('article, main, [role=main], .post, .entry-content, .article-content, #content')];
    const pick = candidates.sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
    const fallback = tidy(pick.innerText || '');
    if (fallback.length > text.length) {
      text = fallback;
      method = 'fallback';
    }
  }

  return { title, text, method, url: location.href };
})();
