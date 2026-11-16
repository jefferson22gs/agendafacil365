# Exporta os criativos de creatives.html para PNG (1080x1920 Status/Stories, 1080x1080 feed).
# Uso: python marketing/ads/render.py  -> marketing/ads/out/*.png
import os
from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out')
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1200, 'height': 2000}, device_scale_factor=1)
    page.goto('file:///' + os.path.join(here, 'creatives.html').replace('\\', '/'), wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    for el in page.locator('section.ad').all():
        name = el.get_attribute('id')
        el.screenshot(path=os.path.join(out, f'{name}.png'))
        print(name, el.bounding_box())
    browser.close()
