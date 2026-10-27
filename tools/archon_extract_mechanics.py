#!/usr/bin/env python3
"""Export data tables, never executable code, for the native Archon routines."""
import argparse
import hashlib
import json
from pathlib import Path
from archon_extract_assets import ROOT, SHA256, relocated


def export(palette):
    m = relocated(ROOT / 'Archon.xex')
    rgb = palette.read_bytes()
    if len(rgb) != 768:
        raise ValueError('Expected a 256-color RGB Atari palette (768 bytes).')
    data = {'sourceSha256': SHA256,
            'powerMarker': {'rows': list(m[0x63A2:0x63B2]), 'phaseHpos': list(m[0x63B2:0x63B6]), 'color': 0x34},
            'paletteSha256': hashlib.sha256(rgb).hexdigest(),
            'palette': ['#' + rgb[i*3:i*3+3].hex() for i in range(256)],
            'frameOffsets': list(m[0x5CDC:0x5CF1]),
            'phoenixStages': [list(m[a:a + 5]) for a in range(0x6E92, 0x6EAB, 5)],
            'aiRange': list(m[0x55E8:0x55FC]),
            'aiRetreat': list(m[0x55FC:0x5610]),
            'aiDodge': list(m[0x5610:0x5624]),
            'weaponParameters': list(m[0x5624:0x5638]),
            'unitColors': list(m[0x5684:0x5698]),
            'pieceTypes': list(m[0x5698:0x56C0]),
            'positionValues': list(m[0x43E0:0x4431]),
            'pathDistances': list(m[0x4431:0x4443]),
            'pathOffsets': list(m[0x4525:0x45E5]),
            'pathStarts': list(m[0x45E5:0x45F7]),
            'pathLengths': list(m[0x45F7:0x4609]),
            'pathCounts': list(m[0x4609:0x461B]),
            'pathSpecial': list(m[0x461B:0x462D]),
            'glyphs': [list(m[a:a + 8]) for a in range(0x1C00, 0x1C40, 8)],
            'powerRows': list(m[0x578F:0x5794]),
            'powerColumns': list(m[0x5794:0x5799])}
    (ROOT / 'archon/assets/mechanics.js').write_text(
        '// Original Archon data tables; no instructions or CPU runtime.\n'
        'globalThis.ARCHON_MECHANICS=' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('Exported native arena and board AI data tables from the verified XEX.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--palette', type=Path,
                        default=Path.home() / 'Games/Atari800/Palettes/Default.act')
    export(parser.parse_args().palette)
