#!/usr/bin/env python3
"""Compare a deployed static site against a local release, including HTTP audio ranges."""
import argparse
import hashlib
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


def verify(root, base):
    count = 0
    for file in sorted(root.rglob("*")):
        if not file.is_file():
            continue
        relative = file.relative_to(root).as_posix()
        request = Request(base + "/" + quote(relative), headers={"User-Agent": "Atari800ReleaseVerification/1"})
        with urlopen(request, timeout=20) as response:
            assert response.status == 200, relative
            assert hashlib.sha256(response.read()).digest() == hashlib.sha256(file.read_bytes()).digest(), relative
            mime = response.headers.get_content_type()
            if file.suffix == ".mp3":
                assert mime == "audio/mpeg", (relative, mime)
            if file.suffix == ".css":
                assert mime == "text/css", (relative, mime)
            if file.suffix == ".html":
                assert mime == "text/html", (relative, mime)
            if file.suffix == ".png":
                assert mime == "image/png", (relative, mime)
            if file.suffix == ".svg":
                assert mime == "image/svg+xml", (relative, mime)
            if file.suffix == ".js":
                assert mime in ("text/javascript", "application/javascript"), (relative, mime)
        count += 1
    routes=[("/", root / "index.html")]+[("/hry/"+directory.name+"/",directory/"index.html") for directory in sorted((root/"hry").iterdir()) if directory.is_dir()]
    for route, file in routes:
        with urlopen(base + route, timeout=20) as response:
            assert response.status == 200
            assert hashlib.sha256(response.read()).digest() == hashlib.sha256(file.read_bytes()).digest(), route
    audio_files=sorted(root.rglob("*.mp3"))
    for file in audio_files:
        audio_path = "/"+file.relative_to(root).as_posix()
        request = Request(base + quote(audio_path), headers={"Range": "bytes=0-31"})
        with urlopen(request, timeout=20) as response:
            assert response.status == 206, (audio_path, response.status)
            assert len(response.read()) == 32
            assert response.headers["Content-Range"].startswith("bytes 0-31/")
    print(f"Verified HTTPS: {count} identical public files, {len(routes)} portal/game routes, MIME types and {len(audio_files)} MP3 range requests.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--url", default="https://atari800.gmork.cz")
    args = parser.parse_args()
    verify(args.root.resolve(), args.url.rstrip("/"))
