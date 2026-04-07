import pathlib

from pycparser.c_ast import Decl, ExprList, ID, InitList, NamedInitializer
from yaspin import yaspin

from porydex.parse import load_data, extract_compound_str, extract_int, extract_u8_str

def _extract_map_name(entry, map_name_defs: dict[str, str]) -> str:
    if not isinstance(entry.expr, InitList):
        raise ValueError(f'unexpected map entry initializer type: {type(entry.expr)}')

    for field_init in entry.expr.exprs:
        if not isinstance(field_init, NamedInitializer):
            continue

        field_name = field_init.name[0].name
        if field_name != 'name':
            continue

        expr = field_init.expr
        if isinstance(expr, ID):
            # Older expansion formats can reference static name symbols here.
            if expr.name in map_name_defs:
                return map_name_defs[expr.name]
            return expr.name

        try:
            return extract_compound_str(expr).title()
        except Exception:
            return extract_u8_str(expr).title()

    raise ValueError('map entry is missing .name field')

def all_maps(existing: ExprList) -> list[str]:
    # Some expansion versions keep static sMapName_* symbols; collect them if present.
    map_name_defs = {}
    for entry in reversed(existing):
        if not isinstance(entry, Decl):
            break

        if entry.name and isinstance(entry.name, str) and entry.name.startswith('sMapName_'):
            map_name_defs[entry.name] = extract_u8_str(entry.init).title()

    region_map_entries = None
    for entry in reversed(existing):
        if isinstance(entry, Decl) and entry.name == 'gRegionMapEntries':
            region_map_entries = entry
            break

    if not region_map_entries:
        raise ValueError('failed to find gRegionMapEntries declaration')

    # Now map constants to names and store them in a name map
    map_names = {
        extract_int(entry.name[0]): _extract_map_name(entry, map_name_defs)
        for entry in region_map_entries.init.exprs
    }

    # Zip the map down to a list
    return [ map_name for _, map_name in sorted(map_names.items(), key=lambda e: e[0]) ]

def parse_maps(fname: pathlib.Path) -> list[str]:
    maps_data: ExprList
    with yaspin(text=f'Loading map data: {fname}', color='cyan') as spinner:
        maps_data = load_data(fname, extra_includes=[
            r'-include', r'constants/abilities.h',
        ])
        spinner.ok("✅")

    return all_maps(maps_data)
