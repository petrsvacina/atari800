#!/usr/bin/env python3
"""Build a static portal + isolated game directories into dist/."""
import html
import json
from pathlib import Path
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "portal"


def escape(value):
    return html.escape(str(value), quote=True)


def load_games():
    games = json.loads((PORTAL / "games.json").read_text())
    if not games or sum(bool(g.get("featured")) for g in games) != 1:
        raise ValueError("Choose exactly one featured game in portal/games.json.")
    ids = set()
    for game in games:
        slug = game["id"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or slug in ids:
            raise ValueError(f"Invalid or duplicate game ID: {slug}")
        ids.add(slug)
        source = (ROOT / game["source"]).resolve()
        source.relative_to(ROOT)
        if not (source / "index.html").is_file():
            raise ValueError(f"Missing playable source for {slug}")
        for key in ("image", "logo"):
            asset = (PORTAL / game[key]).resolve()
            asset.relative_to(PORTAL)
            if not asset.is_file():
                raise ValueError(f"Missing {key} for {slug}")
    return games


def card(game):
    e = {k: escape(v) for k, v in game.items()}
    search = escape(" ".join(str(game[k]) for k in ("title", "genre", "description", "author", "year", "players")))
    multi = "true" if game["multiplayer"] else "false"
    return f'''<article class="game-card" data-game="{e['id']}" data-search="{search}" data-multiplayer="{multi}">
            <a href="hry/{e['id']}/" aria-label="Hrát {e['title']}">
              <div class="game-card-image"><img src="{e['image']}" width="1280" height="768" alt="Herní aréna {e['title']}" loading="lazy"><span class="game-status">MŮŽEŠ HRÁT</span><span class="game-year">{e['author']} / {e['year']}</span></div>
              <div class="game-card-body"><div class="game-title-row"><h3>{e['title']}</h3><span class="game-arrow" aria-hidden="true">↗</span></div><p>{e['description']}</p><div class="game-tags"><span>{e['genre']}</span><span>{e['players']}</span><span class="game-controls">{e['controls']}</span></div></div>
            </a>
          </article>'''


def build():
    games = load_games()
    featured = next(g for g in games if g.get("featured"))
    template = (PORTAL / "index.html").read_text()
    count = len(games)
    count_label = f"{count} " + ("hra připravená" if count == 1 else "hry připravené" if count < 5 else "her připravených") + " ke spuštění"
    values = {"GAME_COUNT": str(count), "GAME_COUNT_PADDED": str(count).zfill(2), "GAME_COUNT_LABEL": count_label,
              "GAME_CARDS": "\n          ".join(card(g) for g in games)}
    for key in ("id", "title", "image", "logo", "genre", "players"):
        values["FEATURED_" + key.upper()] = escape(featured[key])
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    if "{{" in template:
        raise ValueError("Unresolved portal template variable")
    with tempfile.TemporaryDirectory(prefix="atari-portal-build-", dir=ROOT) as folder:
        stage = Path(folder) / "site"
        stage.mkdir()
        (stage / "index.html").write_text(template)
        for filename in ("portal.css", "portal.js"):
            shutil.copyfile(PORTAL / filename, stage / filename)
        shutil.copytree(PORTAL / "assets", stage / "assets")
        for game in games:
            dest = stage / "hry" / game["id"]
            shutil.copytree(ROOT / game["source"], dest, ignore=shutil.ignore_patterns(".DS_Store"))
            page = (dest / "index.html").read_text()
            # Keep the local standalone game intact. Only the published copy gets navigation.
            edition = re.compile(r'<div class="edition">.*?</div>', re.DOTALL)
            page, replacements = edition.subn('<div class="edition"><a class="portal-back" href="../../">← VŠECHNY HRY</a><small>ATARI800 · WEBOVÁ HERNA</small></div>', page, count=1)
            if replacements != 1:
                raise ValueError(f"Missing portal navigation insertion point in {game['id']}")
            page = page.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="style.css">\n  <style>.portal-back{color:#e3bd76;text-decoration:none}.portal-back:hover{text-decoration:underline}.portal-back:focus-visible{outline:2px solid #e3bd76;outline-offset:5px}</style>')
            page = page.replace("Samostatný přepis v JavaScriptu · Běží lokálně a offline", "Webová herna Atari XL/XE · atari800.gmork.cz")
            (dest / "index.html").write_text(page)
        output = ROOT / "dist"
        if output.exists():
            shutil.rmtree(output)
        stage.rename(output)
    print(f"Built {count} game(s) into {output}.")


if __name__ == "__main__":
    build()
