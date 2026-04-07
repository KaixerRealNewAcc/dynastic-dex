import pathlib
import pickle
import re
import typing

import porydex.config

from pycparser import parse_file
from pycparser.c_ast import (
    BinaryOp,
    Cast,
    CompoundLiteral,
    Decl,
    Constant,
    ExprList,
    FuncCall,
    ID,
    NodeVisitor,
    TernaryOp,
    UnaryOp,
)

from porydex.common import (
    PICKLE_PATH,
    BINARY_BOOL_OPS,
    CONFIG_INCLUDES,
    EXPANSION_INCLUDES,
    GLOBAL_PREPROC,
    PREPROCESS_LIBC,
)

_CONST_IDS: dict[str, int] = {}

def _pickle_target(fname: pathlib.Path) -> pathlib.Path:
    return PICKLE_PATH / fname.stem

def _load_pickled(fname: pathlib.Path) -> ExprList | None:
    target = _pickle_target(fname)
    exts = None
    if target.exists():
        with open(target, 'rb') as f:
            exts = pickle.load(f)
    return exts

def _dump_pickled(fname: pathlib.Path, exts: list):
    PICKLE_PATH.mkdir(parents=True, exist_ok=True)
    target = _pickle_target(fname)
    with open(target, 'wb') as f:
        pickle.dump(exts, f, protocol=pickle.HIGHEST_PROTOCOL)

