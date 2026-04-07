import pathlib
import re
import json

from porydex.common import name_key

_SPECIES_DEFINE_RE = re.compile(r'^\s*#define\s+(SPECIES_[A-Z0-9_]+)\s+(.+?)\s*(?://.*)?$')
_CONST_ONLY_RE = re.compile(r'^SPECIES_[A-Z0-9_]+$')
_CONST_PLUS_RE = re.compile(r'^(SPECIES_[A-Z0-9_]+)\s*([+-])\s*(0x[0-9A-Fa-f]+|\d+)$')

_SCRIPT_SETVAR_SPECIES_RE = re.compile(
    r'^\s*setvar\s+(VAR_[A-Za-z0-9_]+)\s*,\s*(SPECIES_[A-Z0-9_]+)\b'
)
_SCRIPT_SPECIES_CMD_RE = re.compile(
    r'^\s*(givemon|giveegg|givegg|setwildbattle)\s+([A-Za-z0-9_]+)\b'
)


def _is_frlg_text(value: str) -> bool:
    value = value.lower()
    return (
        'frlg' in value
        or 'firered' in value
        or 'leafgreen' in value
        or 'ruby' in value
        or 'sapphire' in value
    )


def _strip_comments(expr: str) -> str:
    expr = expr.split('//', 1)[0]
    expr = expr.split('/*', 1)[0]
    return expr.strip()


def _normalize_expr(expr: str) -> str:
    expr = _strip_comments(expr)
    while expr.startswith('(') and expr.endswith(')'):
        expr = expr[1:-1].strip()
    return expr


def _parse_species_constant_defs(species_header: pathlib.Path) -> dict[str, str]:
    defs: dict[str, str] = {}
    with open(species_header, 'r', encoding='utf-8') as f:
        for line in f:
            match = _SPECIES_DEFINE_RE.match(line)
            if not match:
                continue
            name, expr = match.group(1), _normalize_expr(match.group(2))
            defs[name] = expr
    return defs


def _resolve_species_constant_values(species_defs: dict[str, str]) -> dict[str, int]:
    resolved: dict[str, int] = {}
    resolving: set[str] = set()

    def resolve_token(token: str) -> int | None:
        if token in resolved:
            return resolved[token]
        if token in resolving:
            return None

        expr = species_defs.get(token)
        if expr is None:
            return None

        resolving.add(token)
        value = resolve_expr(expr)
        resolving.remove(token)
        if value is not None:
            resolved[token] = value
        return value

    def resolve_expr(expr: str) -> int | None:
        expr = _normalize_expr(expr)
        if not expr:
            return None
        if _CONST_ONLY_RE.match(expr):
            return resolve_token(expr)

        plus_match = _CONST_PLUS_RE.match(expr)
        if plus_match:
            base = resolve_token(plus_match.group(1))
            if base is None:
                return None
            offset = int(plus_match.group(3), 0)
            return base + offset if plus_match.group(2) == '+' else base - offset

        try:
            return int(expr, 0)
        except ValueError:
            return None

    for key in species_defs.keys():
        resolve_token(key)

    return resolved


def _is_mega_form(name: str) -> bool:
    return '-Mega' in name


def _extract_script_species_constants(script_text: str) -> set[str]:
    constants: set[str] = set()
    var_species: dict[str, str] = {}

    for raw_line in script_text.splitlines():
        line = _strip_comments(raw_line).strip()
        if not line:
            continue

        setvar_match = _SCRIPT_SETVAR_SPECIES_RE.match(line)
        if setvar_match:
            var_species[setvar_match.group(1)] = setvar_match.group(2)
            continue

        cmd_match = _SCRIPT_SPECIES_CMD_RE.match(line)
        if not cmd_match:
            continue

        arg = cmd_match.group(2)
        if arg.startswith('SPECIES_'):
            constants.add(arg)
            continue

        mapped = var_species.get(arg)
        if mapped:
            constants.add(mapped)

    return constants


def load_manual_mega_species(included_species_file: pathlib.Path) -> list[str]:
    if not included_species_file.exists():
        return []

    manual: list[str] = []
    seen = set()
    with open(included_species_file, 'r', encoding='utf-8') as f:
        for line in f:
            name = line.strip()
            if not name or not _is_mega_form(name):
                continue
            if name in seen:
                continue
            seen.add(name)
            manual.append(name)
    return manual


