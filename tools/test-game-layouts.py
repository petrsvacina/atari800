#!/usr/bin/env python3
"""Browser regression for consistent game shells, mobile layouts and fullscreen keys."""
import argparse
import json
from pathlib import Path
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:8010/dist/')
parser.add_argument('--deps',type=Path)
parser.add_argument('--output',type=Path,default=Path('/private/tmp/atari-game-layouts'))
args=parser.parse_args()
if args.deps:sys.path.insert(0,str(args.deps))
from playwright.sync_api import sync_playwright

args.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for name,width,height,touch,language in [('desktop',1440,1000,False,'cs'),('english',1440,1000,False,'en'),
                  ('wide',1996,1248,False,'cs'),('mobile',390,844,True,'cs'),('landscape',844,390,True,'cs')]:
        for slug in ('shift','neverending-story','karateka'):
            context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch)
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(args.url+f'hry/{slug}/?lang={language}')
            page.wait_for_function('document.readyState === "complete"')
            assert page.locator('html').get_attribute('lang')==language
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            layout=page.evaluate('''() => {
              const rect=s=>{const el=document.querySelector(s);if(!el||!el.getClientRects().length)return null;
                const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
              return{game:rect('.arcade,.machine'),aside:rect('aside'),logo:rect('.brand'),back:rect('#back')};
            }''')
            if width>=1000:
                assert layout['aside']['x']>=layout['game']['right']+15,layout
                assert abs(layout['aside']['y']-layout['game']['y'])<5,layout
                if slug!='karateka':
                    assert layout['logo'] and layout['back']['x']>layout['logo']['right'],layout
                    assert page.locator('.brand img').evaluate('(img)=>img.complete && img.naturalWidth>0')
                    assert page.locator('#back').evaluate('(a)=>a.href')==args.url+('en/' if language=='en' else '')
            elif layout['aside']:
                assert layout['aside']['y']>=layout['game']['bottom']-1,layout
            page.screenshot(path=str(args.output/f'{name}-{slug}-page.png'),full_page=True)
            if slug=='neverending-story':
                page.locator('#continue').click()
                page.wait_for_function('document.querySelector("#overlay").dataset.mode === "pause"')
                page.locator('#continue').click()
                page.wait_for_function('!document.querySelector("#command").disabled')
                page.locator('#command').fill('');page.locator('#command').press('f')
                assert page.locator('#command').input_value()=='f'
                assert not page.evaluate('!!document.fullscreenElement')
                if language=='en':
                    page.locator('[data-lang="cs"]').click()
                    assert page.locator('html').get_attribute('lang')=='cs'
                    assert page.locator('#back').evaluate('(a)=>a.href')==args.url
            else:
                if slug=='shift':
                    page.locator('#start').click();page.locator('#code').fill('');page.keyboard.press('f')
                    assert not page.evaluate('!!document.fullscreenElement')
                    assert 'F' in page.locator('#code').input_value().upper()
                    page.locator('#skip').click()
                else:
                    # Exercise the fullscreen sizing while a real cinematic is visible.
                    page.locator('#intro').click();page.locator('#movie').wait_for(state='visible')
                    page.locator('#game').focus()
                page.keyboard.down('f')
                page.wait_for_function('!!document.fullscreenElement')
                page.keyboard.down('f')  # Repeated keydown must not toggle out again.
                page.keyboard.up('f')
                assert page.evaluate('!!document.fullscreenElement')
                page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                fullscreen=page.evaluate('''() => {
                  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
                  return{viewport:{width:innerWidth,height:innerHeight},arcade:box('.arcade'),display:box('.display,.screen'),canvas:box('#game'),
                    movie:document.querySelector('#movie')?box('#movie'):null,fit:getComputedStyle(document.querySelector('#game')).objectFit};
                }''')
                a=fullscreen['arcade'];d=fullscreen['display'];c=fullscreen['canvas'];v=fullscreen['viewport']
                assert abs(a['width']-v['width'])<2 and abs(a['height']-v['height'])<2,fullscreen
                assert abs(c['width']-d['width'])<2 and abs(c['height']-d['height'])<2,fullscreen
                assert c['height']>100 and fullscreen['fit']=='contain',fullscreen
                if fullscreen['movie']:
                    assert abs(fullscreen['movie']['height']-d['height'])<2,fullscreen
                    assert abs(fullscreen['movie']['width']-d['width'])<2,fullscreen
                page.screenshot(path=str(args.output/f'{name}-{slug}-fullscreen.png'))
                if slug=='karateka':
                    for _ in range(2):
                        if page.locator('#skip').is_visible():page.locator('#skip').click()
                    page.wait_for_function('document.querySelector("#movie").hidden && document.querySelector("#overlay").hidden')
                    page.screenshot(path=str(args.output/f'{name}-{slug}-fullscreen-game.png'))
                    gameplay=page.evaluate('''() => {
                      const c=document.querySelector('#game').getBoundingClientRect(),d=document.querySelector('.display').getBoundingClientRect();
                      return{canvasHeight:c.height,displayHeight:d.height,canvasWidth:c.width,displayWidth:d.width};
                    }''')
                    assert abs(gameplay['canvasHeight']-gameplay['displayHeight'])<2,gameplay
                    assert abs(gameplay['canvasWidth']-gameplay['displayWidth'])<2,gameplay
                page.keyboard.press('f');page.wait_for_function('!document.fullscreenElement')
                # Fullscreen button must still toggle in both directions.
                page.locator('#fullscreen').click();page.wait_for_function('!!document.fullscreenElement')
                page.locator('#fullscreen').click();page.wait_for_function('!document.fullscreenElement')
                checks.append({'view':name,'game':slug,'layout':layout,'fullscreen':fullscreen,'keyAndButtonVerified':True})
            context.close()
    version=browser.version;browser.close()
assert not errors,errors
result={'url':args.url,'engine':'Microsoft Edge headless','version':version,'viewports':5,'games':3,
        'fullscreenChecks':checks,'errors':errors,'neverendingStoryTextFVerified':True,'mobileStackingVerified':True}
(args.output/'results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'url':args.url,'games':3,'viewports':5,'fullscreenChecks':len(checks),'errors':errors,
                  'neverendingStoryTextFVerified':True,'mobileStackingVerified':True},indent=2))