def _parse_int_literal(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return int(value, 16)

def _eval_const_expr(expr, const_ids: dict[str, int]) -> int:
    if isinstance(expr, Constant):
        return _parse_int_literal(expr.value)

    if isinstance(expr, ID):
        if expr.name in const_ids:
            return const_ids[expr.name]
        raise ValueError(f'unrecognized constant ID: {expr.name}')

    if isinstance(expr, Cast):
        return _eval_const_expr(expr.expr, const_ids)

    if isinstance(expr, UnaryOp):
        val = _eval_const_expr(expr.expr, const_ids)
        match expr.op:
            case '-':
                return -val
            case '+':
                return val
            case '~':
                return ~val
            case '!':
                return int(not val)
            case _:
                raise ValueError(f'unrecognized unary operator: {expr.op}')

    if isinstance(expr, BinaryOp):
        left = _eval_const_expr(expr.left, const_ids)
        right = _eval_const_expr(expr.right, const_ids)
        if expr.op not in BINARY_BOOL_OPS:
            raise ValueError(f'unrecognized binary operator: {expr.op}')
        return int(BINARY_BOOL_OPS[expr.op](left, right))

    if isinstance(expr, TernaryOp):
        return _eval_const_expr(expr.iftrue if _eval_const_expr(expr.cond, const_ids) else expr.iffalse, const_ids)

    if hasattr(expr, 'value'):
        return _parse_int_literal(expr.value)

    raise ValueError(f'cannot evaluate expression to int: {type(expr)}')

class _EnumValueCollector(NodeVisitor):
    def __init__(self):
        self.values = {}

    def visit_Enum(self, node):
        if not node.values:
            return

        current = -1
        for enumerator in node.values.enumerators:
            if enumerator.value is None:
                current = current + 1
            else:
                # Allow aliases across previously parsed enums and this enum.
                lookup = {**_CONST_IDS, **self.values}
                try:
                    current = _eval_const_expr(enumerator.value, lookup)
                except Exception:
                    continue

            self.values[enumerator.name] = current

def _update_const_ids(exts: list):
    collector = _EnumValueCollector()
    for ext in exts:
        collector.visit(ext)
    _CONST_IDS.update(collector.values)

def load_data(fname: pathlib.Path,
              extra_includes: list[str]=[]) -> ExprList:
    exts = _load_pickled(fname)
    if not exts:
        include_dirs = [f'-I{porydex.config.expansion / dir}' for dir in EXPANSION_INCLUDES]
        exts = parse_file(
            fname,
            use_cpp=True,
            cpp_path=porydex.config.compiler,
            cpp_args=[
                *PREPROCESS_LIBC,
                *include_dirs,
                *GLOBAL_PREPROC,
                *CONFIG_INCLUDES,
                *extra_includes
            ]
        ).ext
        _dump_pickled(fname, exts)

    _update_const_ids(exts)
    return exts

def load_truncated(fname: pathlib.Path,
                   extra_includes: list[str]=[]) -> ExprList:
    return load_data(fname, extra_includes)[-1].init.exprs

def load_table_set(fname: pathlib.Path,
                   extra_includes: list[str]=[],
                   minimal_preprocess: bool=False) -> list[Decl]:
    include_dirs = [f'-I{porydex.config.expansion / dir}' for dir in EXPANSION_INCLUDES]

    if minimal_preprocess:
        # do NOT dump this version
        exts = parse_file(
            fname,
            use_cpp=True,
            cpp_path=porydex.config.compiler,
            cpp_args=[
                *PREPROCESS_LIBC,
                *include_dirs,
                r'-DTRUE=1',
                r'-DFALSE=0',
                r'-Du16=short',
                r'-include', r'config/species_enabled.h',
                *extra_includes
            ]
        ).ext
        _update_const_ids(exts)
    else:
        exts = _load_pickled(fname)

    if not exts:
        exts = parse_file(
            fname,
            use_cpp=True,
            cpp_path=porydex.config.compiler,
            cpp_args=[
                *PREPROCESS_LIBC,
                *include_dirs,
                *GLOBAL_PREPROC,
                *CONFIG_INCLUDES,
                *extra_includes
            ]
        ).ext
        _dump_pickled(fname, exts)

    _update_const_ids(exts)
    return exts

def load_data_and_start(fname: pathlib.Path,
                        pattern: re.Pattern,
                        extra_includes: list[str]=[]) -> tuple[ExprList, int]:
    all_data = load_data(fname, extra_includes)

    start = 0
    if pattern:
        end = len(all_data)
        for i in range(-1, -end, -1):
            if not all_data[i].name or not pattern.match(all_data[i].name):
                start = i + 1
                break

    return (all_data, start)

def eval_binary_operand(expr) -> int:
    if isinstance(expr, BinaryOp):
        return int(process_binary(expr))
    elif isinstance(expr, TernaryOp):
        return int(_eval_const_expr(process_ternary(expr), _CONST_IDS))
    return int(_eval_const_expr(expr, _CONST_IDS))

def process_binary(expr: BinaryOp) -> int | bool:
    left = eval_binary_operand(expr.left)
    right = eval_binary_operand(expr.right)
    op = BINARY_BOOL_OPS[expr.op]
    return op(left, right)

def process_ternary(expr: TernaryOp) -> typing.Any:
    if isinstance(expr.cond, BinaryOp):
        op = BINARY_BOOL_OPS[expr.cond.op]
        left = eval_binary_operand(expr.cond.left)
        right = eval_binary_operand(expr.cond.right)
        return expr.iftrue if op(left, right) else expr.iffalse

    return expr.iftrue if eval_binary_operand(expr.cond) else expr.iffalse

def extract_compound_str(expr) -> str:
    # Depending on the compiler used for preprocessing, this could be expanded
    # to a number of types.

    # arm-none-eabi-gcc expands the macro to Cast(FuncCall(ExprList([Constant])))
    if isinstance(expr, Cast):
        return expr.expr.args.exprs[-1].value.replace('\\n', ' ')[1:-1]

    # clang expands the macro to CompoundLiteral(InitList([Constant]))
    if isinstance(expr, CompoundLiteral):
        return expr.init.exprs[-1].value.replace('\\n', ' ')[1:-1]

    if isinstance(expr.exprs[-1], FuncCall):
        return extract_compound_str(expr.exprs[0].args)
    return expr.exprs[-1].value.replace('\\n', ' ')[1:-1]

def extract_u8_str(expr) -> str:
    # Depending on the compiler used for preprocessing, this could be expanded
    # to a number of types.

    # gcc can wrap the string expression in a cast.
    if isinstance(expr, Cast):
        return extract_u8_str(expr.expr)

    # arm-none-eabi-gcc and gcc expand the macro to FuncCall(ExprList([Constant]))
    if isinstance(expr, FuncCall):
        return expr.args.exprs[-1].value.replace('\\n', ' ')[1:-1]

    # clang can emit CompoundLiteral(InitList([Constant])).
    if isinstance(expr, CompoundLiteral):
        return expr.init.exprs[-1].value.replace('\\n', ' ')[1:-1]

    # clang expands the macro to InitList([Constant])
    if isinstance(expr, ExprList):
        return expr.exprs[0].value.replace('\\n', ' ')[1:-1]

    raise ValueError(f'unrecognized u8 string expression type: {type(expr)}')

def extract_int(expr) -> int:
    try:
        return _eval_const_expr(expr, _CONST_IDS)
    except Exception:
        if isinstance(expr, ID):
            if expr.name in _CONST_IDS:
                return _CONST_IDS[expr.name]
            raise ValueError(f'unrecognized constant ID: {expr.name}')

        if isinstance(expr, TernaryOp):
            return int(process_ternary(expr).value)

        if isinstance(expr, UnaryOp):
            # we only care about the negative symbol
            if expr.op != '-':
                raise ValueError(f'unrecognized unary operator: {expr.op}')
            return -1 * int(expr.expr.value)

        if isinstance(expr, BinaryOp):
            return int(process_binary(expr))

        try:
            return int(expr.value)
        except ValueError:
            # try hexadecimal; if that doesn't work, just fail
            return int(expr.value, 16)

def extract_id(expr) -> str:
    if isinstance(expr, TernaryOp):
        return process_ternary(expr).name

    if isinstance(expr, BinaryOp):
        return str(expr.op).join([expr.left.name, expr.right.name])

    return expr.name

def extract_prefixed(prefix: str | re.Pattern, val: str, mod_if_match: typing.Callable[[str], str]=lambda x: x) -> str:
    match = re.match(prefix, val)
    if match:
        return mod_if_match(match.group(1))

    return val
