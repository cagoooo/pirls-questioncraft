// /extension/：Chrome 擴充套件「PIRLS 閱讀題組小幫手」下載與圖文安裝說明
// ZIP 由 tools/pack-extension.mjs 在建置時產生到 public/extension/；截圖由 tools/capture-extension-guide.py 產生。
import type { Metadata } from 'next';
import Link from 'next/link';
import manifest from '../../../extension/manifest.json';
import changelog from '../../../extension/CHANGELOG.json';
import { NeoCard } from '@/components/Neo';
import { PirlsLogo } from '@/components/PirlsLogo';

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const ZIP = `${base}/extension/pirls-helper-extension.zip`;
const img = (name: string) => `${base}/extension/img/${name}.webp`;
const TEACHER_URL = 'https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5';

export const metadata: Metadata = {
  title: 'PIRLS 閱讀題組小幫手｜Chrome 擴充套件下載與安裝',
  description: '在任何網頁截圖、讀取全文或反白文字，用自己的免費 Gemini 金鑰產生 PIRLS 閱讀理解題組，一鍵送到 PaGamO 批量上傳。',
};

const pill = 'inline-flex items-center justify-center gap-2 border-neo rounded-full font-bold shadow-neo-sm neo-press hover:-translate-y-px hover:shadow-neo text-ink no-underline';

function Shot({ name, alt, className = '' }: { name: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img(name)} alt={alt} loading="lazy" className={`block w-full h-auto rounded-2xl border-neo shadow-neo bg-white ${className}`} />
  );
}

function Step({ n, title, children, shot }: { n: number; title: string; children: React.ReactNode; shot?: React.ReactNode }) {
  return (
    <li className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-lemon border-neo font-extrabold text-lg shrink-0">{n}</span>
          <h3 className="text-xl font-extrabold">{title}</h3>
        </div>
        <div className="mt-3 text-[1.0625rem] leading-8 text-ink/90 space-y-2">{children}</div>
      </div>
      {shot}
    </li>
  );
}

