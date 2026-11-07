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
    ctx.route("https://pirls-test.example/**", lambda r: r.fulfill(body=ARTICLE_HTML, content_type="text/html; charset=utf-8"))

    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
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
    check("測試金鑰成功並選 gemini-2.5-flash", opts.input_value("#model") == "gemini-2.5-flash", opts.inner_text("#keyStatus"))
    check("排除非出題模型", "text-embedding-004" not in opts.inner_html("#model"))
    check("金鑰放在 header 不放網址", all("key=" not in c["url"] for c in calls) and calls[-1]["key"].startswith("FAKE_KEY"))
    opts.fill("#subject", "國語")
    opts.wait_for_timeout(700)
    opts.screenshot(path=str(OUT / "options-desktop.png"), full_page=True)
    opts.set_viewport_size({"width": 375, "height": 800})
    check("設定頁手機版沒有水平捲動", opts.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1"))
    opts.screenshot(path=str(OUT / "options-mobile.png"), full_page=True)

    # 4. 在文章頁框選截圖
    art = ctx.new_page()
    art.goto("https://pirls-test.example/article.html")
    bench = ctx.new_page()
    bench.goto(f"{base}/workbench/workbench.html")
    bench.wait_for_selector("#shotCount")
    art.bring_to_front()
    def start_capture():
        bench.evaluate("""async () => {
          const [t] = await chrome.tabs.query({ url: 'https://pirls-test.example/*' });
          return chrome.runtime.sendMessage({ type: 'START_CAPTURE', tab: t });
        }""")
    start_capture()
    art.wait_for_timeout(800)
    art.mouse.move(30, 30); art.mouse.down(); art.mouse.move(400, 200, steps=8); art.mouse.move(700, 330, steps=8); art.mouse.up()
    art.wait_for_timeout(1500)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    check("框選後新增 1 張截圖", len(shots) == 1, str(len(shots)))
    if shots:
        dpr = art.evaluate("devicePixelRatio")
        check("裁切尺寸正確（約 670×300 CSS px）", abs(shots[0]["width"] - 670 * dpr) <= 4 and abs(shots[0]["height"] - 300 * dpr) <= 4, f"{shots[0]['width']}x{shots[0]['height']} dpr={dpr}")
        pathlib.Path(OUT / "shot1.jpg").write_bytes(base64.b64decode(shots[0]["dataUrl"].split(",")[1]))
    # Esc 取消
    start_capture(); art.wait_for_timeout(700); art.keyboard.press("Escape"); art.wait_for_timeout(500)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    check("Esc 取消不會新增截圖", len(shots) == 1)
    # Enter 擷取整個畫面
    start_capture(); art.wait_for_timeout(700); art.keyboard.press("Enter"); art.wait_for_timeout(1500)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    check("Enter 擷取整個畫面", len(shots) == 2 and shots[1]["width"] >= 1400, str([s.get("width") for s in shots]))
    art.screenshot(path=str(OUT / "article-toast.png"))
    # 提示框還在時立刻再截一張：新截圖右下角不可有提示框
    from PIL import Image
    import io
    start_capture(); art.wait_for_timeout(700); art.keyboard.press("Enter"); art.wait_for_timeout(1500)
    shots = bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])")
    im = Image.open(io.BytesIO(base64.b64decode(shots[-1]["dataUrl"].split(",")[1]))).convert("RGB")
    px = im.getpixel((im.width - int(im.width * 0.1), im.height - int(im.height * 0.08)))
    check("連續截圖不會拍到上一張的提示框", min(px) > 235, str(px))
    # 框選畫面還開著又按一次：不會卡住，拖曳後只新增一張
    start_capture(); art.wait_for_timeout(600); start_capture(); art.wait_for_timeout(800)
    art.mouse.move(50, 50); art.mouse.down(); art.mouse.move(300, 200, steps=6); art.mouse.up(); art.wait_for_timeout(1500)
    n = len(bench.evaluate("chrome.storage.local.get('shots').then(r => r.shots || [])"))
    check("框選中重按一次仍正常", n == len(shots) + 1, f"{n} vs {len(shots)}+1")
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
    check("出題請求附上 2 張圖片＋提示詞", sum(1 for x in parts if "inline_data" in x) == 2 and "PIRLS" in parts[-1].get("text", ""))
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
    check("題組檔共 10+1+8 列", ws.max_row == 19, str(ws.max_row))
    check("檔名", dl.value.suggested_filename == "PIRLS_PaGamO_題組_小水滴的旅行（修訂）.xlsx", dl.value.suggested_filename)
    with bench.expect_download() as dl2:
        bench.click("#dlChoice")
    path2 = OUT / dl2.value.suggested_filename
    dl2.value.save_as(str(path2))
    ws2 = openpyxl.load_workbook(path2).active
    r = [c.value for c in ws2[11]]
    check("選擇題版第 11 列是第 1 題", r[0] == 1 and r[1:4] == ["國語", "115上", "小水滴的旅行（修訂）"] and r[17] == "C", str(r[:6]))

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
    check("文字出題用 <ARTICLE> 提示詞、沒有圖片", len(parts) == 1 and "<ARTICLE>" in parts[0]["text"] and article in parts[0]["text"])
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

    sw_errors = [e for e in errors if "favicon" not in e and "status of 400" not in e]  # 400 來自第 2 步故意送無效金鑰
    check("沒有任何 JavaScript 錯誤", not sw_errors, "\n".join(sw_errors[:10]))
    ctx.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} 通過（截圖與下載檔：{OUT}）")
sys.exit(1 if failed else 0)
