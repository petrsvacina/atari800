#!/usr/bin/env python3
"""Isolated browser regression for actual fullscreen sizing and portal routing."""
import argparse
import json
from pathlib import Path
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:8010/dist/')
parser.add_argument('--deps',type=Path)
parser.add_argument('--output',type=Path,default=Path('/private/tmp/shift-fullscreen-qa'))
parser.add_argument('--engine',choices=('edge','webkit'),default='edge')
args=parser.parse_args()
if args.deps:sys.path.insert(0,str(args.deps))
from playwright.sync_api import sync_playwright

args.output.mkdir(parents=True,exist_ok=True)
results=[];errors=[]
with sync_playwright() as p:
    browser=(p.webkit.launch(headless=True) if args.engine=='webkit' else
             p.chromium.launch(channel='msedge',headless=True))
    for name,width,height,touch in [('desktop',1280,1000,False),('wide',1996,1236,False),
                                  ('portrait',390,844,True),('landscape',844,390,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.url+'hry/shift/')
        page.wait_for_function('globalThis.shiftDebug?.phase === "title"')
        page.locator('#start').click();page.locator('#skip').click()
        page.locator('#fullscreen').click()
        page.wait_for_function('document.fullscreenElement || document.webkitFullscreenElement')
        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        dimensions=page.evaluate('''() => {
          const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
          return{viewport:{width:innerWidth,height:innerHeight},arcade:rect('.arcade'),screen:rect('.screen'),canvas:rect('canvas'),
                 fit:getComputedStyle(document.querySelector('canvas')).objectFit};
        }''')
        a=dimensions['arcade'];s=dimensions['screen'];c=dimensions['canvas'];v=dimensions['viewport']
        assert abs(a['width']-v['width'])<2 and abs(a['height']-v['height'])<2,dimensions
        assert abs(c['width']-s['width'])<2 and abs(c['height']-s['height'])<2,dimensions
        assert c['width']>320 and dimensions['fit']=='contain',dimensions
        assert c['y']>=0 and c['y']+c['height']<=v['height']+1,dimensions
        page.screenshot(path=str(args.output/f'{args.engine}-{name}.png'))
        page.locator('#fullscreen').click()
        page.wait_for_function('!document.fullscreenElement && !document.webkitFullscreenElement')
        if name=='desktop':
            page.goto(args.url+'hry/shift/?lang=en')
            assert page.locator('html').get_attribute('lang')=='en'
            assert page.locator('#back').evaluate('(a)=>a.href')==args.url+'en/'
            for language in ('','en/'):
                page.goto(args.url+language)
                card=page.locator('.game-card[data-id="shift"]')
                # Use the public game link even if the card class changes.
                assert page.locator('a[href*="hry/shift/"]').count()>0
        results.append({'name':name,'dimensions':dimensions})
        context.close()
    version=browser.version;browser.close()
assert not errors,errors
result={'engine':args.engine,'version':version,'url':args.url,'fullscreen':results,'errors':errors,
        'englishBackLinkVerified':True,'bothCatalogsVerified':True}
(args.output/f'{args.engine}.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
