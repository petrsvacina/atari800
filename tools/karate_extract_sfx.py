#!/usr/bin/env python3
"""Extract all six original 4-bit digital effects from International Karate.

The original timer-1 interrupt writes each 4-bit volume to AUDC1/AUDC2/AUDC3.
The browser receives unsigned 8-bit PCM (the original nibble multiplied by 17),
not a POKEY emulator. Research WAVs are resampled to 44100 Hz for easy listening.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import wave

from karate_extract_backgrounds import Monitor

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = 'b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec'
SAMPLE_RAM_SHA256 = 'c475c5f9b85187f57fedb8b17b4445d8955a97d3eb2ad240ae05b7c322a8676c'
PAL_CPU_HZ = 1773447
TIMER_CYCLES = 28 * (0x0F + 1)
SOURCE_RATE = PAL_CPU_HZ / TIMER_CYCLES


def capture(source):
    with tempfile.TemporaryDirectory(prefix='international-karate-sfx-') as folder:
        folder = Path(folder)
        image = folder / 'source.atr'
        image.write_bytes(source.read_bytes())
        monitor = Monitor(image)
        try:
            monitor.prompt('bpc 3c06')
            monitor.prompt('cont')
            monitor.prompt('bpc 2f33')
            monitor.prompt('cont')
            dump = folder / 'ram.bin'
            monitor.prompt(f'write 0 bfff {dump}')
            return dump.read_bytes()
        finally:
            monitor.close()


def research_wav(path, pcm):
    # Zero-order hold follows the original DAC's constant volume between IRQs.
    # Remove the sample's DC offset, preserving relative amplitude. A 2ms fade
    # at each edge avoids a modern audio buffer click, not part of the source.
    rate = 44100
    frames = round(len(pcm) / SOURCE_RATE * rate)
    mean = sum(pcm) / len(pcm)
    output = bytearray()
    for frame in range(frames):
        value = (pcm[min(len(pcm) - 1, int(frame * SOURCE_RATE / rate))] - mean) / 127.5
        envelope = min(1, frame / (rate * .002), (frames - 1 - frame) / (rate * .002))
        output += struct.pack('<h', max(-32768, min(32767, round(value * envelope * 24576))))
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(output)


def export(memory, source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('This extractor is verified only for the supplied ATR.')
    if len(memory) != 0xC000:
        raise ValueError('Expected a RAM dump of $0000–$BFFF.')
    if hashlib.sha256(memory[0x9F00:0xB000]).hexdigest() != SAMPLE_RAM_SHA256:
        raise ValueError('Sample RAM differs from the verified original fresh boot.')
    # LDA sample; ORA #$10; STA AUDC1/2/3: the original digitized-volume driver.
    if memory[0x3B2D:0x3B38] != bytes.fromhex('09 10 8d 01 d2 8d 03 d2 8d 05 d2'):
        raise ValueError('The expected original volume-DAC routine is missing.')
    public = ROOT / 'karate/assets'
    research = ROOT / 'research/international-karate/sfx'
    public.mkdir(parents=True, exist_ok=True)
    research.mkdir(parents=True, exist_ok=True)
    result = {'sourceSha256': SOURCE_SHA256, 'encoding': 'u8',
              'sourceSampleRate': SOURCE_RATE, 'samples': []}
    provenance = {'sourceSha256': SOURCE_SHA256, 'source': source.name,
                  'sampleRamSha256': SAMPLE_RAM_SHA256,
                  'driverEntry': '3A89', 'timerInterrupt': '3AED',
                  'palCpuHz': PAL_CPU_HZ, 'timerCycles': TIMER_CYCLES,
                  'sourceSampleRate': SOURCE_RATE, 'encoding': '4-bit volume DAC',
                  'conversion': 'Original nibble multiplied by 17 to unsigned 8-bit PCM.',
                  'samples': []}
    for identifier in range(6):
        start = int.from_bytes(memory[0x3A77 + identifier * 2:0x3A79 + identifier * 2], 'little')
        end = memory[0x3A71 + identifier] << 8
        shift = 4 if memory[0x3A83 + identifier] & 0x80 else 0
        if not 0x9F00 <= start < end <= 0xB000:
            raise ValueError(f'Unexpected source boundaries for effect {identifier}.')
        # The interrupt increments its self-modified read pointer before LDA,
        # so the byte at the table's start address is intentionally skipped.
        packed = memory[start + 1:end]
        pcm = bytes(((value >> shift) & 15) * 17 for value in packed)
        metadata = {'id': identifier, 'duration': len(pcm) / SOURCE_RATE,
                    'startAddress': f'{start + 1:04X}', 'endAddressExclusive': f'{end:04X}',
                    'nibble': 'high' if shift else 'low'}
        result['samples'].append({**metadata, 'data': base64.b64encode(pcm).decode()})
        raw = research / f'effect-{identifier}.u8'
        raw.write_bytes(pcm)
        wav = research / f'effect-{identifier}.wav'
        research_wav(wav, pcm)
        provenance['samples'].append({**metadata, 'sourceBytes': len(packed),
                                     'pcmSha256': hashlib.sha256(pcm).hexdigest(),
                                     'wavSha256': hashlib.sha256(wav.read_bytes()).hexdigest()})
        print(f'Effect {identifier}: ${start + 1:04X}–${end - 1:04X}, '
              f'{metadata["nibble"]} nibble, {len(pcm)} samples, {metadata["duration"]:.4f}s')
    (public / 'sfx.js').write_text('// Original International Karate digital effects; see research/international-karate/sfx/README.md.\n'
                                  'globalThis.KARATE_SFX = ' + json.dumps(result, separators=(',', ':')) + ';\n')
    (research / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memory', type=Path, help='Reuse an existing loaded $0000–$BFFF RAM dump')
    args = parser.parse_args()
    source = ROOT / 'International Karate.atr'
    export(args.memory.read_bytes() if args.memory else capture(source), source)
