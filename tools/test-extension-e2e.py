# 擴充套件端對端測試：Playwright 載入未封裝擴充套件，模擬老師操作（Gemini 以模擬回應代替，另含一次「無效金鑰」真連線）。
# 需求：pip install playwright openpyxl pillow ＆ python -m playwright install chromium
# 執行：python -X utf8 tools/test-extension-e2e.py （截圖與下載檔會放在暫存資料夾，結尾會印出位置）
import json, shutil, sys, tempfile, time, base64, pathlib
from playwright.sync_api import sync_playwright
import openpyxl

SRC = pathlib.Path(__file__).resolve().parent.parent / "extension"
HERE = pathlib.Path(tempfile.mkdtemp(prefix="pirls-ext-e2e-"))
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# 測試版：多給 <all_urls>，讓測試程式能代替「點工具列圖示」觸發截圖（正式版只用 activeTab）
EXT = HERE / "ext-test"
if EXT.exists():
    shutil.rmtree(EXT)
shutil.copytree(SRC, EXT)
man = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
man["host_permissions"].append("<all_urls>")
(EXT / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

ARTICLE_HTML = """<!doctype html><html lang=zh-Hant><meta charset=utf-8><title>測試文章頁</title>
<body style="margin:0;font:20px/1.8 'Microsoft JhengHei';background:#fafafa">
<div style="padding:40px"><h1>小水滴的旅行</h1>
<p id=p1>清晨，小水滴躺在荷葉上，看著太陽慢慢升起。陽光越來越熱，小水滴覺得身體變輕了，飄呀飄，飄到了天空，和許多夥伴擠成一朵白雲。</p>
<p>雲越來越重，小水滴又變成雨，落回小河裡。小河帶著它流向大海，旅行又重新開始。</p>
<div style="height:1200px"></div></div></body></html>"""

BLOG_HTML = """<!doctype html><html lang=zh-Hant><meta charset=utf-8><title>小河邊的觀察日記｜阿水的部落格</title>
<body style="margin:0;font:18px/1.8 'Microsoft JhengHei'">
<header><nav><a href=/>首頁</a> <a href=/about>關於我</a> <a href=/shop>好物推薦</a> <a href=/contact>聯絡我們</a></nav></header>
<div style="display:flex;gap:24px;padding:24px">
<article class=post style="flex:3">
<h1>小河邊的觀察日記</h1>
<p>星期六早上，我和爸爸帶著放大鏡和筆記本，來到家附近的小河邊。河水清清的，可以看到河底的小石頭和游來游去的小魚。</p>
<p>我們先觀察岸邊的植物。爸爸說，長在水邊的水芹菜喜歡潮濕的地方，所以葉子特別翠綠。我把它的樣子畫在筆記本上，還量了葉子的長度，大約有五公分。</p>
<p>接著，我們發現一隻白鷺鷥站在淺水裡，一動也不動。過了好一會兒，牠突然把嘴巴伸進水裡，叼起一條小魚。爸爸告訴我，白鷺鷥很有耐心，會等魚游到身邊才出手。</p>
<p>回家的路上，我想著今天看到的一切：清澈的河水讓魚兒有地方住，魚兒又成為白鷺鷥的食物。原來小河裡的每一種生物，都和別的生物有關係。我決定下次還要再來，看看不同季節的小河有什麼變化。</p>
</article>
<aside style="flex:1"><h3>熱門文章</h3><ul><li><a href=/a>十大必買文具開箱</a></li><li><a href=/b>週末親子景點懶人包</a></li></ul><p>訂閱電子報，好康不漏接！</p></aside>
</div>
<section id=comments><h3>留言（2）</h3><p>小美：寫得好棒，我也想去！</p><p>路人甲：請問這條河在哪裡？</p></section>
<footer>© 阿水的部落格 版權所有</footer></body></html>"""

# 模擬 PaGamO 批量上傳頁（結構依 2026-11-07 實地偵察：Ant Design 題型單選、input[type=file]、「上 傳」按鈕；選檔時不上傳）
FAKE_PAGAMO_BATCH = """<!doctype html><html><meta charset=utf-8><title>PaGamO</title><body>
<div id=types>
<label class="ant-radio-wrapper ant-radio-wrapper-checked"><input type=radio name=t class=ant-radio-input>選擇題</label>
<label class="ant-radio-wrapper"><input type=radio name=t class=ant-radio-input>是非題</label>
<label class="ant-radio-wrapper"><input type=radio name=t class=ant-radio-input>填充題</label>
<label class="ant-radio-wrapper"><input type=radio name=t class=ant-radio-input>題組</label>
</div>
<a id=tpl href="https://cdn.pagamo.org/dyna_questions/templates/v5/PaGamO_批量上傳範例_選擇題.xlsx">範例檔</a>
<span><input type=file accept=".xlsx,.png,.jpg,.jpeg,.mp3,.zip" multiple></span>
<div class=ant-upload-list></div>
<div style="height:1500px"></div>
<button type=submit class="ant-btn">上 傳</button>
<script>
document.querySelectorAll('label.ant-radio-wrapper').forEach(l => l.addEventListener('click', () => {
  document.querySelectorAll('label.ant-radio-wrapper').forEach(o => o.classList.remove('ant-radio-wrapper-checked'));
  setTimeout(() => { l.classList.add('ant-radio-wrapper-checked');
    document.getElementById('tpl').href = 'https://cdn.pagamo.org/dyna_questions/templates/v5/PaGamO_批量上傳範例_' + l.textContent.trim() + '.xlsx'; }, 150);
}));
document.querySelector('input[type=file]').addEventListener('change', e => {
  const list = document.querySelector('.ant-upload-list');
  list.innerHTML = [...e.target.files].map(f => '<div class=ant-upload-list-item><span class=ant-upload-list-item-name>' + f.name + '</span></div>').join('');
});
document.querySelector('button[type=submit]').addEventListener('click', () => { window.__submitted = true; });
</script></body></html>"""
pagamo_state = {"logged_in": True}
def pagamo_route(route):
    url = route.request.url
    if "add_questions/batch" in url:
        if not pagamo_state["logged_in"]:
            return route.fulfill(status=302, headers={"Location": "https://www.pagamo.org/sign_in"})
        return route.fulfill(body=FAKE_PAGAMO_BATCH, content_type="text/html; charset=utf-8")
    if "sign_in" in url:
        return route.fulfill(body="<!doctype html><meta charset=utf-8><title>登入</title><h1>請登入</h1>", content_type="text/html; charset=utf-8")
    return route.fulfill(body="<!doctype html><meta charset=utf-8><title>PaGamO 首頁</title><h1>首頁</h1>", content_type="text/html; charset=utf-8")

LEVELS = ["locate & retrieve", "make straightforward inferences", "interpret & integrate", "evaluate & critique"]
def fake_questions(n=8):
    return {"title": "小水滴的旅行", "articleContent": "清晨，小水滴躺在荷葉上。\n雲越來越重，小水滴又變成雨。",
            "questions": [{"question": f"模擬第{i+1}題：小水滴在哪裡？", "options": ["荷葉上", "石頭上", "樹枝上", "屋頂上"],
                           "correctAnswerIndex": i % 4, "explanation": f"請回到第一段找線索 {i+1}", "pirlsLevel": LEVELS[i // 2]} for i in range(n)]}

calls = []
reject = {"on": False}
errors = []
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

def gemini_mock(route):
    req = route.request
    url = req.url
    calls.append({"url": url.split("?")[0], "key": req.headers.get("x-goog-api-key", ""), "body": req.post_data or ""})
    if req.method == "GET" and "/models" in url:
        return route.fulfill(json={"models": [
            {"name": "models/gemini-2.0-flash-lite", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
        ]})
    body = json.loads(req.post_data or "{}")
    if reject["on"] and "responseSchema" in body.get("generationConfig", {}):
        return route.fulfill(status=400, json={"error": {"code": 400, "message": "Invalid JSON payload received. Unknown name \"minItems\""}})
    if "responseMimeType" in body.get("generationConfig", {}):
        text = json.dumps(fake_questions(), ensure_ascii=False)
    else:
        text = "OK"
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]})

with sync_playwright() as p:
    udd = tempfile.mkdtemp(prefix="pirls-e2e-")
    ctx = p.chromium.launch_persistent_context(udd, channel="chromium", headless=True, accept_downloads=True,
        viewport={"width": 1440, "height": 900},
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
    ctx.on("weberror", lambda e: errors.append(f"weberror: {e.error}"))
    def watch(page):
        page.on("console", lambda m: errors.append(f"{page.url[-40:]} console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"{page.url[-40:]} pageerror: {e}"))
    ctx.on("page", watch)
    remote = {"version": "9.9.9"}
    ctx.route("https://cagoooo.github.io/pirls-questioncraft/extension/version.json*", lambda r: r.fulfill(json={
        "version": remote["version"], "notes": ["測試用新功能"], "date": "2026-11-07",
        "download": "https://cagoooo.github.io/pirls-questioncraft/extension/pirls-helper-extension.zip",
        "install": "https://cagoooo.github.io/pirls-questioncraft/extension/"}))
    ctx.route("https://www.pagamo.org/**", pagamo_route)
    ctx.route("https://pirls-test.example/**", lambda r: r.fulfill(body=BLOG_HTML if "blog" in r.request.url else ARTICLE_HTML, content_type="text/html; charset=utf-8"))

    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
    sw_logs = []
    sw.on("console", lambda m: sw_logs.append(f"{m.type}: {m.text}"))
    ext_id = sw.url.split("/")[2]
    print("extension id:", ext_id)
    base = f"chrome-extension://{ext_id}"

    # 1. 安裝後自動打開設定頁
    time.sleep(3)
    print("pages:", [pg.url for pg in ctx.pages])
    opts = next((pg for pg in ctx.pages if "options.html" in pg.url), None)
    print("NOTE 安裝後自動開設定頁：Playwright 在瀏覽器啟動瞬間載入擴充套件，onInstalled 已呼叫 openOptionsPage 但分頁不可見，留待實機驗證")
    if not opts:
        opts = ctx.new_page(); opts.goto(f"{base}/options/options.html")
    watch(opts)
    opts.wait_for_selector("#keyStatus")
    check("設定頁提示尚未設定金鑰", "還沒設定金鑰" in opts.inner_text("#keyStatus"))
    check("設定頁頁尾署名連結正確", "content_id=11" in opts.get_attribute(".site-credit__author", "href"))
    check("冊次預設學期", "115上" in opts.inner_text("#catPreview"), opts.inner_text("#catPreview"))

    # 2. 真的打 Google：無效金鑰要顯示中文錯誤
    opts.fill("#key", "TEST_INVALID_KEY_0000000000000000000000")
    opts.click("#save")
    opts.wait_for_selector("#keyStatus.error", timeout=30000)
    msg = opts.inner_text("#keyStatus")
    check("無效金鑰顯示中文說明（實際連 Google）", "金鑰" in msg, msg)

    # 3. 模擬 Gemini：測試金鑰成功並自動選模型
    ctx.route("https://generativelanguage.googleapis.com/**", gemini_mock)
    opts.fill("#key", "FAKE_KEY_FOR_MOCK_ONLY_000000000000000")
    opts.click("#save")
    opts.wait_for_selector("#keyStatus.ok", timeout=30000)
    check("測試金鑰成功並預設選最快的 Flash-Lite", opts.input_value("#model") == "gemini-2.0-flash-lite", opts.inner_text("#keyStatus"))
    check("排除非出題模型", "text-embedding-004" not in opts.inner_html("#model"))
    check("金鑰放在 header 不放網址", all("key=" not in c["url"] for c in calls) and calls[-1]["key"].startswith("FAKE_KEY"))
    opts.fill("#subject", "國語")
    opts.wait_for_timeout(700)
    opts.screenshot(path=str(OUT / "options-desktop.png"), full_page=True)
    opts.set_viewport_size({"width": 375, "height": 800})
    check("設定頁手機版沒有水平捲動", opts.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1"))
    opts.screenshot(path=str(OUT / "options-mobile.png"), full_page=True)

    # 4. 截取畫面（v0.4.0 新流程）：小視窗按「截取這個畫面」→ 截圖 → 跳到工作台分頁 → 自動打開裁切視窗
    art = ctx.new_page()
    art.goto("https://pirls-test.example/article.html")
    def open_popup_for(url_pattern):
        pg = ctx.new_page()
        pg.goto(f"{base}/popup/popup.html")
        pg.wait_for_selector("#capture")
        pg.evaluate("""async (pat) => {
          const [t] = await chrome.tabs.query({ url: pat });
          // 模擬「小視窗屬於這個分頁」：把 query 指到測試網頁
          chrome.tabs.query = async () => [t];
        }""", url_pattern)
        return pg
    pg = open_popup_for("https://pirls-test.example/article*")
    art.bring_to_front()
    with ctx.expect_page() as newbench:
        pg.click("#capture", no_wait_after=True)
    bench = newbench.value
    check("截取後自動開新分頁到工作台", "workbench.html" in bench.url, bench.url)
    bench.wait_for_selector("#cropModal:not(.hidden)", timeout=8000)
    check("工作台自動打開裁切視窗", True)
    check("工作台分頁在最前面", bench.evaluate("document.visibilityState") == "visible")
    full_w = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots[0].width || 0)")
    def drag_canvas(fx0, fy0, fx1, fy1):
        b = bench.locator("#cropCanvas").bounding_box()
        bench.mouse.move(b["x"] + b["width"] * fx0, b["y"] + b["height"] * fy0); bench.mouse.down()
        bench.mouse.move(b["x"] + b["width"] * fx1, b["y"] + b["height"] * fy1, steps=8); bench.mouse.up()
    drag_canvas(0.02, 0.04, 0.5, 0.4)
    bench.screenshot(path=str(OUT / "crop-modal.png"))
    check("拖曳後才能按裁切", not bench.is_disabled("#cropOk") and not bench.is_disabled("#cropGo"))
    bench.click("#cropOk")
    bench.wait_for_selector("#cropModal.hidden", state="attached", timeout=5000)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    dpr = art.evaluate("devicePixelRatio")
    check("裁切後有 1 張截圖、寬度約為畫面的 48%", len(shots) == 1 and not shots[0]["needsCrop"] and abs(shots[0]["width"] - 1440 * dpr * 0.48) <= 20 * dpr,
          f"{[ (s['width'], s['needsCrop']) for s in shots]} dpr={dpr}")
    check("裁切後提示「還要截下一段？」", "下一段" in bench.inner_text("#genStatus"), bench.inner_text("#genStatus"))
    pathlib.Path(OUT / "shot1.jpg").write_bytes(base64.b64decode(shots[0]["dataUrl"].split(",")[1]))

    def start_capture():
        art.bring_to_front()
        bench.evaluate("""async () => {
          const [t] = await chrome.tabs.query({ url: 'https://pirls-test.example/article*' });
          return chrome.runtime.sendMessage({ type: 'START_CAPTURE', tab: t });
        }""")
    # 第二張：使用整張
    start_capture()
    bench.wait_for_selector("#cropModal:not(.hidden)", timeout=8000)
    check("再截一次會跳回同一個工作台分頁", len([p for p in ctx.pages if "workbench.html" in p.url]) == 1 and bench.evaluate("document.visibilityState") == "visible")
    bench.click("#cropFull")
    bench.wait_for_timeout(600)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    check("「使用整張」保留整個畫面", len(shots) == 2 and shots[1]["width"] == min(2000, round(1440 * dpr)), str([s.get("width") for s in shots]))
    # 第三張：稍後再裁 → 留在清單、不會一直跳出 → 刪掉
    start_capture()
    bench.wait_for_selector("#cropModal:not(.hidden)", timeout=8000)
    bench.click("#cropCancel")
    bench.wait_for_timeout(500)
    bench.reload(); bench.wait_for_selector("#shotCount"); bench.wait_for_timeout(800)
    check("稍後再裁：留在清單，重新整理也不會再自動跳出", bench.is_hidden("#cropModal") and bench.locator(".needs-crop").count() == 1)
    bench.once("dialog", lambda d: d.accept())
    bench.click(".shot:nth-child(3) [data-act=del]")
    bench.wait_for_timeout(400)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    check("刪除截圖", len(shots) == 2)
    # 裁切並開始出題：直接觸發出題
    start_capture()
    bench.wait_for_selector("#cropModal:not(.hidden)", timeout=8000)
    drag_canvas(0.02, 0.04, 0.6, 0.3)
    n_before_go = len(calls)
    bench.click("#cropGo")
    bench.wait_for_selector("#genStatus.gen-status", timeout=5000)
    bench.wait_for_timeout(1500)
    check("「裁切並開始出題」會直接出題", any(":generateContent" in c["url"] for c in calls[n_before_go:]) or "金鑰" in bench.inner_text("#genStatus"),
          bench.inner_text("#genStatus")[:60])
    # 收回到 2 張，讓後面的測試不變
    bench.evaluate("chrome.storage.local.get('shots').then(r => chrome.storage.local.set({ shots: r.shots.slice(0, 2) }))")
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")

    # 5. 工作台：截圖清單、排序
    bench.bring_to_front()
    bench.wait_for_selector("#shotCount:text-is('2')", timeout=5000)
    check("工作台即時顯示 2 張截圖", True)
    first_id = shots[0]["id"]
    bench.click(".shot:nth-child(1) [data-act=down]")
    bench.wait_for_timeout(300)
    order = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots.map(s => s.id))")
    check("往後移排序", order[1] == first_id)

    # 6. 出題（模擬 Gemini）
    n_before = len(calls)
    bench.click("#generate")
    bench.wait_for_selector("#questions .q", timeout=20000)
    gen = [c for c in calls[n_before:] if ":generateContent" in c["url"]]
    body = json.loads(gen[-1]["body"]) if gen else {}
    parts = body.get("contents", [{}])[0].get("parts", [])
    check("出題請求附上 2 張圖片＋提示詞", sum(1 for x in parts if "inline_data" in x) == 2 and "PIRLS" in parts[2].get("text", ""))
    check("提醒 AI 講解不要用 ABCD 代稱選項", "不要用 A、B、C、D" in parts[-1].get("text", ""))
    check("出題要求 JSON schema", body.get("generationConfig", {}).get("responseMimeType") == "application/json")
    check("顯示 8 題", bench.locator("#questions .q").count() == 8)
    check("分類預設：科目改成國語、冊次 115上、章節＝標題",
          [bench.input_value("#catSubject"), bench.input_value("#catBook"), bench.input_value("#catChapter")] == ["國語", "115上", "小水滴的旅行"],
          str([bench.input_value("#catSubject"), bench.input_value("#catBook"), bench.input_value("#catChapter")]))

    # 7. 修改並確認自動儲存
    q1 = bench.locator("#questions .q").first
    q1.locator("[data-f=question]").fill("老師改過的第一題：小水滴一開始在哪裡？")
    q1.locator("input[type=radio][value='2']").check()
    bench.fill("#title", "小水滴的旅行（修訂）")
    bench.wait_for_timeout(800)
    bench.reload()
    bench.wait_for_selector("#questions .q")
    q1 = bench.locator("#questions .q").first
    check("重新整理後保留修改", q1.locator("[data-f=question]").input_value().startswith("老師改過") and q1.locator("input[type=radio][value='2']").is_checked())
    check("章節跟著標題改", bench.input_value("#catChapter") == "小水滴的旅行（修訂）")

    # 8. 下載 PaGamO 題組版並驗證內容
    with bench.expect_download() as dl:
        bench.click("#dlGroup")
    path = OUT / dl.value.suggested_filename
    dl.value.save_as(str(path))
    wb = openpyxl.load_workbook(path)
    ws = wb[wb.sheetnames[0]]
    r11 = [c.value for c in ws[11]]
    r12 = [c.value for c in ws[12]]
    check("題組檔第 11 列是文章列", r11[0] == 1 and r11[1:4] == ["國語", "115上", "小水滴的旅行（修訂）"] and r11[5] == "小水滴的旅行（修訂）", str(r11[:7]))
    check("第 12 列是改過的第 1 題、正解 C", r12[0] == "1_1" and str(r12[8]).startswith("老師改過") and r12[20] == "C", str([r12[0], r12[8], r12[20]]))
    check("題組檔預設選項隨機排列（v）", all(ws.cell(row=i, column=24).value == "v" for i in range(12, 20)), str([ws.cell(row=i, column=24).value for i in range(12, 20)]))
    check("題組檔共 10+1+8 列", ws.max_row == 19, str(ws.max_row))
    check("檔名", dl.value.suggested_filename == "PIRLS_PaGamO_題組_小水滴的旅行（修訂）.xlsx", dl.value.suggested_filename)
    with bench.expect_download() as dl2:
        bench.click("#dlChoice")
    path2 = OUT / dl2.value.suggested_filename
    dl2.value.save_as(str(path2))
    ws2 = openpyxl.load_workbook(path2).active
    r = [c.value for c in ws2[11]]
    check("選擇題版第 11 列是第 1 題", r[0] == 1 and r[1:4] == ["國語", "115上", "小水滴的旅行（修訂）"] and r[17] == "C", str(r[:6]))
    check("選擇題檔預設選項隨機排列（v）", r[20] == "v", str(r[20]))
    # 切到「固定」再下載：要寫 x
    bench.click("label:has(input[name=optorder][value=fixed])")
    bench.wait_for_timeout(300)
    with bench.expect_download() as dl_fixed:
        bench.click("#dlChoice")
    pf = OUT / ("fixed_" + dl_fixed.value.suggested_filename); dl_fixed.value.save_as(str(pf))
    check("切換「固定」後寫 x", openpyxl.load_workbook(pf).active.cell(row=11, column=21).value == "x")
    bench.click("label:has(input[name=optorder][value=random])")
    bench.wait_for_timeout(300)

    # 9. 匯出前檢查：清空一個選項要被擋
    q1.locator("[data-opt='1']").fill("")
    bench.wait_for_timeout(500)
    bench.click("#dlGroup")
    bench.wait_for_timeout(300)
    check("選項空白時擋下匯出", "選項 2 不可空白" in bench.inner_text("#exportErr"), bench.inner_text("#exportErr"))
    q1.locator("[data-opt='1']").fill("石頭上")

    bench.screenshot(path=str(OUT / "workbench-desktop.png"), full_page=True)
    bench.set_viewport_size({"width": 375, "height": 800})
    bench.wait_for_timeout(300)
    check("工作台手機版沒有水平捲動", bench.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1"),
          str(bench.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")))
    bench.screenshot(path=str(OUT / "workbench-mobile.png"), full_page=True)
    bench.set_viewport_size({"width": 1440, "height": 900})

    # 10. 文字模式（模擬右鍵帶入）
    article = "清晨，小水滴躺在荷葉上，看著太陽慢慢升起。" * 6
    bench.evaluate("""(t) => chrome.storage.local.set({ sourceText: { text: t, title: '測試文章頁' }, sourceMode: 'text' })""", article)
    bench.wait_for_timeout(500)
    check("右鍵帶入的文字出現在文字分頁", bench.input_value("#sourceText") == article and bench.is_visible("#panel-text"))
    bench.once("dialog", lambda d: d.accept())
    n_before = len(calls)
    bench.click("#generate")
    bench.wait_for_selector("#genStatus:has-text('完成')", timeout=20000)
    gen = [c for c in calls[n_before:] if ":generateContent" in c["url"]]
    body = json.loads(gen[-1]["body"]) if gen else {}
    parts = body.get("contents", [{}])[0].get("parts", [])
    check("文字出題用 <ARTICLE> 提示詞、沒有圖片", len(parts) == 3 and "<ARTICLE>" in parts[0]["text"] and article in parts[0]["text"] and "不需要輸出 articleContent" in parts[1]["text"])
    sch = body.get("generationConfig", {}).get("responseSchema", {})
    check("文字模式不讓 AI 抄回原文（格式不含 articleContent）", "articleContent" not in sch.get("properties", {}) and "questions" in sch.get("properties", {}))
    check("文字模式保留原文", bench.input_value("#article") == article)

    # 10b. Google 不接受格式規定時，自動改用一般 JSON 模式
    reject["on"] = True
    bench.once("dialog", lambda d: d.accept())
    n_before = len(calls)
    bench.evaluate("document.querySelector('#genStatus').textContent = ''")
    bench.click("#generate")
    bench.wait_for_selector("#genStatus:has-text('完成')", timeout=20000)
    gen = [json.loads(c["body"]) for c in calls[n_before:] if ":generateContent" in c["url"]]
    check("格式規定被拒時自動退回 JSON 模式", len(gen) == 2 and "responseSchema" in gen[0]["generationConfig"]
          and "responseSchema" not in gen[1]["generationConfig"] and "JSON 格式" in json.dumps(gen[1], ensure_ascii=False), str(len(gen)))
    reject["on"] = False

    # 11. 無法框選的頁面：整張截圖到工作台裁切
    bench.evaluate("""async () => {
      const r = await chrome.storage.local.get('shots');
      const s = r.shots[0];
      await chrome.storage.local.set({ shots: [...r.shots, { ...s, id: 'needs-crop', needsCrop: true }], sourceMode: 'image' });
    }""")
    bench.wait_for_selector(".needs-crop")
    bench.click(".shot:nth-child(3) [data-act=crop]")
    bench.wait_for_selector("#cropModal:not(.hidden)")
    box = bench.locator("#cropCanvas").bounding_box()
    bench.mouse.move(box["x"] + 10, box["y"] + 10); bench.mouse.down()
    bench.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=6); bench.mouse.up()
    bench.click("#cropOk")
    bench.wait_for_timeout(800)
    sh = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots.find(s => s.id === 'needs-crop'))")
    check("工作台裁切後解除『尚未裁切』", sh and not sh["needsCrop"] and sh["width"] < shots[1]["width"], str(sh and [sh["needsCrop"], sh["width"]]))

    # 12. popup 能開啟
    pop = ctx.new_page()
    pop.goto(f"{base}/popup/popup.html")
    pop.wait_for_timeout(500)
    check("工具列小視窗顯示截圖數", "張截圖" in pop.inner_text("#n"), pop.inner_text("#n"))
    pop.screenshot(path=str(OUT / "popup.png"))


    # 13. 截圖失敗要看得到原因，並寫進錯誤紀錄本
    bench.evaluate("chrome.runtime.sendMessage({ type: 'START_CAPTURE', tab: { id: 987654, windowId: 987654, title: '不存在的分頁' } })")
    bench.wait_for_selector("#pageNotice:not(.hidden)", timeout=5000)
    check("截圖失敗時工作台顯示原因", "不允許截圖" in bench.inner_text("#pageNotice"), bench.inner_text("#pageNotice"))
    logp = ctx.new_page(); logp.goto(f"{base}/options/options.html"); logp.wait_for_selector("#logList li", timeout=5000)
    check("錯誤紀錄本記下截圖失敗", "截圖" in logp.inner_text("#logList"), logp.inner_text("#logList")[:80])
    logp.click("#logClear"); logp.wait_for_selector("#logEmpty:not(.hidden)")
    logp.close()

    # 14. 讀取部落格全文
    blog = ctx.new_page()
    blog.goto("https://pirls-test.example/blog.html")
    blog.bring_to_front()
    pg = open_popup_for("https://pirls-test.example/blog*")
    pg.click("#readPage", no_wait_after=True)
    bench.wait_for_timeout(1500)
    st = bench.evaluate("chrome.storage.local.get(['sourceText','sourceMode'])")
    txt = (st.get("sourceText") or {}).get("text", "")
    check("讀取全文：抓到文章正文", "放大鏡和筆記本" in txt and "不同季節的小河" in txt, txt[:80])
    check("讀取全文：濾掉選單、側欄、留言、頁尾", not any(k in txt for k in ["好物推薦", "熱門文章", "訂閱電子報", "路人甲", "版權所有"]), txt[-120:])
    check("讀取全文：段落保留換行", txt.count(chr(10)) >= 3, repr(txt[:120]))
    check("讀取全文：切到文字分頁並記錄來源", st.get("sourceMode") == "text" and (st.get("sourceText") or {}).get("from") == "page")
    bench.bring_to_front()
    bench.wait_for_timeout(500)
    check("工作台顯示來源（讀取全文）", "讀取全文" in bench.inner_text("#textMeta") and bench.input_value("#sourceText") == txt, bench.inner_text("#textMeta"))

    # 15. 長文提醒
    bench.fill("#sourceText", "一" * 5000)
    bench.wait_for_timeout(300)
    check("超過 4,000 字顯示建議刪減", bench.locator(".len-warn").count() == 1)
    bench.fill("#sourceText", "一" * 20001)
    bench.wait_for_timeout(300)
    check("超過 20,000 字顯示太長", bench.locator(".len-bad").count() == 1)
    bench.fill("#sourceText", txt)

    # 17. 送到 PaGamO（已登入）：下載備份 → 打開批量上傳頁 → 選「題組」→ 放好檔案 → 不自動按上傳
    bench.set_viewport_size({"width": 1440, "height": 900})
    bench.evaluate("chrome.storage.local.get('draft')")  # 確認還有題目
    # Playwright 攔不到擴充套件「新開分頁」的第一個請求，所以先開好 PaGamO 分頁，測「沿用已開分頁」這條路
    pg_pagamo = ctx.new_page()
    pg_pagamo.goto("https://www.pagamo.org/api/teacher_console/questions/add_questions/batch")
    with bench.expect_download() as dl3:
        bench.click("#sendGroup")
    check("送到 PaGamO 會先下載備份", dl3.value.suggested_filename.startswith("PIRLS_PaGamO_題組_"), dl3.value.suggested_filename)
    try:
        pg_pagamo.wait_for_selector(".ant-upload-list-item-name", timeout=15000)
    except Exception:
        print("DEBUG url:", pg_pagamo.url)
        print("DEBUG pending:", bench.evaluate("chrome.storage.local.get('pagamoPending').then(r => r.pagamoPending ? Object.keys(r.pagamoPending) : null)"))
        print("DEBUG track:", bench.evaluate("chrome.storage.session.get(null)"))
        print("DEBUG banner:", pg_pagamo.evaluate("document.querySelector('[data-pirls-pagamo]')?.shadowRoot?.textContent || 'none'"))
        print("DEBUG sw errors:", sw_logs[-10:])
        raise
    check("打開的是批量上傳頁", "add_questions/batch" in pg_pagamo.url, pg_pagamo.url)
    checked = pg_pagamo.evaluate("[...document.querySelectorAll('label.ant-radio-wrapper-checked')].map(l => l.textContent.trim())")
    check("自動選好「題組」題型", checked == ["題組"], str(checked))
    fname = pg_pagamo.inner_text(".ant-upload-list-item-name")
    check("自動放入題組檔", fname == dl3.value.suggested_filename, fname)
    b64 = pg_pagamo.evaluate("""async () => { const f = document.querySelector('input[type=file]').files[0];
      const u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); }""")
    tmp = OUT / "placed.xlsx"; tmp.write_bytes(base64.b64decode(b64))
    ws3 = openpyxl.load_workbook(tmp).active
    r11 = [c.value for c in ws3[11]]
    check("放進 PaGamO 的檔案內容正確（題組文章列）", r11[0] == 1 and r11[1] == "國語" and ws3.max_row == 19, str(r11[:4]) + f" rows={ws3.max_row}")
    banner = pg_pagamo.evaluate("document.querySelector('[data-pirls-pagamo]')?.shadowRoot?.textContent || ''")
    check("PaGamO 頁面顯示「請確認後按上傳」", "已選好題型" in banner and "上傳" in banner, banner[:80])
    check("不會自動按下上傳", pg_pagamo.evaluate("window.__submitted === undefined"))
    check("上傳按鈕被框起來提醒", "4px" in pg_pagamo.evaluate("document.querySelector('button[type=submit]').style.outline"))
    check("用完即清掉暫存檔", bench.evaluate("chrome.storage.local.get('pagamoPending').then(r => !r.pagamoPending)"))
    check("工作台在匯出區顯示說明", "PaGamO 批量上傳頁" in bench.inner_text("#exportOk"), bench.inner_text("#exportOk"))

    # 18. 還沒登入：先提示登入；登入後回到 PaGamO 首頁會自動帶到批量上傳並放好「選擇題」檔
    pagamo_state["logged_in"] = False
    with bench.expect_download():
        bench.click("#sendChoice")
    pg_pagamo.wait_for_url("**/sign_in", timeout=10000)
    pg_pagamo.wait_for_selector("[data-pirls-pagamo]", state="attached", timeout=8000)
    hint = pg_pagamo.evaluate("(document.querySelector('[data-pirls-pagamo]').shadowRoot || document.querySelector('[data-pirls-pagamo]')).textContent")
    check("沒登入時提示先登入（沿用同一個分頁）", "請先登入" in hint, hint[:60])
    pagamo_state["logged_in"] = True
    pg_pagamo.goto("https://www.pagamo.org/")  # 模擬登入成功後 PaGamO 帶回首頁
    pg_pagamo.wait_for_url("**/add_questions/batch", timeout=10000)
    pg_pagamo.wait_for_selector(".ant-upload-list-item-name", timeout=15000)
    checked = pg_pagamo.evaluate("[...document.querySelectorAll('label.ant-radio-wrapper-checked')].map(l => l.textContent.trim())")
    check("登入後自動回到批量上傳、選好「選擇題」並放好檔", checked == ["選擇題"] and "選擇題" in pg_pagamo.inner_text(".ant-upload-list-item-name"), str(checked))
    pg_pagamo.goto("https://www.pagamo.org/")
    pg_pagamo.wait_for_timeout(1500)
    check("完成後不再攔截 PaGamO 的其他頁面", "add_questions" not in pg_pagamo.url, pg_pagamo.url)

    # 19. 新版本提醒
    bench.evaluate("chrome.storage.local.remove('updateCheck')")
    bench.reload(); bench.wait_for_selector("#updateBanner:not(.hidden)", timeout=8000)
    ub = bench.inner_text("#updateBanner")
    check("網站有新版時工作台顯示提醒", "9.9.9" in ub and "下載新版" in ub, ub[:80])
    check("提醒連到安裝說明的更新段落", bench.get_attribute("#updateBanner a:nth-of-type(2)", "href").endswith("/extension/#update"))
    remote["version"] = bench.evaluate("chrome.runtime.getManifest().version")
    bench.evaluate("chrome.storage.local.remove('updateCheck')")
    bench.reload(); bench.wait_for_selector("#shotCount"); bench.wait_for_timeout(1200)
    check("已是最新版時不顯示提醒", bench.is_hidden("#updateBanner"))

    # 16. 舊版設定（Flash）升級：打開工作台就自動換成 Flash-Lite；手動選過的不動
    bench.evaluate("""async () => { const r = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...r.settings, model: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.0-flash-lite'], modelChosenByUser: false } }); }""")
    bench.reload(); bench.wait_for_selector("#shotCount"); bench.wait_for_timeout(500)
    m = bench.evaluate("chrome.storage.local.get('settings').then(r => r.settings.model)")
    check("舊設定自動換成 Flash-Lite", m == "gemini-2.0-flash-lite", m)
    bench.evaluate("""async () => { const r = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...r.settings, model: 'gemini-2.5-flash', modelChosenByUser: true } }); }""")
    bench.reload(); bench.wait_for_selector("#shotCount"); bench.wait_for_timeout(500)
    m = bench.evaluate("chrome.storage.local.get('settings').then(r => r.settings.model)")
    check("老師手動選的模型不會被換掉", m == "gemini-2.5-flash", m)

    # 400 來自第 2 步故意送無效金鑰；pagamo.org 開頭的是 PaGamO 網站自己的程式錯誤（擴充套件換網址時可能連到真站的登入頁）
    sw_errors = [e for e in errors if "favicon" not in e and "status of 400" not in e and not e.startswith("https://www.pagamo.org")]
    check("沒有任何 JavaScript 錯誤", not sw_errors, "\n".join(sw_errors[:10]))
    ctx.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} 通過（截圖與下載檔：{OUT}）")
sys.exit(1 if failed else 0)