def _script_command_species_names(expansion_root: pathlib.Path, species_by_num: dict[int, str]) -> set[str]:
    constant_name_map = _species_constant_name_map(expansion_root, species_by_num)
    if not constant_name_map:
        return set()

    script_species_constants: set[str] = set()
    search_roots = [
        expansion_root / 'data' / 'scripts',
        expansion_root / 'data' / 'maps',
    ]

    for root in search_roots:
        if not root.exists():
            continue
        for script_file in root.rglob('*.inc'):
            if any(_is_frlg_text(part) for part in script_file.parts):
                continue
            if script_file.name == 'debug.inc':
                continue
            try:
                with open(script_file, 'r', encoding='utf-8') as f:
                    text = f.read()
            except UnicodeDecodeError:
                continue

            script_species_constants.update(_extract_script_species_constants(text))

    names = set()
    for constant in script_species_constants:
        name = constant_name_map.get(constant)
        if name:
            names.add(name)
    return names


def _species_constant_name_map(expansion_root: pathlib.Path, species_by_num: dict[int, str]) -> dict[str, str]:
    species_header = expansion_root / 'include' / 'constants' / 'species.h'
    if not species_header.exists():
        return {}

    species_defs = _parse_species_constant_defs(species_header)
    species_constants = _resolve_species_constant_values(species_defs)
    if not species_constants:
        return {}

    constant_name_map = {}
    for constant, species_num in species_constants.items():
        name = species_by_num.get(species_num)
        if name:
            constant_name_map[constant] = name
    return constant_name_map


def _wild_encounter_json_species_names(expansion_root: pathlib.Path, species_by_num: dict[int, str]) -> set[str]:
    wild_json = expansion_root / 'src' / 'data' / 'wild_encounters.json'
    if not wild_json.exists():
        return set()

    constant_name_map = _species_constant_name_map(expansion_root, species_by_num)
    if not constant_name_map:
        return set()

    with open(wild_json, 'r', encoding='utf-8') as f:
        data = json.load(f)

    constants = set()
    for group in data.get('wild_encounter_groups', []):
        if not group.get('for_maps', False):
            continue
        for encounter in group.get('encounters', []):
            map_id = encounter.get('map', '')
            base_label = encounter.get('base_label', '')
            if _is_frlg_text(map_id) or _is_frlg_text(base_label):
                continue
            for key, zone in encounter.items():
                if not key.endswith('_mons') or not isinstance(zone, dict):
                    continue
                for mon in zone.get('mons', []):
                    constant = mon.get('species')
                    if constant:
                        constants.add(constant)

    names = set()
    for constant in constants:
        name = constant_name_map.get(constant)
        if name:
            names.add(name)
    return names


def _expand_with_evolutions(seed_names: set[str], species_by_name: dict[str, dict]) -> set[str]:
    obtained = set(seed_names)
    queue = list(seed_names)

    while queue:
        current = queue.pop()
        mon = species_by_name.get(current)
        if not mon:
            continue
        for evo_name in mon.get('evos', []):
            if evo_name in obtained:
                continue
            obtained.add(evo_name)
            queue.append(evo_name)

    return obtained


def build_included_species(
    expansion_root: pathlib.Path,
    species: dict[str, dict],
    _encounters: dict,
    manual_mega_species: list[str],
) -> list[str]:
    species_by_name = {mon['name']: mon for mon in species.values() if mon.get('name')}
    species_by_num = {mon['num']: mon['name'] for mon in species.values() if mon.get('name')}

    auto_species = set()
    auto_species.update(_wild_encounter_json_species_names(expansion_root, species_by_num))
    auto_species.update(_script_command_species_names(expansion_root, species_by_num))
    auto_species = _expand_with_evolutions(auto_species, species_by_name)
    auto_species = {name for name in auto_species if not _is_mega_form(name)}

    merged = sorted(auto_species, key=name_key)
    seen = set(merged)
    for mega in manual_mega_species:
        if mega in seen:
            continue
        seen.add(mega)
        merged.append(mega)

    return merged


def write_included_species(included_species_file: pathlib.Path, included_species: list[str]):
    included_species_file.parent.mkdir(parents=True, exist_ok=True)
    with open(included_species_file, 'w', encoding='utf-8', newline='\n') as f:
        for name in included_species:
            f.write(name)
            f.write('\n')
