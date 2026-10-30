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
            if file.suffix == ".mp4":
                assert mime == "video/mp4", (relative, mime)
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
    routes=[("/", root / "index.html")]
    routes += [("/"+directory.name+"/", directory/"index.html") for directory in sorted(root.iterdir()) if directory.is_dir() and (directory/"index.html").is_file()]
    routes += [("/hry/"+directory.name+"/",directory/"index.html") for directory in sorted((root/"hry").iterdir()) if directory.is_dir()]
    for route, file in routes:
        with urlopen(base + route, timeout=20) as response:
            assert response.status == 200
            assert hashlib.sha256(response.read()).digest() == hashlib.sha256(file.read_bytes()).digest(), route
    media_files=sorted(root.rglob("*.mp3"))+sorted(root.rglob("*.mp4"))
    for file in media_files:
        audio_path = "/"+file.relative_to(root).as_posix()
        request = Request(base + quote(audio_path), headers={"Range": "bytes=0-31"})
        with urlopen(request, timeout=20) as response:
            assert response.status == 206, (audio_path, response.status)
            assert response.read() == file.read_bytes()[:32]
            assert response.headers["Content-Range"].startswith("bytes 0-31/")
    print(f"Verified HTTPS: {count} identical public files, {len(routes)} portal/game routes, MIME types and {len(media_files)} MP3/MP4 range requests.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--url", default="https://atari800.gmork.cz")
    args = parser.parse_args()
    verify(args.root.resolve(), args.url.rstrip("/"))
