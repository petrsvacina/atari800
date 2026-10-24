#!/usr/bin/env python3
"""Export named non-executable puzzle tables and bitmap records from captured XEX RAM.
Run goonies_extract_physics.py --capture first. Private RAM dumps are never web assets.
"""
import argparse,base64,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def capture():
 result={}
 for room in [1,2,3,4,5,6,7]:
  b=Path(f'/private/tmp/goonies-xex-room-{room}.bin').read_bytes()
  def arr(address,count):return list(b[address:address+count])
  def ptr(address,count):return [int.from_bytes(b[address+i*2:address+i*2+2],'little') for i in range(count)]
  frames={}
  def sprite(address):
   key=f'{address:04x}'
   if key not in frames:
    stride,height=b[address:address+2]
    if not 1<=stride<=8 or not 1<=height<=176:raise ValueError((room,key,stride,height))
    frames[key]={'width':stride*8,'height':height,'packed':base64.b64encode(b[address+2:address+2+stride*height]).decode()}
   return key
  def sprites(address,count):return [sprite(x) for x in ptr(address,count)]
  def rectangles(table,count):
   pointers=ptr(table,5)
   return [dict(zip(['type','x1','y1','x2','y2'],[b[a+i] for a in pointers])) for i in range(count)]
  def paths(x_table,y_table,count):
   result=[]
   for xp,yp in zip(ptr(x_table,count),ptr(y_table,count)):
    length=next((i+1 for i in range(80) if b[yp+i]==255),80)
    result.append({'x':arr(xp,length),'y':arr(yp,length)})
   return result
  if room==5:
   tables={
    'platformTypes':[arr(a,13) for a in ptr(0xa859,8)],'platformColumns':arr(0xa909,13),'platformRows':arr(0xa91d,13),'platformColors':arr(0xa931,13),
    'platformFrames':sprites(0xa945,3),'plateX':arr(0xa580,3),'plateColumns':arr(0xa586,3),'plateFrames':sprites(0xa589,3),
    'doorX':arr(0xa7d8,2),'doorY':arr(0xa7da,2),'doorDX':arr(0xa7dc,2),'doorDY':arr(0xa7de,2),
    'doorMarkerX':arr(0xa7e2,2),'doorMarkerY':arr(0xa7e4,2),'doorFrame':sprite(0xaa16),
    'dropX':arr(0xa6de,9),'dropY':arr(0xa6e7,9),'dropEnd':arr(0xa6f0,9),'surfaceFrame':sprite(0xaa69)}
  elif room==3:
   tables={'stoneRectangles':rectangles(0xa7f3,33),'alarmX':arr(0x72d5,8),'alarmY':arr(0x72dd,8),'alarmPaths':arr(0x72e5,8),'gateIndices':arr(0xa6b7,9),'gateOpenTypes':arr(0xa6c0,9),'gateClosedTypes':arr(0xa6c9,9),
    'gateSigns':arr(0xa566,9),'gateVisible':arr(0xa581,9),'gateColumns':arr(0xa56f,9),'gateRows':arr(0xa578,9),'gateFrames':sprites(0xa58a,9),
    'stoneControls':arr(0xa7db,12),'stoneReset':arr(0xa7e7,12),'hammerFrames':sprites(0xa5dc,7),'hammerColumns':arr(0xa5eb,7),'hammerRows':arr(0xa5f3,7),
    'boardFrame':sprite(0xa9ad),'boardRows':arr(0xa628,3),'seatFrames':sprites(0xa692,2),'seatColumns':arr(0xa690,2),'seatRows':arr(0xa68e,2),
    'trapFrames':sprites(0xa696,2),'trapColumns':arr(0xa69a,2),'trapRows':arr(0xa69c,2)}
  elif room==4:
   bird_paths=paths(0xa9d2,0xa9da,4);arrival_paths=paths(0x7550,0x7558,4)
   tables={'eggRectangles':rectangles(0xa859,17),'pileY':arr(0xa4c2,5),'pileFrame':sprite(0xb2f6),
    'springX':arr(0xa575,2),'springY':arr(0xa577,2),'lavaX':arr(0xa571,2),'lavaY':arr(0xa573,2),'springColumns':arr(0xa579,2),'springRows':arr(0xa57b,2),'springFrames':sprites(0xa57e,6),
    'doorX':arr(0xaa31,6),'doorY':arr(0xaa37,6),'doorControls':arr(0xaa3d,6),'doorDX':arr(0xaa43,6),'doorDY':arr(0xaa49,6),'eggDoorDX':arr(0xaa4f,6),
    'birdTargetX':arr(0xa9ca,4),'birdTargetY':arr(0xa9ce,4),'birdPathsX':[p['x'] for p in bird_paths],'birdPathsY':[p['y'] for p in bird_paths],
    'birdArrivalX':[p['x'] for p in arrival_paths],'birdArrivalY':[p['y'] for p in arrival_paths]}
  elif room==6:
   bubble_paths=[]
   for yptr,xptr in zip(ptr(0xa5bb,4),ptr(0xa5c7,4)):
    count=next((i+1 for i in range(100) if b[xptr+i]==0),100)
    bubble_paths.append({'x':arr(xptr,count),'y':arr(yptr,count)})
   tables={'cageRectangles':rectangles(0xa8f0,5),'waterFrames':sprites(0xa6e7,4),'waterOffset':arr(0xa6e3,4),'headFrames':sprites(0xa6ef,4),'headOffset':arr(0xa6f7,4),
    'flipperX1':arr(0xa7cb,2),'flipperX2':arr(0xa7cf,2),'flipperY1':arr(0xa7cd,2),'flipperY2':arr(0xa7d1,2),'flipperColumns':arr(0xa7d3,2),'flipperRows':arr(0xa7d5,2),
    'flipperIdleColumns':arr(0xa7d7,2),'flipperIdleRows':arr(0xa7d9,2),'flipperFrames':sprites(0xa7db,2),'flipperIdleFrames':sprites(0xa7df,2),'lockFrame':sprite(0xaa25),
    'bubbles':bubble_paths,'bubbleFrames':sprites(0xa5d3,4),'currentX1':arr(0xa946,3),'currentX2':arr(0xa949,3),'currentY1':arr(0xa94c,3),'currentY2':arr(0xa94f,3)}
  elif room==7:
   tables={'switchX':arr(0xa850,4),'switchY':arr(0xa854,4),'switchMasks':arr(0xa860,16),'extraX':arr(0xa84a,3),'extraY':arr(0xa84d,3),'extraMasks':arr(0xa847,3),
    'hatchColumns':arr(0xa858,3),'hatchRows':arr(0xa85b,3),'hatchFloor':arr(0xa894,3),'hatchCeiling':arr(0xa897,3),'hatchFrames':[sprite(0xa9d8),sprite(0xa9e3)],
    'chestFrames':sprites(0xa69a,8),'liftFrame':sprite(0xaaef),'coinFrame':sprite(0xa9d4),'motherIdleFrames':arr(0xa5fd,4),'pulleyFrames':sprites(0xa8c3,4),'pulleyY':arr(0xa8bf,4)}
  elif room==1:
   tables={'valveX':arr(0xa94e,3),'valveY':arr(0xa951,3),'routes':arr(0xa954,24),
    'hazardX':arr(0xa96c,3),'hazardY':arr(0xa96f,3),'streamColumns':arr(0xa972,3),'streamRows':arr(0xa975,3),
    'streamDX':arr(0xa978,4),'streamDY':arr(0xa97c,4),'streamFrames':sprites(0xa980,4),'burstFrames':sprites(0xa988,4),
    'spoutFrames':[sprite(0xac58),sprite(0xac6a)],'npcStops':arr(0xa820,5),'npcOrder':arr(0xa825,16),
    'npcFrames':sprites(0xa814,6),'dropY1':arr(0xa99a,5),'dropY2':arr(0xa99f,5),'dropCol1':arr(0xa9a4,5),'dropCol2':arr(0xa9a9,5),'waterFrames':[sprite(0xac16),sprite(0xac1e)],
    'gunHeight':arr(0xa5c7,16),'bulletHeight':arr(0xa5da,16),'bulletEnd':arr(0xa5ea,16),'gunFrames':sprites(0xa5b8,4),'bulletFrames':[sprite(0xac26),sprite(0xaca4)]}
  else:
   tables={'pumpColumns':arr(0xa94e,3),'pumpRows':arr(0xa951,3),'pumpPhases':arr(0xa954,4),'pumpFrames':sprites(0xa948,3),
    'pailColumns':arr(0xa96e,4),'bottomColumns':arr(0xa967,3),'ropeTopOffset':arr(0xa95f,4),'ropeTopY':arr(0xa963,4),
    'ropeBottomOffset':arr(0xa959,3),'ropeBottomY':arr(0xa95c,3),'bucketDelays':arr(0xa984,3),'bucketWalls':arr(0xa988,4),
    'pailFrame':sprite(0xab4d),'bucketFrames':[sprite(0xaa81),sprite(0xab19)],'bucketBottom':sprite(0xab02),'ropeFrame':sprite(0xaa2f),
    'counterweightFrame':sprite(0xaa93),'crankFrames':sprites(0xa71a,4),'ballFrames':sprites(0xa93d,4),'keyFrame':sprite(0xaba5),'keyShine':sprite(0xaa23)}
  result[str(room)]={**tables,'frames':frames,'batPaths':paths(0x72ed,0x7301,10),'batBranches':arr(0x7315,10)}
 return result

def export(data):
 (ROOT/'goonies-web/assets/mechanisms.js').write_text('// Named original puzzle tables and indexed bitmap records, no CPU code.\nglobalThis.GOONIES_MECHANISMS = '+json.dumps(data,separators=(',',':'))+';\n')
 print('Exported native mechanism tables for all seven cave/ship rooms.')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--capture',action='store_true');args=parser.parse_args()
 stored=ROOT/'research/goonies/original-mechanisms.json'
 if args.capture:
  data=capture();stored.write_text(json.dumps(data,separators=(',',':'))+'\n')
 else:data=json.loads(stored.read_text())
 export(data)
