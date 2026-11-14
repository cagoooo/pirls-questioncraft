// /extension/：Chrome 擴充套件「PIRLS 閱讀題組小幫手」安裝與使用說明
// 主要安裝路徑是 Chrome 線上應用程式商店（Chrome 自動更新）；ZIP（tools/pack-extension.mjs 建置時產生）只放在「進階：手動安裝」備用。
// 截圖由 tools/capture-extension-guide.py 產生。
import type { Metadata } from 'next';
import Link from 'next/link';
import manifest from '../../../extension/manifest.json';
import changelog from '../../../extension/CHANGELOG.json';
import { NeoCard } from '@/components/Neo';
import { PirlsLogo } from '@/components/PirlsLogo';

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const STORE_URL = 'https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp';
const ZIP = `${base}/extension/pirls-helper-extension.zip`;
const img = (name: string) => `${base}/extension/img/${name}.webp`;
const TEACHER_URL = 'https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5';
// 這份說明頁最後修改的日期（Asia/Taipei），跟擴充套件的版本更新日期分開
const GUIDE_UPDATED = '2026-11-10';

export const metadata: Metadata = {
  title: 'PIRLS 閱讀題組小幫手｜Chrome 擴充套件安裝與使用說明',
  description: '從 Chrome 線上應用程式商店免費安裝。在任何網頁截圖、讀取全文或反白文字，用自己的免費 Gemini 金鑰產生 PIRLS 閱讀理解題組，一鍵送到 PaGamO 批量上傳。',
};

const pill = 'inline-flex items-center justify-center gap-2 border-neo rounded-full font-bold shadow-neo-sm neo-press hover:-translate-y-px hover:shadow-neo text-ink no-underline';
const code = 'bg-cream-deep border border-line rounded px-1.5';
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

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

