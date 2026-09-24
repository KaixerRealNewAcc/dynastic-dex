import pathlib

from pycparser.c_ast import ExprList, NamedInitializer, FuncCall
from yaspin import yaspin

from porydex.common import name_key
from porydex.model import DAMAGE_TYPE, DAMAGE_CATEGORY, CONTEST_CATEGORY
from porydex.parse import extract_compound_str, load_truncated, extract_int


FLAGS_EXPANSION_TO_SHOWDOWN = {
    'bitingMove': 'bite',
    'ballisticMove': 'bullet',
    'ignoresSubstitute': 'bypasssub',
    'cantUseTwice': 'cantusetwice',
    'makesContact': 'contact',
    'thawsUser': 'defrost',
    'mirrorMoveBanned': 'mirror',
    'powderMove': 'powder',
    'ignoresProtect': 'protect',
    'pulseMove': 'pulse',
    'punchingMove': 'punch',
    'kickingMove': 'kick',
    'magicCoatAffected': 'reflectable',
    'slicingMove': 'slicing',
    'snatchAffected': 'snatch',
    'soundMove': 'sound',
    'windMove': 'wind',
}


def extract_move_name(field_expr) -> str:
    """
    Handles both normal string expressions and Expansion's
    COMPOUND_STRING("Move Name") syntax.

    In some pokeemerald-expansion versions pycparser leaves
    COMPOUND_STRING(...) as a FuncCall instead of expanding it.
    """
    if isinstance(field_expr, FuncCall):
        func_name = getattr(field_expr.name, 'name', None)

        if func_name == 'COMPOUND_STRING' and field_expr.args is not None:
            return extract_compound_str(field_expr.args)

        # Fallback for other string-like macros.
        if field_expr.args is not None:
            return extract_compound_str(field_expr.args)

    return extract_compound_str(field_expr)


def parse_move(struct_init: NamedInitializer) -> dict:
    init_list = struct_init.expr.exprs

    move = {}

    move['num'] = extract_int(struct_init.name[0])

    move['flags'] = {
        # Showdown interprets these as:
        # "this move is affected by / can be invoked by this effect"
        #
        # Expansion stores some of them in the opposite manner.
        'protect': 1,
        'mirror': 1,
    }

    for field_init in init_list:
        field_name = field_init.name[0].name
        field_expr = field_init.expr

        match field_name:

            case 'name':
                move['name'] = extract_move_name(field_expr)

            case 'power':
                move['basePower'] = extract_int(field_expr)

            case 'type':
                move['type'] = DAMAGE_TYPE[extract_int(field_expr)]

            case 'accuracy':
                # Expansion stores infinite accuracy as 0.
                # Showdown uses True for always-hit moves.
                acc = extract_int(field_expr)
                move['accuracy'] = acc if acc > 0 else True

            case 'pp':
                move['pp'] = extract_int(field_expr)

            case 'priority':
                move['priority'] = extract_int(field_expr)

            case 'category':
                move['category'] = DAMAGE_CATEGORY[extract_int(field_expr)]

            case 'criticalHitStage':
                # Expansion stores this as an additional critical-hit stage.
                # Showdown considers the normal stage to be 1.
                move['critRatio'] = extract_int(field_expr) + 1

            case 'contestCategory':
                move['contestType'] = CONTEST_CATEGORY[extract_int(field_expr)]

            case 'bitingMove' \
                | 'ballisticMove' \
                | 'ignoresSubstitute' \
                | 'cantUseTwice' \
                | 'makesContact' \
                | 'thawsUser' \
                | 'powderMove' \
                | 'pulseMove' \
                | 'punchingMove' \
                | 'kickingMove' \
                | 'magicCoatAffected' \
                | 'slicingMove' \
                | 'snatchAffected' \
                | 'soundMove' \
                | 'windMove':

                move['flags'][
                    FLAGS_EXPANSION_TO_SHOWDOWN[field_name]
                ] = 1

            case 'ignoresProtect' \
                | 'mirrorMoveBanned':

                # Only remove the flag if it exists.
                flag = FLAGS_EXPANSION_TO_SHOWDOWN[field_name]

                if flag in move['flags']:
                    del move['flags'][flag]

            case _:
                pass

    # Expansion can flag sound moves as both sound and
    # ignores-substitute. Showdown only needs "sound".
    if 'sound' in move['flags'] and 'bypasssub' in move['flags']:
        del move['flags']['bypasssub']

    return move


def parse_moves_data(moves_data: ExprList) -> dict:
    all_moves = {}

    for move_init in moves_data:

        try:
            move = parse_move(move_init)

            key = name_key(move['name'])

            all_moves[key] = move

        except Exception as err:
            print()
            print('==============================')
            print('ERROR PARSING MOVE')
            print('==============================')

            try:
                move_init.show()
            except Exception:
                print(move_init)

            print()
            print('ERROR TYPE:', type(err).__name__)
            print('ERROR:', err)
            print('==============================')
            print()

            raise

    return all_moves


def parse_moves(fname: pathlib.Path) -> dict:
    moves_data: ExprList

    with yaspin(
        text=f'Loading moves data: {fname}',
        color='cyan'
    ) as spinner:

        moves_data = load_truncated(
            fname,
            extra_includes=[
                r'-include',
                r'move.h',

                r'-include',
                r'constants/battle.h',

                r'-include',
                r'constants/moves.h',
            ]
        )

        spinner.ok("✅")

    return parse_moves_data(moves_data)