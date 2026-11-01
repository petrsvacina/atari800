import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Adventure, picture} from '../neverending-story/engine.mjs';
import {TextScreen} from '../neverending-story/screen.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
vm.runInThisContext(fs.readFileSync(root + 'neverending-story/assets/data.js', 'utf8'));
const d = globalThis.NEVERENDING_DATA;
const fixtures = JSON.parse(zlib.gunzipSync(fs.readFileSync(root + 'research/neverending-story/oracle.json.gz')));
const sphinx = JSON.parse(zlib.gunzipSync(fs.readFileSync(root + 'research/neverending-story/sphinx-oracle.json.gz')));
const make = () => new Adventure(d.rules, {random: () => 128, pause: async () => {}, confirm: async () => false});
const apply = (game, state) => {
  game.state = {...structuredClone(state), objects: Uint8Array.from(state.objects), flags: Uint8Array.from(state.flags)};
  delete game.state.verbose; game.verbose = state.verbose;
};
const state = game => ({...game.state, objects: [...game.state.objects], flags: [...game.state.flags], verbose: game.verbose});
for (const [index, c] of fixtures.routines.entries()) {
  const game = make(); apply(game, c.state); game.verb = c.verb; game.noun = c.noun;
  const ch = d.rules.chapters[c.state.chapter];
  const script = c.key === 'commandScripts' ? d.rules.commandScripts[c.index] : c.key === 'automatic' ? d.rules.automatic :
    c.key === 'chapterAutomatic' ? ch.automatic : c.key === 'initialize' ? ch.initialize : ch.roomScripts[c.index];
  await game.execute(script);
  assert.deepEqual(state(game), c.expected, `original handler case ${index}`);
  assert.equal(!!game.ended, c.ended);
}
for (const c of fixtures.parser) {
  const result = make().tokenize(c.line, d.languages[c.language].vocabulary);
  if (c.tokens === null) assert.ok(result.unknown, c.line);
  else assert.deepEqual(result.tokens, c.tokens, `${c.language} parser: ${c.line}`);
}
for (const c of fixtures.pictures) {
  const result = picture(d.rules, d.languages[c.language], {chapter: c.chapter, image: c.image, overlays: d.rules.initialOverlays});
  assert.equal(createHash('sha256').update(result).digest('hex'), c.sha256, `${c.language} image ${c.chapter}/${c.image}`);
}
for (const c of fixtures.transitions) {
  const game = make(); apply(game, c.state); await game.automatic();
  assert.deepEqual(state(game), c.expected, `chapter ${c.state.chapter + 1} transition`);
}
for (const lang of ['en', 'cs']) {
  const game = make(); await game.start(); const expected = fixtures.start[lang];
  assert.deepEqual([...game.state.objects], expected.objects); assert.deepEqual([...game.state.flags], expected.flags);
  assert.deepEqual(game.state.overlays, expected.overlays); assert.equal(game.state.image, expected.image);
  const before = JSON.stringify(game.snapshot());
  const text = new TextScreen(d.rules, d.languages[lang]); for (const e of game.events) text.event(e);
  assert.deepEqual([...text.cells], expected.text, `${lang} original text buffer`);
  assert.equal(JSON.stringify(game.snapshot()), before, 'rendering or language selection must not change the game');
}
const en = make(), cs = make(); await en.start(); await cs.start();
for (const [a, b] of [['ne', 'sv'], ['w', 'z'], ['i', 'o'], ['look', 'p']]) {
  await en.command(a, d.languages.en.vocabulary); await cs.command(b, d.languages.cs.vocabulary);
  assert.deepEqual(state(en), state(cs), `equivalent bilingual command ${a}/${b}`);
}
const saved = JSON.parse(JSON.stringify(en.snapshot())), restored = make(); restored.restore(saved);
assert.deepEqual(restored.snapshot(), saved, 'language-independent save roundtrip');
await restored.command('p', d.languages.cs.vocabulary);
await en.command('l', d.languages.en.vocabulary);
assert.deepEqual(state(restored), state(en), 'English save must continue in Czech');
assert.throws(() => restored.restore({...saved, chapter: 3}));
assert.throws(() => restored.restore({...saved, objects: [1]}));
assert.equal(sphinx.sourceSha256, d.languages.en.sha256);
for (const c of sphinx.cases) {
  const game = new Adventure(d.rules, {random: () => c.random, pause: async () => {}});
  apply(game, c.state); game.verb = 5; game.noun = 250;
  await game.execute(c.mode === 'room' ? d.rules.chapters[0].roomScripts[c.state.room] : d.rules.commandScripts[4]);
  const {events, ended, ...expected} = c.expected;
  assert.deepEqual(state(game), expected, `Sphinx ${c.mode}, RANDOM=${c.random}`);
  assert.deepEqual(game.events, events, `Sphinx messages ${c.mode}, RANDOM=${c.random}`);
  assert.equal(!!game.ended, ended);
}
for (const [lang, command] of [['en', 'drop crystal'], ['cs', 'poloz krystal']]) {
  const game = make(); apply(game, sphinx.handover.state);
  await game.command(command, d.languages[lang].vocabulary);
  const {events, ended, ...expected} = sphinx.handover.expected;
  assert.deepEqual(state(game), expected, `${lang} crystal handover`);
  assert.deepEqual(game.events.slice(1), events);
  assert.equal(!!game.ended, ended);
  assert.ok(game.events.some(e => e[0] === 'chapter' && e[2] === 14), 'Engywook must explain the crystal reward');
}
for (const c of sphinx.waits) for (const [lang, command] of [['en', 'wait'], ['cs', 'cek'], ['cs', 'cekej']]) {
  const game = new Adventure(d.rules, {random: () => c.random, pause: async () => {}});
  apply(game, c.state); await game.command(command, d.languages[lang].vocabulary);
  const {events, ended, ...expected} = c.expected;
  assert.deepEqual(state(game), expected, `${command} in room ${c.state.room}`);
  assert.deepEqual(game.events.slice(1), events);
  assert.equal(!!game.ended, ended);
  const text = new TextScreen(d.rules, d.languages[lang]);
  for (const e of game.events) text.event(e);
  const visible = Buffer.from(text.cells).toString('latin1').replace(/ +/g, ' ');
  if (c.state.room === 39 && c.random === 0) {
    assert.match(visible, lang === 'cs' ? /Oci sfing jsou zavreny!/i : /Sphinxes' eyes blink!/i);
  }
}
const closed = sphinx.cases.filter(c => c.mode === 'room' && c.state.room === 39 && c.expected.flags[5]);
assert.equal(closed.length, 26, 'original blink threshold is inclusive 0..25');
assert.equal(sphinx.cases.filter(c => c.mode === 'room' && c.state.room === 38 && c.expected.flags[5]).length, 0);
assert.equal(sphinx.cases.filter(c => c.mode === 'south-open' && !c.expected.ended).length, 55, 'original permits lucky passage with open eyes');
assert.equal(sphinx.cases.filter(c => c.mode === 'south-closed' && !c.expected.ended).length, 256);
assert.equal(sphinx.cases.filter(c => c.mode === 'south-no-auryn' && !c.expected.ended).length, 0);
console.log(`PASS: ${fixtures.routines.length} original routine cases, ${fixtures.parser.length} parser cases, ${fixtures.pictures.length} original pictures, both chapter transitions, exact EN/CZ opening text, bilingual play and saved games; ${sphinx.cases.length} Sphinx cases, WAIT/cek/cekej in both rooms, and EN/CZ crystal handover.`);