export default function ExtensionGuidePage() {
  const latest = changelog[0];
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto w-full max-w-[min(1560px,94vw)] px-4 sm:px-8 py-6">
        {/* 頁首 */}
        <nav className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="flex items-center gap-3 no-underline text-ink">
            <span className="w-11 h-11 rounded-xl bg-cream border-neo p-1 overflow-hidden shrink-0"><PirlsLogo className="w-full h-full" /></span>
            <span className="font-extrabold leading-tight">QuestionCraft PRO<br /><span className="text-[0.875rem] font-medium text-muted-foreground">PIRLS 閱讀理解生成站</span></span>
          </Link>
          <Link href="/" className={`${pill} bg-card px-4 py-2 text-[0.9375rem]`}>← 回網站版</Link>
        </nav>

        {/* Hero */}
        <NeoCard className="mt-6 px-6 sm:px-10 py-8 sm:py-10 relative overflow-hidden">
          <div aria-hidden className="hidden md:block absolute -top-14 -right-10 w-56 h-56 rounded-full bg-peach opacity-50" />
          <div aria-hidden className="hidden md:block absolute -bottom-16 right-40 w-36 h-36 rounded-full bg-sky opacity-50" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] items-center">
            <div>
              <p className="inline-flex items-center gap-2 bg-lemon border-neo rounded-full px-3 py-1 text-[0.875rem] font-extrabold">🧩 Chrome 擴充套件　v{manifest.version}</p>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight">PIRLS 閱讀題組小幫手</h1>
              <p className="mt-4 text-lg leading-8">在任何網頁<b>截圖</b>、<b>讀取全文</b>或<b>反白文字</b>，用自己的免費 Gemini 金鑰，一分鐘產生 PIRLS 四層次閱讀理解題組，檢查後<b>一鍵送到 PaGamO</b>。</p>
              <div id="download" className="mt-6 flex flex-wrap gap-3">
                <a href={ZIP} download className={`${pill} bg-sage px-6 py-3.5 text-[1.125rem]`}>⬇️ 下載擴充套件（ZIP）</a>
                <a href="#install" className={`${pill} bg-card px-5 py-3.5 text-[1.0625rem]`}>📘 看安裝步驟</a>
              </div>
              <p className="mt-3 text-[0.9375rem] text-muted-foreground">免費・不用登入・金鑰只存在自己的電腦｜最後更新 {latest.date}</p>
            </div>
            <Shot name="step-send" alt="工作台的「送到 PaGamO」按鈕" />
          </div>
        </NeoCard>

        {/* 三大功能 */}
        <section className="mt-8 grid gap-5 md:grid-cols-3" aria-label="主要功能">
          {[
            ['📷', '截圖就能出題', '電子書、PDF、學習單，截取畫面後在工作台框出文章範圍，AI 自動辨識文字出題。'],
            ['📖', '部落格一鍵讀全文', '新聞、部落格按「讀取這頁全文」，自動去掉廣告、選單、留言，只留正文。'],
            ['🚀', '一鍵送到 PaGamO', '自動打開批量上傳頁、選好題組題型、放好檔案，選項順序預設隨機，老師只要按「上傳」。'],
          ].map(([icon, t, d]) => (
            <NeoCard key={t} shadow="md" className="p-6">
              <div className="text-3xl" aria-hidden>{icon}</div>
              <h2 className="mt-2 text-xl font-extrabold">{t}</h2>
              <p className="mt-2 leading-7 text-ink/85">{d}</p>
            </NeoCard>
          ))}
        </section>

        {/* 安裝 */}
        <NeoCard className="mt-10 px-6 sm:px-10 py-8" id="install">
          <h2 className="text-2xl sm:text-3xl font-extrabold">📘 安裝步驟（第一次約 5 分鐘）</h2>
          <ol className="mt-8 space-y-12 list-none p-0">
            <Step n={1} title="下載並解壓縮到固定位置">
              <p>按上方「<b>下載擴充套件（ZIP）</b>」，在下載的檔案上按右鍵 →「<b>解壓縮全部</b>」。</p>
              <p>把解壓出來的「<b>PIRLS閱讀題組小幫手</b>」資料夾放到固定位置，例如 <code className="bg-cream-deep border border-line rounded px-1.5">D:\PIRLS閱讀題組小幫手</code>。</p>
              <p className="bg-peach/40 border-neo rounded-xl px-4 py-3 text-[1rem]">⚠️ 之後<b>不要搬動或改名</b>這個資料夾。Chrome 是用資料夾位置認得擴充套件，搬家會被當成新的，金鑰和設定都會不見。</p>
            </Step>
            <Step n={2} title="打開 Chrome 的「開發人員模式」" shot={<Shot name="step-devmode" alt="chrome://extensions 頁面右上角的開發人員模式開關與載入未封裝項目按鈕" />}>
              <p>在 Chrome 網址列輸入 <code className="bg-cream-deep border border-line rounded px-1.5">chrome://extensions</code> 按 Enter。</p>
              <p>打開右上角「<b>開發人員模式</b>」，再按左上角「<b>載入未封裝項目</b>」，選剛剛的資料夾（裡面要直接看得到 <code>manifest.json</code>）。</p>
              <p>按 Chrome 右上角的拼圖圖示 🧩，把「PIRLS 閱讀題組小幫手」<b>釘選</b>到工具列。</p>
            </Step>
            <Step n={3} title="貼上自己的免費 Gemini 金鑰" shot={<Shot name="step-key" alt="設定頁：貼上金鑰並按儲存並測試" />}>
              <p id="key">裝好後會自動打開設定頁（沒有的話，在工具列圖示上按右鍵 →「設定」）。</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>打開 <a className="text-sky-deep underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio 金鑰頁面</a>，用自己的 Google 帳號登入。</li>
                <li>按「<b>Create API key</b>」，複製那串字（以 <code>AIza</code> 或 <code>AQ.</code> 開頭）。</li>
                <li>貼到設定頁，按「<b>儲存並測試</b>」，看到綠色「可以使用」就完成了。</li>
              </ol>
            </Step>
          </ol>
        </NeoCard>

        {/* 使用 */}
        <NeoCard className="mt-10 px-6 sm:px-10 py-8" id="use">
          <h2 className="text-2xl sm:text-3xl font-extrabold">✨ 怎麼出題</h2>
          <ol className="mt-8 space-y-12 list-none p-0">
            <Step n={1} title="在要出題的網頁按工具列圖示" shot={<Shot name="step-popup" alt="工具列小視窗：截取這個畫面、讀取這頁全文" className="max-w-[340px] mx-auto" />}>
              <p><b>📷 截取這個畫面</b>：電子書、PDF、圖片類文章用這個（快捷鍵 Alt+Shift+P）。</p>
              <p><b>📖 讀取這頁全文</b>：部落格、新聞等文字網頁用這個，最快。</p>
              <p>也可以反白一段文字 → 按右鍵 →「用這段文字出 PIRLS 題組」。</p>
            </Step>
            <Step n={2} title="框出文章範圍" shot={<Shot name="step-crop" alt="工作台的裁切視窗" />}>
              <p>會自動跳到「工作台」分頁，拖曳框出文章。</p>
              <p>文章只有這一段 → 按「<b>✨ 裁切並開始出題</b>」。</p>
              <p>文章還有下一段 → 按「裁切（還要截下一段）」，回原網頁捲下去再截一次。</p>
            </Step>
            <Step n={3} title="逐題檢查、修改" shot={<Shot name="step-review" alt="工作台：檢查與修改題目" />}>
              <p>題幹、選項、正解、答後講解、PIRLS 層次都能直接改，改完自動儲存，關掉分頁也不會不見。</p>
              <p className="bg-lemon/50 border-neo rounded-xl px-4 py-3 text-[1rem]">🤖 AI 出的題一定要老師看過再派給學生。</p>
            </Step>
            <Step n={4} title="一鍵送到 PaGamO" shot={<Shot name="step-send" alt="匯出到 PaGamO 區塊" />}>
              <p>按「<b>🚀 送到 PaGamO（題組版）</b>」：先下載一份備份，接著自動打開 PaGamO 批量上傳頁、選好「題組」、放好檔案。</p>
              <p>確認後按 PaGamO 頁面上<b>閃爍的「上傳」</b>就完成（擴充套件不會替你按）。還沒登入 PaGamO 的話，登入後會自動接著做。</p>
            </Step>
          </ol>
        </NeoCard>

        {/* 更新、安全、常見問題 */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <NeoCard className="p-6 sm:p-8" id="update">
            <h2 className="text-2xl font-extrabold">🔄 更新到新版</h2>
            <p className="mt-2 text-[1rem] text-muted-foreground">有新版時，工作台上方會出現「🆕 有新版本」提醒。</p>
            <ol className="mt-4 list-decimal pl-6 space-y-2 leading-7">
              <li>下載新版 ZIP，解壓縮。</li>
              <li>把新版資料夾裡的檔案<b>全部複製，覆蓋</b>到原本的資料夾（同一個位置）。</li>
              <li>到 <code className="bg-cream-deep border border-line rounded px-1.5">chrome://extensions</code>，在擴充套件卡片上按 <b>⟳</b> 重新載入。</li>
            </ol>
            <p className="mt-3 text-[1rem]">放在同一個位置，金鑰和設定都會保留。</p>
          </NeoCard>
          <NeoCard className="p-6 sm:p-8" id="safety">
            <h2 className="text-2xl font-extrabold">🛡️ 金鑰與個資安全</h2>
            <ul className="mt-4 list-disc pl-6 space-y-2 leading-7">
              <li>金鑰只存在自己電腦的 Chrome 裡，<b>不在資料夾裡</b>，分享 ZIP 不會把金鑰送出去。</li>
              <li>金鑰只會送到 Google Gemini，不經過其他伺服器。</li>
              <li><b>共用電腦</b>用完請到設定頁按「清除金鑰」。</li>
              <li>依 Google 條款，免費方案的內容可能被用來改進產品：<b>不要截有學生姓名、成績等個資的畫面</b>。</li>
            </ul>
          </NeoCard>
        </section>

        <NeoCard className="mt-6 p-6 sm:p-8" id="faq">
          <h2 className="text-2xl font-extrabold">❓ 常見問題</h2>
          <dl className="mt-4 grid gap-5 md:grid-cols-2 leading-7">
            {[
              ['出現「免費額度暫時用完」', '等一分鐘再試；一直出現代表今天用完了，明天自動恢復。'],
              ['按「截取這個畫面」沒反應或失敗', 'Chrome 設定頁、新分頁、擴充功能商店不允許截圖，請換到要出題的網頁。仍有問題：到設定頁最下方「錯誤紀錄本」按「複製紀錄」回報。'],
              ['重開 Chrome 後擴充套件不見了', '確認資料夾沒有被搬動、改名或刪除，再重新「載入未封裝項目」。'],
              ['學校電腦沒有「開發人員模式」開關', '可能被學校的電腦管理政策鎖住，請洽資訊組。'],
              ['想要辨識更準', '設定頁可以把模型從 Flash-Lite（最快）改成 Flash（比較準，但比較慢）。'],
              ['選項需要固定順序（例如「以上皆是」）', '在工作台匯出區把「選項順序」切到「固定」。'],
            ].map(([q, a]) => (
              <div key={q} className="bg-cream border-neo rounded-2xl p-4">
                <dt className="font-extrabold">{q}</dt>
                <dd className="mt-1 ml-0 text-ink/85">{a}</dd>
              </div>
            ))}
          </dl>
        </NeoCard>

        <NeoCard className="mt-6 p-6 sm:p-8" id="changelog">
          <h2 className="text-2xl font-extrabold">📝 更新紀錄</h2>
          <ul className="mt-4 space-y-4 list-none p-0">
            {changelog.map((c) => (
              <li key={c.version} className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div><span className="inline-block bg-lemon border-neo rounded-full px-3 py-0.5 text-[0.875rem] font-extrabold">v{c.version}</span> <span className="text-[0.875rem] text-muted-foreground">{c.date}</span></div>
                <ul className="list-disc pl-5 leading-7">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </li>
            ))}
          </ul>
        </NeoCard>

        {/* 頁尾 */}
        <footer className="mt-12 rounded-[24px] border-neo overflow-hidden bg-gradient-to-b from-[#f3ecdc] to-[#ebe2cf]">
          <div className="h-1 bg-gradient-to-r from-lemon via-coral to-sky-deep" />
          <div className="grid gap-8 px-6 sm:px-10 py-8 md:grid-cols-2 lg:grid-cols-[1.1fr_2fr_1fr]">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-cream border-neo shadow-neo-sm p-1 overflow-hidden shrink-0"><PirlsLogo className="w-full h-full" /></span>
              <div><div className="font-extrabold text-lg">PIRLS 閱讀題組小幫手</div><div className="text-[0.9375rem] text-ink/75">截圖、讀全文，一鍵變成 PIRLS 題組</div></div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3 list-none p-0 md:col-span-2 lg:col-span-1">
              {[
                ['🔑', '用自己的金鑰', '不占用學校額度，金鑰只存在自己電腦'],
                ['🤖', 'AI 出題要人看過', '派題前請逐題檢查題幹與正解'],
                ['🎲', '選項自動隨機', '學生無法靠記答案位置猜題'],
              ].map(([i, t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border-neo shrink-0" aria-hidden>{i}</span>
                  <div><div className="font-extrabold text-[1rem]">{t}</div><div className="text-[0.9375rem] text-ink/75 leading-6">{d}</div></div>
                </li>
              ))}
            </ul>
            <nav aria-label="快速連結" className="flex lg:flex-col flex-wrap gap-2.5 items-start">
              <a href={ZIP} download className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>⬇️ 下載 ZIP</a>
              <a href="#install" className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>📘 安裝步驟</a>
              <Link href="/" className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>🌐 網站版</Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-6 sm:px-10 py-4 text-[0.9375rem] text-ink/80">
            <p className="m-0 text-center sm:text-left">
              Made with <span aria-label="愛心">❤️</span> by{' '}
              <a href={TEACHER_URL} target="_blank" rel="noopener noreferrer" className="text-inherit no-underline border-b border-dotted border-current hover:text-coral">阿凱老師</a>
              <span className="hidden sm:inline mx-1.5" aria-hidden>・</span>
              <span className="block sm:inline">桃園市龍潭區石門國民小學</span>
            </p>
            <p className="m-0 text-[0.875rem] font-extrabold bg-white/70 border border-line rounded-full px-3 py-0.5">v{manifest.version}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
