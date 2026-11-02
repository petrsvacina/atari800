#!/usr/bin/env python3
"""Publish this static game release with a verified backup and rollback.

Run on the server: python3 neverstory_publish.py preflight|publish manifest.json
Archive and manifest must be in the same private upload directory.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
from urllib.parse import quote, urljoin, urlsplit

SITE = Path('/var/www/atari800')
BASE = 'https://atari800.gmork.cz'
sha = lambda data: hashlib.sha256(data).hexdigest()


def inventory(root):
    return {p.relative_to(root).as_posix(): sha(p.read_bytes()) for p in sorted(root.rglob('*')) if p.is_file()}


def exact(root, expected):
    actual = inventory(root)
    if actual != expected:
        raise ValueError(json.dumps({'missing': sorted(set(expected) - set(actual)), 'extra': sorted(set(actual) - set(expected)),
                                     'changed': [n for n in expected if n in actual and actual[n] != expected[n]]}))


def check_archive(archive, expected):
    found = {}
    with tarfile.open(archive, 'r:gz') as t:
        for member in t.getmembers():
            name = PurePosixPath(member.name)
            assert member.isfile() and not name.is_absolute() and '..' not in name.parts
            assert str(name) not in found
            found[str(name)] = sha(t.extractfile(member).read())
    assert found == expected, 'Archive content does not match the release manifest'


def install(source, target, release):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + '.' + release + '.tmp')
    assert not temp.exists()
    try:
        shutil.copyfile(source, temp); temp.chmod(0o644)
        assert sha(temp.read_bytes()) == sha(source.read_bytes())
        os.replace(temp, target)
    finally:
        if temp.exists(): temp.unlink()


def verify_https(stage, backup, game_id='neverending-story', game_ids=None):
    count = 0
    headers = backup / 'http-headers.txt'

    def request(relative, file, partial=False):
        url = BASE + relative
        command = ['curl', '-fsS', '--connect-timeout', '10', '--max-time', '30', '--resolve',
                   'atari800.gmork.cz:443:127.0.0.1', '-D', str(headers)]
        if partial: command += ['-H', 'Range: bytes=0-31']
        body = subprocess.run([*command, url], check=True, capture_output=True).stdout
        h = headers.read_text().lower()
        assert re.search(r'http/\S+ ' + ('206' if partial else '200') + r'\b', h), relative
        expected = file.read_bytes()
        assert sha(body) == sha(expected[:32] if partial else expected), relative
        if partial: assert f'content-range: bytes 0-31/{len(expected)}' in h, relative
        mimes = {'.html': ('text/html',), '.css': ('text/css',), '.js': ('application/javascript', 'text/javascript'),
                 '.png': ('image/png',), '.svg': ('image/svg+xml',), '.pdf': ('application/pdf',),
                 '.mp3': ('audio/mpeg',), '.mp4': ('video/mp4',)}
        if file.suffix in mimes:
            assert any('content-type: ' + mime in h for mime in mimes[file.suffix]), (relative, h)

    for file in sorted(stage.rglob('*')):
        if file.is_file(): request('/' + quote(file.relative_to(stage).as_posix()), file); count += 1
    routes = [('/', stage / 'index.html'), ('/en/', stage / 'en/index.html')]
    routes += [('/hry/' + p.name + '/', p / 'index.html') for p in sorted((stage / 'hry').iterdir()) if p.is_dir()]
    for route, file in routes: request(route, file)
    for current_game in game_ids or (game_id,):
        request(f'/hry/{current_game}/?lang=en', stage / f'hry/{current_game}/index.html')
        game = stage / f'hry/{current_game}/index.html'
        for link in re.findall(r'(?:src|href)="([^"]+)"', game.read_text()):
            if '?v=' in link:
                url = urlsplit(urljoin(BASE + f'/hry/{current_game}/', link))
                request(url.path + '?' + url.query, stage / url.path.lstrip('/'))
    media = [p for p in sorted(stage.rglob('*')) if p.suffix in ('.mp3', '.mp4', '.pdf')]
    for file in media: request('/' + quote(file.relative_to(stage).as_posix()), file, partial=True)
    return {'httpsVerified': True, 'publicFilesVerified': count, 'routesVerified': len(routes),
            'englishGameRouteVerified': True, 'versionedAssetsVerified': True, 'rangeRequestsVerified': len(media)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preflight', 'publish'])
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args(); d = json.loads(args.manifest.read_text())
    assert re.fullmatch(r'\d{8}T\d{6}Z', d['release'])
    assert SITE.is_dir() and not SITE.is_symlink()
    assert not d['removed']
    kind = d.get('kind', 'game-release')
    if kind == 'loading-art':
        assert set(d['changed']) == {'hry/neverending-story/' + f for f in ('index.html', 'game.js', 'style.css')}
        assert set(d['added']) == {'hry/neverending-story/assets/loading.png'}
    elif kind == 'shift-release':
        assert set(d['changed']) == {'index.html', 'en/index.html'}
        assert set(d['added']) == {'assets/shift.png', 'assets/shift-logo.png',
                                  *['hry/shift/' + f for f in ('index.html', 'game.js', 'style.css', 'assets/audio.js', 'assets/data.js')]}
    elif kind == 'game-layout-release':
        assert set(d['changed']) == {
            *['hry/' + game + '/' + name for game in ('shift', 'neverending-story')
              for name in ('index.html', 'style.css', 'game.js')],
            *['hry/karateka/' + name for name in ('index.html', 'style.css', 'app.js')]}
        assert set(d['added']) == {'hry/shift/assets/logo.png', 'hry/neverending-story/assets/logo.svg'}
    else:
        assert kind == 'game-release'
        assert set(d['changed']) == {'index.html', 'en/index.html'}
        assert set(d['added']) == {'assets/neverending-story.png', 'assets/neverending-story-logo.svg',
                                  *['hry/neverending-story/' + f for f in ('index.html', 'game.js', 'style.css', 'assets/audio.js', 'assets/data.js')]}
    assert set(d['files']) == set(d['old']) | set(d['added'])
    assert all(d['files'][n] == digest for n, digest in d['old'].items() if n not in d['changed'])
    stage = Path('/var/tmp') / ('atari800-release-' + d['release'])
    backup = Path('/root/atari800-backups') / d['release']
    archive = args.manifest.parent / d['archive']
    assert not stage.exists() and not backup.exists()
    exact(SITE, d['old'])
    assert sha(archive.read_bytes()) == d['archiveSha256']
    check_archive(archive, d['files'])
    if args.action == 'preflight':
        print(json.dumps({'preflight': True, 'previousFiles': len(d['old']), 'releaseFiles': len(d['files']),
                          'changed': d['changed'], 'added': d['added']})); return
    stage.mkdir(mode=0o755)
    with tarfile.open(archive, 'r:gz') as t:
        for member in t.getmembers():
            target = stage / member.name; target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(t.extractfile(member).read()); target.chmod(0o644)
    exact(stage, d['files'])
    backup.mkdir(mode=0o700, parents=True)
    old_archive = backup / 'site-before.tar.gz'
    with tarfile.open(old_archive, 'w:gz') as t:
        for name in d['old']: t.add(SITE / name, arcname=name, recursive=False)
    check_archive(old_archive, d['old'])
    d.update(backup=str(old_archive), backupSha256=sha(old_archive.read_bytes()), backupVerified=True, status='backed-up')
    record = backup / 'release.json'; record.write_text(json.dumps(d, indent=2) + '\n')
    exact(SITE, d['old'])
    affected = set(d['added']) | set(d['changed'])
    game_id = 'shift' if kind == 'shift-release' else 'neverending-story'
    game_ids = ('shift', 'neverending-story', 'karateka') if kind == 'game-layout-release' else (game_id,)
    tail = [*[f'hry/{game}/index.html' for game in game_ids], 'en/index.html', 'index.html']
    order = sorted(affected - set(tail)) + [name for name in tail if name in affected]
    try:
        for name in order: install(stage / name, SITE / name, d['release'])
        exact(SITE, d['files'])
        d.update(verify_https(stage, backup, game_id, game_ids))
        d.update(status='published', liveHashesVerified=True, previousFilesUnchanged=len(d['old']) - len(d['changed']))
        record.write_text(json.dumps(d, indent=2) + '\n')
    except BaseException as error:
        # Restore catalog links first, then remove only files added by this release.
        with tarfile.open(old_archive, 'r:gz') as t:
            for name in d['changed']:
                restored = backup / ('restore-' + name.replace('/', '-'))
                restored.write_bytes(t.extractfile(name).read()); install(restored, SITE / name, d['release'] + '-rollback')
        for name in d['added']:
            target = SITE / name
            if target.exists(): target.unlink()
        d.update(status='rolled-back', error=str(error)); record.write_text(json.dumps(d, indent=2) + '\n')
        exact(SITE, d['old']); raise
    print(json.dumps({k: d[k] for k in ['release', 'status', 'backup', 'backupVerified', 'liveHashesVerified',
                                      'previousFilesUnchanged', 'publicFilesVerified', 'routesVerified',
                                      'englishGameRouteVerified', 'versionedAssetsVerified', 'rangeRequestsVerified']}))


if __name__ == '__main__': main()
