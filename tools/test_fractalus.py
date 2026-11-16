#!/usr/bin/env python3
"""Run native/reference fixtures and save a bounded, reproducible validation report."""
import argparse,datetime,hashlib,json,shutil,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--logs',type=Path,default=Path('/private/tmp/fractalus-validation'));p.add_argument('--report',type=Path,default=root/'research/rescue-on-fractalus/validation.json');args=p.parse_args()
deno=shutil.which('deno');assert deno,'Deno required'
args.logs.mkdir(parents=True,exist_ok=True)
checks=[('bundle',['python3','tools/build_fractalus.py','--check'])]
for name in ['math','geometry','terrain','objects','world','mission','flight','flight-services','systems','combat','rescue','lifecycle','sound','cockpit','sprites','render','vbi','engine','intro','standalone']:
 checks.append((name,[deno,'run','--allow-read',f'tools/test-fractalus-{name}.mjs']))
checks.append(('vbi-pmg',[deno,'run','--allow-read','tools/test-fractalus-vbi.mjs','--full-pmg']))
results=[]
for name,command in checks:
 start=time.monotonic();result=subprocess.run(command,cwd=root,text=True,capture_output=True);elapsed=round(time.monotonic()-start,3)
 output=result.stdout+result.stderr;(args.logs/f'{name}.log').write_text(output)
 results.append({'name':name,'exitCode':result.returncode,'seconds':elapsed,'summary':output.strip().splitlines()[-1] if output.strip() else ''})
 print(('PASS' if result.returncode==0 else 'FAIL'),name,f'{elapsed}s',flush=True)
 if result.returncode:print(output[-5000:]);raise SystemExit(result.returncode)
hashes={str(path.relative_to(root)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted((root/'rescue-on-fractalus').rglob('*')) if path.is_file()}
report={'sourceSha256':'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab','timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'All listed bounded checks pass; complete1:1 fidelity and full playthrough are not established.','checks':results,'runtimeHashes':hashes}
args.report.write_text(json.dumps(report,indent=2)+'\n');print(f'PASS {len(results)} checks; report {args.report.relative_to(root)}')
