#!/usr/bin/env python3
"""Locale/routing regressions for the statically built portal."""
from html.parser import HTMLParser
import json
import unittest
from unittest.mock import patch
from urllib.parse import urljoin, urlparse, parse_qs

import build_portal as portal


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.messages = ""
        self.in_messages = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == "script" and attrs.get("id") == "portal-messages":
            self.in_messages = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_messages = False

    def handle_data(self, data):
        if self.in_messages:
            self.messages += data


class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.games = portal.load_games()

    def test_both_locales_resolve_every_asset_and_game_link(self):
        for language, directory in (("cs", ""), ("en", "en/")):
            html = portal.render_portal(self.games, language)
            page = Page(html)
            base = "https://atari800.gmork.cz/" + directory
            self.assertNotIn("{{", html)
            self.assertIn(("html", {"lang": language}), page.elements)
            ids = [a["data-game"] for tag, a in page.elements if "data-game" in a]
            self.assertEqual(ids, [g["id"] for g in self.games])
            for tag, attrs in page.elements:
                link = attrs.get("src") or (attrs.get("href") if tag in ("a", "link") else None)
                if not link or link.startswith("#"):
                    continue
                url = urlparse(urljoin(base, link))
                if url.netloc != "atari800.gmork.cz":
                    continue
                file = portal.ROOT / "dist" / url.path.lstrip("/")
                if url.path.endswith("/"):
                    file /= "index.html"
                self.assertTrue(file.is_file(), (language, link, file))
                if tag == "a" and url.path.startswith("/hry/"):
                    self.assertEqual(parse_qs(url.query), {"lang": ["en"]} if language == "en" else {})

    def test_canonical_alternates_and_language_switch(self):
        for language, suffix in (("cs", ""), ("en", "en/")):
            page = Page(portal.render_portal(self.games, language))
            canonical = [a["href"] for tag, a in page.elements if tag == "link" and a.get("rel") == "canonical"]
            self.assertEqual(canonical, ["https://atari800.gmork.cz/" + suffix])
            alternates = {a["hreflang"]: a["href"] for tag, a in page.elements if tag == "link" and a.get("rel") == "alternate"}
            self.assertEqual(alternates, {"cs": "https://atari800.gmork.cz/", "en": "https://atari800.gmork.cz/en/", "x-default": "https://atari800.gmork.cz/"})
            selected = [a for tag, a in page.elements if a.get("aria-current") == "page"]
            self.assertEqual(len(selected), 1)
            self.assertEqual(selected[0]["lang"], language)

    def test_runtime_strings_follow_the_page_language(self):
        for language, expected in (("cs", "Zobrazeno: 1 z 7"), ("en", "Showing 1 of 7")):
            page = Page(portal.render_portal(self.games, language))
            messages = json.loads(page.messages)
            self.assertEqual(messages["shown"].format(visible=1, total=7), expected)
            self.assertEqual(set(messages), set(portal.CLIENT_MESSAGES))

    def test_adding_a_game_requires_its_english_translation(self):
        with self.assertRaisesRegex(ValueError, "Translate every game"):
            portal.load_locale("en", self.games + [{"id": "new-game"}])

    def test_translated_text_cannot_terminate_the_message_script(self):
        locale = portal.load_locale("en", self.games)
        locale["play"] = "</script><img src=x> {title}"
        with patch.object(portal, "load_locale", return_value=locale):
            html = portal.render_portal(self.games, "en")
        self.assertNotIn("</script><img", html)
        self.assertEqual(json.loads(Page(html).messages)["play"], locale["play"])


if __name__ == "__main__":
    unittest.main()
