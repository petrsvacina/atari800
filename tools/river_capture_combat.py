#!/usr/bin/env python3
"""Record original NPC/tank updates for native rule verification (development only)."""
import json,hashlib
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
def capture():
 source=ROOT/'River Raid.xex';assert hashlib.sha256(source.read_bytes()).hexdigest()=='a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b'
 cases=[]
 # Original foreground actor routine, with hardware RNG replaced at its read.
 configs=[{'stage':1},{'stage':2},{'stage':7},{'stage':50},{'stage':7,'playing':False},{'stage':7,'flip':1},{'stage':7,'nearest':4},{'stage':7,'random':15},{'stage':13,'follow':255},{'stage':13,'follow':255,'bankCollision':True}]
 m=XexMonitor(source)
 try:
  m.prompt('bpc a197');m.prompt('cont');m.prompt('c d40e 00');m.prompt('c a2f5 60');m.prompt('c 0600 20 f5 a1 4c 00 07')
  for config in configs:
   actors=[{'frame':frame,'rawX':90+i*8,'flags':flags} for i,(frame,flags) in enumerate([(2,0),(3,64),(4,72),(5,81),(6,65),(7,0),(8,64),(9,65),(10,81),(12,64),(13,64)])]
   # Tank traverses, freezes after bridge loss, then enters its destruction frames.
   m.prompt('f 000c 0016 00');m.prompt('f 0500 052b 00');m.prompt('f 0042 004c 00');m.prompt(f"c 20 {0 if config.get('bankCollision') else 255:02x}")
   m.prompt(f"c 60 {config['stage']:02x}");m.prompt(f"c 76 {0 if config.get('playing',True) else 48:02x}");m.prompt('c 29 00');m.prompt(f"c 33 {config.get('flip',0):02x}");m.prompt(f"c 4e {config.get('nearest',11):02x}");m.prompt('c 4d 00');m.prompt('c 78 00');m.prompt('c 2e 00');m.prompt('c 38 05 70 64');m.prompt(f"c 41 {config.get('follow',0):02x}");m.prompt('c 50 ff')
   m.prompt(f"c a205 a9 {config.get('random',64):02x} ea")
   for i,a in enumerate(actors):m.prompt(f"c {0x500+i:04x} {a['frame']:02x}");m.prompt(f"c {0x516+i:04x} {a['rawX']:02x}");m.prompt(f"c {0x42+i:04x} {a['flags']:02x}")
   frames=[]
   for tick in range(96):
    if tick==32:m.prompt('c 2e 01')
    if tick==64:m.prompt('c 38 85')
    m.prompt(f'c 18 {tick:02x}');m.prompt('bpc 0700');m.prompt('setpc 0600');m.prompt('cont');m.prompt('write 0000 052b /private/tmp/river-combat-reference.bin');b=Path('/private/tmp/river-combat-reference.bin').read_bytes()
    frames.append({'tick':tick,'bridgeDestroyed':tick>=32,'tank':{'frame':b[0x38],'rawX':b[0x39],'phase':b[0x50]},'actors':[{'frame':b[0x500+i],'rawX':b[0x516+i],'flags':b[0x42+i]} for i in range(11)]})
   cases.append({'config':config,'initialActors':actors,'frames':frames})
   print('Captured original combat',config,flush=True)
  # Isolated tank projectile routine, both directions and fractional velocities.
  shots=[];m.prompt('c a673 60');m.prompt('c 0600 20 07 a6 4c 00 07')
  for frame,dx,fractionDX,playing in [(5,1,128,True),(6,1,128,True),(5,4,0,True),(6,0,128,False)]:
   initial={'frame':frame,'rawX':112,'rawY':40,'phase':0,'dx':dx,'fractionDX':fractionDX,'shotX':0,'shotY':0,'fraction':0}
   m.prompt(f'c 38 {frame:02x} 70 28 00 00 00 {dx:02x} {fractionDX:02x} 00');m.prompt('c 50 00');m.prompt(f'c 76 {0 if playing else 48:02x}')
   frames=[]
   for tick in range(96):
    m.prompt('setpc 0600');m.prompt('cont');m.prompt('write 0038 0050 /private/tmp/river-shot-reference.bin');b=Path('/private/tmp/river-shot-reference.bin').read_bytes()
    frames.append({'phase':b[24],'picture':b[3],'shotX':b[4],'fraction':b[5],'shotY':b[8]})
   shots.append({'initial':initial,'playing':playing,'frames':frames})
 finally:m.close()
 (ROOT/'tools/fixtures/river-combat-oracle.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cases':cases,'shots':shots},separators=(',',':'))+'\n')
if __name__=='__main__':capture()