function Faq({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-4 grid gap-5 md:grid-cols-2 leading-7">
      {items.map(([q, a]) => (
        <div key={q} className="bg-cream border-neo rounded-2xl p-4">
          <dt className="font-extrabold">{q}</dt>
          <dd className="mt-1 ml-0 text-ink/85">{a}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ExtensionGuidePage() {
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
              <p className="inline-flex items-center gap-2 bg-lemon border-neo rounded-full px-3 py-1 text-[0.875rem] font-extrabold">🧩 已上架 Chrome 線上應用程式商店　v{manifest.version}</p>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight">PIRLS 閱讀題組小幫手</h1>
              <p className="mt-4 text-lg leading-8">在任何網頁<b>截圖</b>、<b>讀取全文</b>或<b>反白文字</b>，用自己的免費 Gemini 金鑰，一分鐘產生 PIRLS 四層次閱讀理解題組，檢查後<b>一鍵送到 PaGamO</b>。</p>
              <div id="download" className="mt-6 flex flex-wrap gap-3">
                <a href={STORE_URL} {...ext} className={`${pill} bg-sage px-6 py-3.5 text-[1.125rem]`}>➕ 加到 Chrome（免費）</a>
                <a href="#install" className={`${pill} bg-card px-5 py-3.5 text-[1.0625rem]`}>📘 看安裝步驟</a>
              </div>
              <p className="mt-3 text-[0.9375rem] text-muted-foreground">免費・不用登入・Chrome 會自動更新・金鑰只存在自己的電腦｜說明最後更新 {GUIDE_UPDATED}</p>
            </div>
            <Shot name="step-send" alt="工作台的「送到 PaGamO」按鈕" />
          </div>
        </NeoCard>

        {/* 功能摘要 */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="主要功能">
          {[
            ['📷', '截圖就能出題', '電子書、PDF、學習單都可以，截取畫面後在工作台框出文章範圍，AI 自動辨識文字出題。'],
            ['📖', '一鍵讀取全文', '新聞、部落格按「讀取這頁全文」，自動去掉廣告、選單、留言，只留下正文。'],
            ['🖍️', '反白文字出題', '反白一段文章，按右鍵選「用這段文字出 PIRLS 題組」就開始。'],
            ['✏️', '逐題檢查修改', '題幹、選項、正解、答後講解、PIRLS 層次都能直接改，改完自動儲存。'],
            ['🚀', '一鍵送到 PaGamO', '自動打開批量上傳頁、選好「題組」、放好檔案，選項順序預設隨機；最後的「上傳」由老師自己按。'],
            ['🃏', '也能匯出 LoiLoNote', '下載 LoiLoNote 測驗卡匯入檔：題組檔與網站「匯出 Loilonote」格式相同；含文章版會把文章放在題目前面。'],
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
          <h2 className="text-2xl sm:text-3xl font-extrabold">📘 安裝步驟（第一次約 3 分鐘）</h2>
          <p className="mt-2 text-[1.0625rem] text-ink/80">不用下載檔案、不用改 Chrome 設定，從商店加進來就好。</p>
          <ol className="mt-8 space-y-12 list-none p-0">
            <Step n={1} title="用 Chrome 打開商店頁">
              <p>按下面的按鈕，會打開「Chrome 線上應用程式商店」裡的<b>「PIRLS 閱讀題組小幫手」</b>頁面。</p>
              <p><a href={STORE_URL} {...ext} className={`${pill} bg-sage px-5 py-2.5 text-[1.0625rem]`}>🛒 打開商店頁</a></p>
              <p className="text-[1rem] text-muted-foreground">請用電腦版 Chrome 打開；手機、平板不能安裝擴充套件。</p>
            </Step>
            <Step n={2} title="按「加到 Chrome」">
              <p>按商店頁右上角藍色的「<b>加到 Chrome</b>」，跳出確認視窗時按「<b>新增擴充功能</b>」。</p>
              <p>裝好後，按 Chrome 右上角的拼圖圖示 🧩，把「PIRLS 閱讀題組小幫手」<b>釘選</b>到工具列，之後一按就找得到。</p>
            </Step>
            <Step n={3} title="貼上自己的免費 Gemini 金鑰" shot={<Shot name="step-key" alt="設定頁：貼上金鑰並按儲存並測試" />}>
              <p id="key">裝好後會自動打開設定頁（沒有的話，在工具列圖示上按右鍵 →「設定（Gemini 金鑰）」）。</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>打開 <a className="text-sky-deep underline" href="https://aistudio.google.com/apikey" {...ext}>Google AI Studio 金鑰頁面</a>，用<b>個人 Gmail 帳號</b>登入。<b>不要用學校信箱</b>，用個人帳號申請才能使用免費額度。</li>
                <li>按畫面上的「<b>Create API key</b>」（建立金鑰）按鈕，複製那串字（以 <code>AIza</code> 或 <code>AQ.</code> 開頭）。</li>
                <li>貼到設定頁，按「<b>儲存並測試</b>」，看到綠色「可以使用」就完成了。</li>
              </ol>
              <p className="bg-lemon/50 border-neo rounded-xl px-4 py-3 text-[1rem]">💡 請用<b>個人 Gmail 帳號</b>申請免費金鑰，<b>不要用學校信箱</b>：用學校帳號申請的金鑰沒有免費額度。每位老師用自己的金鑰，不會占用別人的額度。</p>
            </Step>
          </ol>
        </NeoCard>

        {/* 使用 */}
        <NeoCard className="mt-10 px-6 sm:px-10 py-8" id="use">
          <h2 className="text-2xl sm:text-3xl font-extrabold">✨ 怎麼出題</h2>
          <ol className="mt-8 space-y-12 list-none p-0">
            <Step n={1} title="在要出題的網頁按工具列圖示" shot={<Shot name="step-popup" alt="工具列小視窗：截取這個畫面、讀取這頁全文" className="max-w-[340px] mx-auto" />}>
              <p><b>📷 截取這個畫面</b>：電子書、PDF、學習單、圖片類文章用這個（快捷鍵 Alt+Shift+P）。</p>
              <p><b>📖 讀取這頁全文</b>：部落格、新聞等文字網頁用這個，最快。</p>
              <p><b>🖍️ 反白文字</b>：反白一段文章 → 按右鍵 →「用這段文字出 PIRLS 題組」。</p>
            </Step>
            <Step n={2} title="框出文章範圍（截圖時）" shot={<Shot name="step-crop" alt="工作台的裁切視窗" />}>
              <p>會自動跳到「工作台」分頁，拖曳框出文章。</p>
              <p>文章只有這一段 → 按「<b>✨ 裁切並開始出題</b>」。</p>
              <p>文章還有下一段 → 按「裁切（還要截下一段）」，回原網頁捲下去再截一次。</p>
            </Step>
            <Step n={3} title="逐題檢查、修改" shot={<Shot name="step-review" alt="工作台：檢查與修改題目" />}>
              <p>題幹、選項、正解、答後講解、PIRLS 層次都能直接改，改完自動儲存，關掉分頁也不會不見。</p>
              <p className="bg-lemon/50 border-neo rounded-xl px-4 py-3 text-[1rem]">🤖 AI 出的題一定要老師看過再派給學生。</p>
            </Step>
            <Step n={4} title="一鍵送到 PaGamO" shot={<Shot name="step-send" alt="匯出到 PaGamO 區塊" />}>
              <p>按「<b>🚀 送到 PaGamO（題組版）</b>」，小幫手會：</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>先下載一份備份檔到電腦。</li>
                <li>自動打開 PaGamO 批量上傳頁，選好「題組」，放好檔案。</li>
                <li>等老師確認後，按 PaGamO 頁面上<b>閃爍的「上傳」</b>就完成（小幫手不會替你按）。</li>
              </ol>
              <p>還沒登入 PaGamO 的話，先登入，登入後會自動回到批量上傳頁接著做。</p>
              <p>選項順序預設<b>隨機</b>，學生不能靠記「答案是第幾個」猜題；需要固定順序時，在匯出區切到「固定」。</p>
              <p>📎 <b>用截圖出題時</b>，題組版會一起附上原始截圖，學生在題組裡看得到原本的頁面與插圖（可在匯出區取消勾選）。課本、繪本等有版權的圖片，請只用於自己的課堂。</p>
              <p className="bg-sky/40 border-neo rounded-xl px-4 py-3 text-[1rem]">🃏 <b>用 LoiLoNote？</b>同一區下方按「<b>⬇️ 下載 LoiLoNote 題組檔</b>」（只有題目）或「<b>含文章版（新版格式）</b>」，再到 LoiLoNote 測驗卡點「…」→「文件匯入」，預覽確認後按「使用此文件創建」。</p>
            </Step>
          </ol>
        </NeoCard>

        {/* 更新、安全 */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <NeoCard className="p-6 sm:p-8" id="update">
            <h2 className="text-2xl font-extrabold">🔄 更新：Chrome 會自動處理</h2>
            <p className="mt-4 leading-7">從商店安裝的小幫手，<b>Chrome 會在背景自動更新到最新版</b>，不用下載 ZIP、不用重新載入，金鑰和設定都會保留。</p>
            <ul className="mt-3 list-disc pl-6 space-y-2 leading-7">
              <li>新版要先通過商店審核才會送出，所以下方「更新紀錄」可能比您電腦上的版本早幾天出現，屬於正常現象。</li>
              <li>想看自己目前的版本：設定頁或工作台最下方右邊的版本號。</li>
            </ul>
            <p className="mt-3 text-[1rem] text-muted-foreground">以前用 ZIP 手動安裝的老師：手動安裝版不會自動更新，建議改從商店安裝（做法見下方常見問題）；仍要手動更新請看最下方「<a href="#manual" className="text-sky-deep underline">進階：手動安裝</a>」。</p>
          </NeoCard>
          <NeoCard className="p-6 sm:p-8" id="safety">
            <h2 className="text-2xl font-extrabold">🛡️ 金鑰與個資安全</h2>
            <ul className="mt-4 list-disc pl-6 space-y-2 leading-7">
              <li>金鑰只存在自己電腦的 Chrome 裡，<b>不會寫進任何資料夾，也不會送到開發者的伺服器</b>。</li>
              <li>金鑰只會在出題時送到 Google Gemini。</li>
              <li><b>共用電腦</b>用完請到設定頁按「清除金鑰」。</li>
              <li>依 Google 條款，免費方案的內容可能被用來改進產品：<b>不要截有學生姓名、成績等個資的畫面</b>。</li>
            </ul>
          </NeoCard>
        </section>

        <NeoCard className="mt-6 p-6 sm:p-8" id="faq">
          <h2 className="text-2xl font-extrabold">❓ 常見問題</h2>
          <Faq items={[
            ['學校電腦打不開商店，或「加到 Chrome」按不下去', '學校的電腦管理設定可能限制安裝擴充套件，請洽資訊組協助開放。在那之前可以先用本網站的網站版出題。'],
            ['以前用 ZIP 裝過，要怎麼換成商店版？', <>到 <code className={code}>chrome://extensions</code> 把舊的（手動安裝的那個）移除，再從商店「加到 Chrome」，重新貼一次金鑰。兩個版本是不同的擴充套件，金鑰不會自動搬過去，也不要兩個同時開著。</>],
            ['家裡、另一台電腦也想用', '每台電腦的 Chrome 都要加一次。如果 Chrome 有登入同步，小幫手可能會自動出現在另一台電腦，但金鑰不會同步，要再貼一次。'],
            ['出現「免費額度暫時用完」', '等一分鐘再試；一直出現代表今天用完了，明天自動恢復。'],
            ['按「截取這個畫面」沒反應或失敗', 'Chrome 設定頁、新分頁、擴充功能商店不允許截圖，請換到要出題的網頁。仍有問題：到設定頁最下方「錯誤紀錄本」按「複製紀錄」回報。'],
            ['出現「模型已停用」', '到設定頁按「儲存並測試」，會自動換成可用的模型。'],
            ['想要辨識更準', '設定頁可以把模型從 Flash-Lite（最快）改成 Flash（比較準，但比較慢）。'],
            ['選項需要固定順序（例如「以上皆是」）', '在工作台匯出區把「選項順序」切到「固定」。'],
          ]} />
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

        {/* 進階：手動安裝（商店被擋或離線時才需要），預設收合 */}
        <details id="manual" className="group mt-6 bg-card border-neo rounded-[24px] shadow-neo-sm">
          <summary className="flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 sm:px-8 py-5">
            <span aria-hidden className="transition-transform group-open:rotate-90">▶</span>
            <span className="text-lg font-extrabold">進階：手動安裝</span>
            <span className="text-[0.9375rem] text-muted-foreground">只有學校電腦打不開商店、需要離線安裝時才用</span>
          </summary>
          <div className="px-6 sm:px-8 pb-8 leading-7 space-y-4">
            <p className="bg-peach/40 border-neo rounded-xl px-4 py-3 text-[1rem]">⚠️ 一般老師請用上面的商店安裝。手動安裝版<b>不會自動更新</b>，而且要打開 Chrome 的「開發人員模式」，很多學校電腦會擋住這個設定。</p>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] items-start">
              <ol className="list-decimal pl-6 space-y-2">
                <li><a href={ZIP} download className="text-sky-deep underline">下載手動安裝用的 ZIP</a>，在檔案上按右鍵 →「解壓縮全部」，把資料夾放到固定位置（例如 <code className={code}>D:\PIRLS閱讀題組小幫手</code>），之後<b>不要搬動或改名</b>。</li>
                <li>Chrome 網址列輸入 <code className={code}>chrome://extensions</code>，打開右上角「開發人員模式」，按「載入未封裝項目」，選剛剛的資料夾（裡面要直接看得到 <code>manifest.json</code>）。</li>
                <li>照自動打開的設定頁貼上金鑰，方法和上面第 3 步一樣。</li>
              </ol>
              <Shot name="step-devmode" alt="手動安裝：chrome://extensions 頁面的開發人員模式開關與載入未封裝項目按鈕" className="max-w-[520px]" />
            </div>
            <div>
              <h3 className="font-extrabold">手動安裝版怎麼更新</h3>
              <p className="mt-1">有新版時，工作台上方會出現「🆕 有新版本」提醒。下載新版 ZIP，把檔案<b>全部覆蓋</b>到原本的資料夾，再到 <code className={code}>chrome://extensions</code> 在小幫手卡片上按 ⟳ 重新載入。放在同一個位置，金鑰和設定都會保留。</p>
            </div>
            <div>
              <h3 className="font-extrabold">手動安裝常見問題</h3>
              <Faq items={[
                ['重開 Chrome 後小幫手不見了', '確認資料夾沒有被搬動、改名或刪除，再重新「載入未封裝項目」。'],
                ['沒有「開發人員模式」開關', '被學校的電腦管理設定鎖住了，這台電腦無法手動安裝，請洽資訊組。'],
              ]} />
            </div>
          </div>
        </details>

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
              <a href={STORE_URL} {...ext} className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>➕ 加到 Chrome</a>
              <a href="#install" className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>📘 安裝步驟</a>
              <Link href="/" className={`${pill} bg-white px-3.5 py-1.5 text-[0.9375rem]`}>🌐 網站版</Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-6 sm:px-10 py-4 text-[0.9375rem] text-ink/80">
            <p className="m-0 text-center sm:text-left">
              Made with <span aria-label="愛心">❤️</span> by{' '}
              <a href={TEACHER_URL} {...ext} className="text-inherit no-underline border-b border-dotted border-current hover:text-coral">阿凱老師</a>
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
