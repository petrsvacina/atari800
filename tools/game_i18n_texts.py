#!/usr/bin/env python3
"""Read actual static game text for the JavaScript localisation coverage check."""
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
class Texts(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.values=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
  for key,value in attrs:
   if key in ('aria-label','title','placeholder','alt') or tag=='meta' and key=='content' and ('name','description') in attrs:self.values.append(value)
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.skip-=1
 def handle_data(self,value):
  if not self.skip and value.strip():self.values.append(' '.join(value.split()))
def inventory():
 result={}
 for game in json.loads((ROOT/'portal/games.json').read_text()):
  page=Texts();page.feed((ROOT/game['source']/'index.html').read_text());result[game['source']]=list(dict.fromkeys(page.values))
 return result
if __name__=='__main__':print(json.dumps(inventory(),ensure_ascii=False))
