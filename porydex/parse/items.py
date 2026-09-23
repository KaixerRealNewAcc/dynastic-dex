import pathlib
import re

from pycparser.c_ast import ExprList, ID, NamedInitializer
from yaspin import yaspin

import porydex.config

from porydex.parse import load_truncated, extract_int, extract_u8_str

SHARED_ITEM_NAMES = {
    'gQuestionMarksItemName': '????????',
}

_ITEM_DEFINE = re.compile(
    r'^\s*#\s*define\s+((?:ITEM_[A-Z0-9_]+|ITEMS_COUNT))\s+(.+?)\s*$',
    re.MULTILINE,
)
_FOREACH_TMHM = re.compile(
    r'^\s*#\s*define\s+FOREACH_(TM|HM)\(F\)\s*\\\s*$(.*?)(?=^\s*#\s*define|\Z)',
    re.MULTILINE | re.DOTALL,
)
_FOREACH_ENTRY = re.compile(r'\bF\(([A-Z0-9_]+)\)')

def _item_constants(fname: pathlib.Path) -> dict[str, int]:
    """Read simple item macros for expansions that do not use an item enum.

    Older expansion versions define item IDs with ``#define`` instead of an
    enum. Named TM/HM aliases can also be macros in newer versions. Normally
    the C preprocessor resolves these before pycparser sees them, but this
    fallback keeps item-table parsing reliable when an ID remains unexpanded.
    """
    definitions = {}
    for match in _ITEM_DEFINE.finditer(fname.read_text(encoding='utf-8')):
        value = re.split(r'\s*(?://|/\*)', match.group(2), maxsplit=1)[0].strip()
        definitions[match.group(1)] = value

    resolved = {}
    resolving = set()

    def resolve(name: str) -> int | None:
        if name in resolved:
            return resolved[name]

        def _add_named_tmhm_constants(item_constants: dict[str, int], fname: pathlib.Path) -> None:
        """Map generated TM/HM item IDs to their numbered item constants.

        Modern pokeemerald-expansion versions build names such as
        ``ITEM_TM_BODY_PRESS`` from ``FOREACH_TM`` in ``tms_hms.h``.  Those enum
        members are not available in ``constants/items.h`` itself, but their
        corresponding numbered constants (``ITEM_TM01``, etc.) are.
        """
        text = fname.read_text(encoding='utf-8')
        for match in _FOREACH_TMHM.finditer(text):
            machine_type, entries = match.groups()
            for number, move in enumerate(_FOREACH_ENTRY.findall(entries), start=1):
                numbered_name = f'ITEM_{machine_type}{number:02d}'
                if numbered_name in item_constants:
                    item_constants[f'ITEM_{machine_type}_{move}'] = item_constants[numbered_name]
        if name in resolving:
            return None

        value = definitions.get(name)
        if value is None:
            return None

        resolving.add(name)
        try:
            value = value.removeprefix('(').removesuffix(')').strip()
            try:
                result = int(value.rstrip('uUlL'), 0)
            except ValueError:
                if not _IDENTIFIER.fullmatch(value):
                    return None
                result = resolve(value)
                if result is None:
                    # In enum-based headers, the named alias may be a macro
                    # while its numbered target is an enum member.
                    try:
                        result = extract_int(ID(value))
                    except ValueError:
                        return None

            resolved[name] = result
            return result
        finally:
            resolving.remove(name)

    for name in definitions:
        resolve(name)

    return resolved

def get_item_name(struct_init: NamedInitializer) -> str:
    for field_init in struct_init.expr.exprs:
        if field_init.name[0].name == 'name':
            if isinstance(field_init.expr, ID):
                if field_init.expr.name in SHARED_ITEM_NAMES:
                    return SHARED_ITEM_NAMES[field_init.expr.name]
                raise ValueError(f'unrecognized shared item name ID: {field_init.expr.name}')
            return extract_u8_str(field_init.expr)

    print(struct_init.show())
    raise ValueError('no name for item structure')

def all_item_names(items_data, item_constants: dict[str, int] | None=None) -> list[str]:
    item_constants = item_constants or {}
    d_items = {}
    for item in items_data:
       item_id = item.name[0]
        try:
            item_num = extract_int(item_id)
        except ValueError:
            if not isinstance(item_id, ID) or item_id.name not in item_constants:
                raise
            item_num = item_constants[item_id.name]
       d_items[item_num] = get_item_name(item)    
       capacity = max(d_items.keys()) + 1
    l_items = [d_items[0]] * capacity
    for i, name in d_items.items():
        l_items[i] = name

   return l_items

def parse_items(fname: pathlib.Path) -> list[str]:
    items_data: ExprList
    with yaspin(text=f'Loading items data: {fname}', color='cyan') as spinner:
        items_data = load_truncated(fname, extra_includes=[
            r'-include', r'constants/items.h',
        ])
        spinner.ok("✅")

    item_constants = _item_constants(
        porydex.config.expansion / 'include' / 'constants' / 'items.h'
    )

    _add_named_tmhm_constants(
        item_constants,
        porydex.config.expansion / 'include' / 'constants' / 'tms_hms.h',
    )
    return all_item_names(items_data, item_constants)
