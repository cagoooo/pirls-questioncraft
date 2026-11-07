# 產生網站「擴充套件安裝說明頁」用的截圖（繁體中文介面），輸出到 public/extension/img/*.webp
# 需求：pip install playwright pillow ＆ python -m playwright install chromium
# 執行：python -X utf8 tools/capture-extension-guide.py
import io, json, pathlib, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
OUT = ROOT / "public" / "extension" / "img"
OUT.mkdir(parents=True, exist_ok=True)

LEVELS = ["locate & retrieve", "make straightforward inferences", "interpret & integrate", "evaluate & critique"]
SAMPLE = {
    "title": "小河邊的觀察日記",
    "articleContent": "星期六早上，我和爸爸帶著放大鏡和筆記本，來到家附近的小河邊。河水清清的，可以看到河底的小石頭和游來游去的小魚。\n\n接著，我們發現一隻白鷺鷥站在淺水裡，一動也不動。過了好一會兒，牠突然把嘴巴伸進水裡，叼起一條小魚。",
    "questions": [
        {"question": "作者和爸爸去小河邊時，帶了哪些東西？", "options": ["放大鏡和筆記本", "釣竿和水桶", "相機和望遠鏡", "畫板和彩色筆"], "correctAnswerIndex": 0,
         "explanation": "線索在第 1 段：「我和爸爸帶著放大鏡和筆記本」。釣竿、相機、畫板在文中都沒有出現。這題練習「訊息提取」：找出文中明確寫出的資訊。", "pirlsLevel": LEVELS[0]},
        {"question": "白鷺鷥為什麼能抓到小魚？", "options": ["牠游得比魚快", "牠很有耐心地等待", "爸爸幫忙把魚趕過去", "河水很混濁看不清楚"], "correctAnswerIndex": 1,
         "explanation": "線索在第 2 段：白鷺鷥「一動也不動」，過了好一會兒才出手，可以推論牠是靠耐心等待。其他選項文中都沒有提到。這題練習「直接推論」。", "pirlsLevel": LEVELS[1]},
    ],
}

DSF = 2  # 高解析度拍攝，網頁上看起來比較清楚

def webp(png_bytes, name, crop=None, width=None):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if crop:
        im = im.crop(tuple(round(v * DSF) for v in crop))
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=86, method=6)
    print("✓", name, im.size)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), channel="chromium", headless=True, locale="zh-TW",
        viewport={"width": 1280, "height": 800}, device_scale_factor=DSF,
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}", "--lang=zh-TW"])
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
    base = sw.url.rsplit("/", 1)[0]

    # 1. chrome://extensions：開發人員模式＋載入未封裝項目
    pg = ctx.new_page()
    pg.set_viewport_size({"width": 900, "height": 600})
    pg.goto("chrome://extensions")
    pg.wait_for_timeout(1200)
    pg.evaluate("""() => {
      const t = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar');
      const dev = t.shadowRoot.querySelector('#devMode');
      if (!dev.checked) dev.click();
    }""")
    pg.wait_for_timeout(800)
    webp(pg.screenshot(), "step-devmode", crop=(0, 0, 900, 260), width=1400)
    pg.close()

    # 2. 設定頁：貼上金鑰
    pg = ctx.new_page()
    pg.goto(f"{base}/options/options.html")
    pg.wait_for_selector("#keyStatus")
    pg.fill("#key", "AQ.這裡貼上你自己的金鑰")
    pg.evaluate("""() => { const s = document.getElementById('keyStatus'); s.className = 'notice ok';
      s.innerHTML = '✅ 可以使用！已選好模型 <b>gemini-2.5-flash-lite</b>。<br>現在可以到網頁上按工具列的 PIRLS 圖示出題。'; }""")
    card = pg.locator("section.card").first.bounding_box()
    webp(pg.screenshot(full_page=True), "step-key", crop=(int(card["x"]) - 8, int(card["y"]) - 8, int(card["x"] + card["width"]) + 8, int(card["y"] + card["height"]) + 14), width=1400)
    pg.evaluate("chrome.storage.local.get('settings').then(r => chrome.storage.local.set({ settings: { ...(r.settings || {}), apiKey: 'demo', model: 'gemini-2.5-flash-lite' } }))")

    # 3. 工具列小視窗
    pop = ctx.new_page()
    pop.set_viewport_size({"width": 340, "height": 520})
    pop.goto(f"{base}/popup/popup.html")
    pop.wait_for_timeout(500)
    h = pop.evaluate("document.body.scrollHeight")
    webp(pop.screenshot(), "step-popup", crop=(0, 0, 340, min(520, h + 8)), width=680)
    pop.close()

    # 4. 裁切視窗（用一張文章截圖）
    art = ctx.new_page()
    art.set_content("""<html><body style="margin:0;font:22px/1.9 'Microsoft JhengHei';background:#fff">
      <div style="padding:48px 64px"><h1>小河邊的觀察日記</h1>
      <p>星期六早上，我和爸爸帶著放大鏡和筆記本，來到家附近的小河邊。河水清清的，可以看到河底的小石頭和游來游去的小魚。</p>
      <p>接著，我們發現一隻白鷺鷥站在淺水裡，一動也不動。過了好一會兒，牠突然把嘴巴伸進水裡，叼起一條小魚。</p></div></body></html>""")
    shot = art.screenshot(type="jpeg", quality=90)
    import base64
    data_url = "data:image/jpeg;base64," + base64.b64encode(shot).decode()
    bench = ctx.new_page()
    bench.goto(f"{base}/workbench/workbench.html")
    bench.wait_for_selector("#shotCount")
    bench.evaluate("""(u) => chrome.storage.local.set({ shots: [{ id: 'guide', ts: Date.now(), dataUrl: u, title: '小河邊的觀察日記', needsCrop: true, autoCrop: true }], sourceMode: 'image' })""", data_url)
    bench.wait_for_selector("#cropModal:not(.hidden)")
    b = bench.locator("#cropCanvas").bounding_box()
    bench.mouse.move(b["x"] + b["width"] * 0.03, b["y"] + b["height"] * 0.04); bench.mouse.down()
    bench.mouse.move(b["x"] + b["width"] * 0.97, b["y"] + b["height"] * 0.5, steps=8); bench.mouse.up()
    webp(bench.screenshot(), "step-crop", width=1600)
    bench.click("#cropOk")
    bench.wait_for_timeout(500)

    # 5. 工作台：檢查題目＋送到 PaGamO
    bench.evaluate("""(d) => chrome.storage.local.set({ draft: { data: d, questionMode: '8-questions', languageMode: 'zh-TW',
        model: 'gemini-2.5-flash-lite', generatedAt: Date.now(), warnings: [], source: 'image',
        category: { subject: '閱讀素養題組', book: '115上', chapter: d.title }, chapterFollowsTitle: true } })""", SAMPLE)
    bench.reload()
    bench.wait_for_selector("#questions .q")
    q = bench.locator("#questions .q").first.bounding_box()
    res = bench.locator("#resultCard").bounding_box()
    full = bench.screenshot(full_page=True)
    webp(full, "step-review", crop=(int(res["x"]) - 6, int(res["y"]) - 6, int(res["x"] + res["width"]) + 6, int(q["y"] + q["height"]) + 12), width=1400)
    exp = bench.locator("#exportCard").bounding_box()
    webp(full, "step-send", crop=(int(exp["x"]) - 6, int(exp["y"]) - 6, int(exp["x"] + exp["width"]) + 6, int(exp["y"] + 360)), width=1400)
    ctx.close()
