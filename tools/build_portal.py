#!/usr/bin/env python3
"""Build a static portal + isolated game directories into dist/."""
import html
import json
from pathlib import Path
import re
import shutil
import tempfile
from build_game_i18n import build as check_game_translations

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "portal"
LANGUAGES = ("cs", "en")
GAME_TRANSLATIONS = {"description", "genre", "players", "controls"}
CLIENT_MESSAGES = ("play", "preview", "ready_one", "ready_few", "ready_other", "shown")


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


def load_locale(language, games):
    locale = json.loads((PORTAL / "locales" / f"{language}.json").read_text())
    reference = json.loads((PORTAL / "locales/cs.json").read_text())
    if set(locale) != set(reference) or any(not isinstance(v, str) or not v.strip() for k, v in locale.items() if k != "games"):
        raise ValueError(f"Incomplete portal translations: {language}")
    translated = locale["games"]
    if language != "cs":
        if set(translated) != {game["id"] for game in games}:
            raise ValueError(f"Translate every game in portal/locales/{language}.json")
        for slug, fields in translated.items():
            if set(fields) != GAME_TRANSLATIONS or any(not isinstance(v, str) or not v.strip() for v in fields.values()):
                raise ValueError(f"Incomplete {language} game translation: {slug}")
    return locale


def card(game, locale, prefix, query):
    e = {k: escape(prefix + v if k in ("image", "logo") else v) for k, v in game.items()}
    search = escape(" ".join(str(game[k]) for k in ("title", "genre", "description", "author", "year", "players")))
    multi = "true" if game["multiplayer"] else "false"
    play = escape(locale["play"].format(title=game["title"]))
    screenshot = escape(locale["screenshot"].format(title=game["title"]))
    available = escape(locale["available"])
    return f'''<article class="game-card" data-game="{e['id']}" data-search="{search}" data-multiplayer="{multi}" data-title="{e['title']}" data-genre="{e['genre']}" data-players="{e['players']}" data-logo="{e['logo']}">
            <a href="{prefix}hry/{e['id']}/{query}" aria-label="{play}">
              <div class="game-card-image"><img src="{e['image']}" width="1280" height="768" alt="{screenshot}" loading="lazy"><span class="game-status">{available}</span><span class="game-year">{e['author']} / {e['year']}</span></div>
              <div class="game-card-body"><div class="game-title-row"><h3>{e['title']}</h3><span class="game-arrow" aria-hidden="true">↗</span></div><p>{e['description']}</p><div class="game-tags"><span>{e['genre']}</span><span>{e['players']}</span><span class="game-controls">{e['controls']}</span></div></div>
            </a>
          </article>'''


def render_portal(games, language):
    locale = load_locale(language, games)
    games = [{**game, **locale["games"].get(game["id"], {})} for game in games]
    featured = next(g for g in games if g.get("featured"))
    template = (PORTAL / "index.html").read_text()
    count = len(games)
    prefix, query = ("../", "?lang=en") if language == "en" else ("", "")
    count_key = "ready_one" if count == 1 else "ready_few" if count < 5 else "ready_other"
    count_label = locale[count_key].format(total=count)
    values = {"GAME_COUNT": str(count), "GAME_COUNT_PADDED": str(count).zfill(2), "GAME_COUNT_LABEL": escape(count_label),
              "FEATURED_POSITION": str(games.index(featured) + 1).zfill(2),
              "GAME_CARDS": "\n          ".join(card(g, locale, prefix, query) for g in games),
              "LANG": language, "PREFIX": prefix, "GAME_QUERY": query,
              "PAGE_URL": "https://atari800.gmork.cz/" + ("en/" if language == "en" else ""),
              "CS_URL": "../" if language == "en" else "./", "EN_URL": "./" if language == "en" else "en/",
              "CS_CURRENT": ' aria-current="page"' if language == "cs" else "",
              "EN_CURRENT": ' aria-current="page"' if language == "en" else "",
              "FEATURED_PLAY": escape(locale["play"].format(title=featured["title"])),
              "FEATURED_PREVIEW": escape(locale["preview"].format(title=featured["title"]))}
    values.update({"T_" + k.upper(): escape(v) for k, v in locale.items() if k != "games"})
    # An inert JSON script carries runtime strings; never let translated text end the element.
    messages = json.dumps({key: locale[key] for key in CLIENT_MESSAGES}, ensure_ascii=False)
    for char, encoded in (("&", "\\u0026"), ("<", "\\u003c"), (">", "\\u003e"), ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        messages = messages.replace(char, encoded)
    values["CLIENT_MESSAGES"] = messages
    for key in ("id", "title", "image", "logo", "genre", "players"):
        values["FEATURED_" + key.upper()] = escape(prefix + featured[key] if key in ("image", "logo") else featured[key])
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    if "{{" in template:
        raise ValueError("Unresolved portal template variable")
    return template


def build():
    check_game_translations(check=True)
    games = load_games()
    pages = {language: render_portal(games, language) for language in LANGUAGES}
    with tempfile.TemporaryDirectory(prefix="atari-portal-build-", dir=ROOT) as folder:
        stage = Path(folder) / "site"
        stage.mkdir()
        for language, page in pages.items():
            dest = stage if language == "cs" else stage / language
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "index.html").write_text(page)
        for filename in ("portal.css", "portal.js", "game-nav.js"):
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
            page = page.replace("</head>", '<script defer src="../../game-nav.js?v=20261029-i18n"></script></head>')
            (dest / "index.html").write_text(page)
        output = ROOT / "dist"
        if output.exists():
            shutil.rmtree(output)
        stage.rename(output)
    print(f"Built {len(games)} game(s), CZ/EN portal into {output}.")


if __name__ == "__main__":
    build()
