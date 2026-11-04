#!/usr/bin/env python3
"""Isolated Fred browser checks; does not touch the user's browser session."""
import argparse,json,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:8010/fred/');p.add_argument('--deps',default='/private/tmp/shift-browser-deps');p.add_argument('--output',type=Path,default=Path('/private/tmp/fred-browser-qa'))
p.add_argument('--desktop-only',action='store_true');p.add_argument('--soak-seconds',type=int,default=0);args=p.parse_args()
sys.path.insert(0,args.deps)
from playwright.sync_api import sync_playwright
args.output.mkdir(parents=True,exist_ok=True);results=[];errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for name,width,height,touch in [('desktop',1440,1000,False),('mobile',390,844,True),('narrow',320,740,True),('landscape',844,390,True)]:
        if args.desktop_only and name!='desktop':continue
        ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=touch);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script('''(() => {
          const C=globalThis.AudioContext||globalThis.webkitAudioContext,create=C.prototype.createGain;
          C.prototype.createGain=function(...args){const gain=create.apply(this,args);globalThis.__fredAudioProbe={context:this,gain};return gain;};
        })();''')
        page.on('console',lambda m: print('Browser:',m.text,flush=True) if m.type=='error' else None)
        page.goto(args.url)
        try:page.wait_for_function('globalThis.fredDebug',timeout=6000)
        except Exception:print('Page errors:',errors,flush=True);raise
        assert page.locator('.brand img').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
        page.screenshot(path=str(args.output/f'{name}-title.png'));page.locator('#start').click();page.wait_for_function('fredDebug.audio.loaded')
        music=page.evaluate('''async () => {
          const {context,gain}=globalThis.__fredAudioProbe,analyser=context.createAnalyser();analyser.fftSize=2048;gain.connect(analyser);
          const samples=new Float32Array(analyser.fftSize);let peak=0,rms=0;
          for(let i=0;i<24;i++){
            await new Promise(resolve=>setTimeout(resolve,25));analyser.getFloatTimeDomainData(samples);let square=0;
            for(const sample of samples){peak=Math.max(peak,Math.abs(sample));square+=sample*sample;}
            rms=Math.max(rms,Math.sqrt(square/samples.length));
          }
          gain.disconnect(analyser);return {peak,rms,state:context.state,music:fredDebug.audio.music};
        }''')
        assert music['music'] and music['state']=='running' and music['peak']>.001 and music['rms']>.0005,('Music output is silent',music)
        before=page.evaluate('fredDebug.game.x');page.keyboard.down('ArrowRight');page.wait_for_timeout(650);page.keyboard.up('ArrowRight');after=page.evaluate('fredDebug.game.x');assert after>before,(before,after)
        page.keyboard.press('KeyP');assert page.evaluate('fredDebug.paused');tick=page.evaluate('fredDebug.game.tick');page.wait_for_timeout(180);assert page.evaluate('fredDebug.game.tick')==tick
        page.keyboard.press('KeyP');assert not page.evaluate('fredDebug.paused');page.keyboard.press('Space');page.keyboard.press('KeyM');assert not page.evaluate('fredDebug.audio.music')
        soak=None
        if name=='desktop' and args.soak_seconds:
            page.locator('#restart').click();page.keyboard.down('ArrowRight');page.keyboard.down('ArrowUp')
            for second in range(args.soak_seconds):
                page.keyboard.down('Space');page.wait_for_timeout(250);page.keyboard.up('Space');page.wait_for_timeout(750)
            page.keyboard.up('ArrowRight');page.keyboard.up('ArrowUp')
            soak=page.evaluate('({level:fredDebug.game.level,camera:fredDebug.game.camera,lives:fredDebug.game.lives,ended:fredDebug.game.ended,score:fredDebug.game.score})')
        if touch:
            page.locator('#restart').click();page.locator('.atari-touch-host').scroll_into_view_if_needed()
            stick=page.locator('.atari-stick').bounding_box();fire=page.locator('.atari-fire').bounding_box();session=ctx.new_cdp_session(page)
            center={'x':stick['x']+stick['width']/2,'y':stick['y']+stick['height']/2,'id':1}
            held={'x':center['x']+stick['width']*.4,'y':center['y'],'id':1};trigger={'x':fire['x']+fire['width']/2,'y':fire['y']+fire['height']/2,'id':2}
            start=page.evaluate('({x:fredDebug.game.x,stones:fredDebug.game.stones})')
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[center]})
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[held]})
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[held,trigger]})
            page.wait_for_timeout(450);end=page.evaluate('({x:fredDebug.game.x,stones:fredDebug.game.stones})')
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(100)
            assert end['x']>start['x'] and end['stones']<start['stones'],(name,start,end)
            assert page.evaluate('fredDebug.game.triggerReleased')==1
        page.wait_for_timeout(180);page.keyboard.press('KeyF');page.wait_for_function('!!document.fullscreenElement')
        dims=page.evaluate('''() => {const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};return {arcade:r('.arcade'),screen:r('.screen'),canvas:r('canvas'),width:innerWidth,height:innerHeight};}''')
        assert abs(dims['arcade']['width']-width)<2 and abs(dims['arcade']['height']-height)<2,dims
        assert abs(dims['screen']['width']-dims['canvas']['width'])<2 and abs(dims['screen']['height']-dims['canvas']['height'])<2,dims
        page.screenshot(path=str(args.output/f'{name}-fullscreen.png'));page.keyboard.press('KeyF');page.wait_for_function('!document.fullscreenElement')
        page.goto(args.url+'?lang=en');assert page.locator('html').get_attribute('lang')=='en';assert page.locator('#start').inner_text()=='Start game →'
        results.append({'viewport':name,'movement':[before,after],'fullscreen':dims,'audio':True,'musicOutput':music,'twoTouchInput':touch,'soak':soak});ctx.close()
    version=browser.version;browser.close()
assert not errors,errors
result={'browser':version,'url':args.url,'checks':results,'errors':errors};(args.output/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
