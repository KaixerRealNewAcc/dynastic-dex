var ITEM_LOCATION_ORDER = [
	'starterlocation',
	'littleroottown',
	'route101',
	'oldaletown',
	'route103',
	'route102',
	'petalburgcity',
	'petalburggrotto',
	'route104',
	'petalburgwoods',
	'rustborocity',
	'devoncorp',
	'route116',
	'route115',
	'rusturftunnel',
	'unnamedisland',
	'verdanturftown',
	'dewfordtown',
	'dewfordhill',
	'route107',
	'route106',
	'granitecave',
	'route109',
	'slateportcity',
	'route110',
	'route105',
	'route108',
	'abandonedship',
	'route134',
	'starfallcave',
	'daycare',
	'route117',
	'route118',
	'route111',
	'route112',
	'fierypath',
	'route113',
	'fallarbortown',
	'route114',
	'meteorfalls',
	'miragetower',
	'mtchimney',
	'jaggedpass',
	'lavaridgetown',
	'route119',
	'weatherinstitute',
	'fortreecity',
	'route120',
	'scorchedslab',
	'route121',
	'route122',
	'mtpyre',
	'magmahideout',
	'aquahideout',
	'route123',
	'lilycovecity',
	'route124',
	'mossdeepcity',
	'route125',
	'shoalcave',
	'route127',
	'route126',
	'route128',
	'route129',
	'route130',
	'route131',
	'pacifidlogtown',
	'route132',
	'route133',
	'evergrandecity',
	'victoryroad',
	'underwaterroute124',
	'underwaterroute126',
	'underwaterroute127',
	'underwaterroute128',
	'quickmenututorsstonebadge',
	'quickmenututorsknucklebadge',
	'quickmenututorsbalancebadge',
	'quickmenututorsdynamobadge',
	'quickmenututorsheatbadge',
	'quickmenututorsfeatherbadge',
	'quickmenututorsmindbadge',
	'quickmenututorsrainbadge'
];

var ITEM_LOCATION_ORDER_INDEX = (function () {
	var index = {};
	for (var i = 0; i < ITEM_LOCATION_ORDER.length; i++) {
		index[ITEM_LOCATION_ORDER[i]] = i;
	}
	return index;
})();

function normalizeItemLocationOrderKey(key) {
	var normalized = toID(key || '');
	if (normalized.indexOf('alteringcave') === 0) {
		return normalized.replace(/^alteringcave/, 'starfallcave');
	}
	if (normalized.indexOf('evergrandecity') === 0) return 'evergrandecity';
	if (normalized.indexOf('scorchedslabs') === 0) return 'scorchedslab';
	return normalized;
}

function getItemOrderedLocationBaseId(locationId, locationName) {
	var normalized = normalizeItemLocationOrderKey(locationName || locationId || '');
	if (/^route\d+$/.test(normalized) || /^underwaterroute\d+$/.test(normalized)) {
		return normalized;
	}
	for (var i = 0; i < ITEM_LOCATION_ORDER.length; i++) {
		var key = ITEM_LOCATION_ORDER[i];
		if (normalized === key || normalized.indexOf(key) === 0) return key;
	}
	return normalized;
}

function sortItemLocationsByPreferredOrder(locations) {
	locations.sort(function (a, b) {
		var aRank = ITEM_LOCATION_ORDER_INDEX.hasOwnProperty(a.baseArea) ? ITEM_LOCATION_ORDER_INDEX[a.baseArea] : 9999;
		var bRank = ITEM_LOCATION_ORDER_INDEX.hasOwnProperty(b.baseArea) ? ITEM_LOCATION_ORDER_INDEX[b.baseArea] : 9999;
		if (aRank !== bRank) return aRank - bRank;
		if (a.baseArea !== b.baseArea) return a.baseArea < b.baseArea ? -1 : 1;
		if (a.name !== b.name) return a.name < b.name ? -1 : 1;
		return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
	});
}

function isIgnoredItemLocationEntry(entry) {
	if (!entry) return true;
	var itemConstId = toID(entry.itemConst || '');
	var itemId = toID(entry.itemId || '');
	var itemNameId = toID(entry.item || '');
	return itemConstId === 'itemtmsalesman' || itemId === 'tmsalesman' || itemNameId === 'tmsalesman';
}

function getItemLocationEntryQuantitySignature(entry) {
	var quantityText = String(entry && entry.quantityText || '');
	if (quantityText) return quantityText;
	if (!entry || entry.quantity === undefined || entry.quantity === null) return '';
	return String(entry.quantity);
}

function getItemLocationNoteRules() {
	var source = window.BattleItemLocationNotes || [];
	if (!Array.isArray(source) && source && Array.isArray(source.entries)) source = source.entries;
	return Array.isArray(source) ? source : [];
}

function itemLocationNoteFieldMatches(expected, actual) {
	if (expected === undefined || expected === null || expected === '') return true;
	return toID(expected) === toID(actual || '');
}

function doesItemLocationNoteMatch(rule, locationId, locationName, entry) {
	if (!rule || !entry) return false;
	if (!itemLocationNoteFieldMatches(rule.locationId, locationId)) return false;
	if (!itemLocationNoteFieldMatches(rule.location, locationName)) return false;
	if (!itemLocationNoteFieldMatches(rule.kind, entry.kind)) return false;
	if (!itemLocationNoteFieldMatches(rule.itemConst, entry.itemConst)) return false;
	if (!itemLocationNoteFieldMatches(rule.item, entry.item)) return false;
	if (!itemLocationNoteFieldMatches(rule.itemId, entry.itemId)) return false;

	var hasQuantityRule = Object.prototype.hasOwnProperty.call(rule, 'quantity') || Object.prototype.hasOwnProperty.call(rule, 'quantityText');
	if (!hasQuantityRule) return true;

	var expectedQuantity = rule.quantityText !== undefined && rule.quantityText !== null && rule.quantityText !== '' ?
		String(rule.quantityText) :
		(rule.quantity === undefined || rule.quantity === null ? '' : String(rule.quantity));
	return expectedQuantity === getItemLocationEntryQuantitySignature(entry);
}

function mergeItemLocationRequirement(existingRequirement, noteText, noteMode) {
	var note = String(noteText || '').trim();
	if (!note) return String(existingRequirement || '');
	if (String(noteMode || '').toLowerCase() === 'replace') return note;

	var existing = String(existingRequirement || '').trim();
	if (!existing) return note;

	var parts = existing.split(/\s*;\s*/);
	for (var i = 0; i < parts.length; i++) {
		if (toID(parts[i]) === toID(note)) return existing;
	}
	parts.push(note);
	return parts.join('; ');
}

function applyItemLocationNotesToEntry(entry, noteRules, locationId, locationName) {
	if (!entry || !noteRules || !noteRules.length) return entry;

	var out = entry;
	for (var i = 0; i < noteRules.length; i++) {
		var rule = noteRules[i];
		if (!doesItemLocationNoteMatch(rule, locationId, locationName, entry)) continue;

		var noteText = rule.note === undefined || rule.note === null ? '' : String(rule.note).trim();
		if (!noteText) continue;

		if (out === entry) {
			out = {};
			for (var key in entry) {
				if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
				out[key] = entry[key];
			}
		}
		out.requirement = mergeItemLocationRequirement(out.requirement, noteText, rule.noteMode);
	}

	return out;
}

var ITEM_LOCATION_ICON_FILE_OVERRIDES = {
	heartscale: ['heart-scale'],
	rarecandy: ['rare-candy'],
	endlesscandy: ['rare-candy'],
	hypercandy: ['xl-candy', 'exp-candy-xl', 'rare-candy'],
	infiniterepel: ['max-repel'],
	dowsingmachine: ['dowsing-machine', 'dowsing-mchn', 'dowsingmachine'],
	abilitycapsule: ['medicine/ability-capsule'],
	lure: ['lure'],
	superlure: ['super-lure', 'lure-super'],
	maxlure: ['max-lure', 'lure-max'],
	megaring: ['mega-ring', 'mega-bracelet', 'key-stone'],
	paralyzeheal: ['parlyz-heal'],
	devonparts: ['devon-goods'],
	xdefense: ['x-defend'],
	xspatk: ['x-special']
};

var ITEM_LOCATION_FALLBACK_LABEL_OVERRIDES = {
	heartscale: 'HS',
	rarecandy: 'RC',
	endlesscandy: 'RC',
	hypercandy: 'XL',
	infiniterepel: 'MR'
};

var ITEM_LOCATION_MOVE_TYPE_ICON_OVERRIDES = {
	alluringvoice: 'fairy',
	covet: 'fairy'
};

var ITEM_LOCATION_CATEGORY_FILTER_DEFS = [
	{id: 'marts', label: 'Marts'},
	{id: 'heartscales', label: 'Heart Scales'},
	{id: 'rarecandies', label: 'Rare Candies'},
	{id: 'evolutionitems', label: 'Evolution Items'},
	{id: 'helditems', label: 'Held Items'},
	{id: 'machinesandtutors', label: 'TM/HM & Move Tutors'},
	{id: 'megastones', label: 'Mega Stones'},
	{id: 'delibirddelivery', label: 'Delibird Delivery'}
];

var QUICK_MENU_TUTOR_SOURCE = [
	{locationId: 'quickmenututorsstonebadge', locationName: 'Quick Menu Tutors (Stone Badge)', requirement: '', moves: ['icicle_spear', 'scale_shot', 'rock_blast', 'bullet_seed']},
	{locationId: 'quickmenututorsknucklebadge', locationName: 'Quick Menu Tutors (Knuckle Badge)', requirement: '', moves: ['fire_punch', 'thunder_punch', 'ice_punch', 'shadow_punch', 'mega_punch', 'bullet_punch', 'poison_jab', 'brick_break']},
	{locationId: 'quickmenututorsbalancebadge', locationName: 'Quick Menu Tutors (Balance Badge)', requirement: '', moves: ['take_down', 'fire_fang', 'thunder_fang', 'ice_fang', 'poison_fang', 'crunch']},
	{locationId: 'quickmenututorsdynamobadge', locationName: 'Quick Menu Tutors (Dynamo Badge)', requirement: '', moves: ['extrasensory', 'signal_beam', 'burning_jealousy', 'scorching_sands', 'discharge', 'iron_head', 'seed_bomb']},
	{locationId: 'quickmenututorsheatbadge', locationName: 'Quick Menu Tutors (Heat Badge)', requirement: '', moves: ['low_sweep', 'mud_shot', 'bulldoze', 'ice_spinner', 'lash_out']},
	{locationId: 'quickmenututorsfeatherbadge', locationName: 'Quick Menu Tutors (Feather Badge)', requirement: '', moves: ['stone_edge', 'grassy_glide', 'muddy_water', 'natural_gift', 'nature_power']},
	{locationId: 'quickmenututorsmindbadge', locationName: 'Quick Menu Tutors (Mind Badge)', requirement: '', moves: ['flip_turn', 'skill_swap', 'power_gem', 'hypnosis']},
	{locationId: 'quickmenututorsrainbadge', locationName: 'Quick Menu Tutors (Rain Badge)', requirement: '', moves: ['aqua_tail', 'superpower', 'psycho_shift', 'bounce', 'hyper_voice']},
	{locationId: 'petalburgcity', locationName: 'Petalburg City', requirement: 'On Location', moves: ['bug_bite', 'torment', 'hidden_power']},
	{locationId: 'verdanturftown', locationName: 'Verdanturf Town', requirement: 'On Location', moves: ['covet', 'helping_hand', 'metronome', 'fling']},
	{locationId: 'dewfordtown', locationName: 'Dewford Town', requirement: 'On Location', moves: ['trailblaze', 'flame_charge', 'pounce', 'chilling_water']},
	{locationId: 'mauvillecity', locationName: 'Mauville City', requirement: 'On Location', moves: ['zen_headbutt', 'rock_slide', 'ancient_power', 'ominous_wind', 'silver_wind', 'parabolic_charge']},
	{locationId: 'route111', locationName: 'Route 111', requirement: 'On Location', moves: ['stomping_tantrum', 'temper_flare', 'dig', 'slam']},
	{locationId: 'fierypath', locationName: 'Fiery Path', requirement: 'On Location', moves: ['fire_spin', 'lava_plume']},
	{locationId: 'lavaridgetown', locationName: 'Lavaridge Town', requirement: 'On Location', moves: ['air_slash', 'alluring_voice', 'psyshock', 'morning_sun']},
	{locationId: 'mossdeepcity', locationName: 'Mossdeep City', requirement: 'On Location', moves: ['dream_eater', 'aura_sphere', 'dragon_pulse', 'dark_pulse', 'hex', 'vacuum_wave', 'power_whip']},
	{locationId: 'sootopoliscity', locationName: 'Sootopolis City', requirement: 'On Location', moves: ['thunder', 'blizzard', 'fire_blast', 'hydro_pump', 'sky_attack']}
];

var QUICK_MENU_DELIBIRD_DELIVERY_SOURCE = [
	{
		slot: 1,
		items: [
			{itemConst: 'ITEM_EVIOLITE', quantity: 1},
			{itemConst: 'ITEM_HARD_STONE', quantity: 1},
			{itemConst: 'ITEM_HM_CUT', quantity: 1},
			{itemConst: 'ITEM_PEARL', quantity: 2},
			{itemConst: 'ITEM_DIVE_BALL', quantity: 5},
			{itemConst: 'ITEM_DUSK_BALL', quantity: 5},
			{itemConst: 'ITEM_QUICK_BALL', quantity: 5},
			{itemConst: 'ITEM_ICE_STONE', quantity: 1},
			{itemConst: 'ITEM_DEEP_SEA_TOOTH', quantity: 1},
			{itemConst: 'ITEM_DEEP_SEA_SCALE', quantity: 1}
		]
	},
	{
		slot: 2,
		items: [
			{itemConst: 'ITEM_SERIOUS_MINT', quantity: 1},
			{itemConst: 'ITEM_CHILAN_BERRY', quantity: 1},
			{itemConst: 'ITEM_REVIVE', quantity: 2},
			{itemConst: 'ITEM_LURE', quantity: 1},
			{itemConst: 'ITEM_SITRUS_BERRY', quantity: 25},
			{itemConst: 'ITEM_PERSIM_BERRY', quantity: 60},
			{itemConst: 'ITEM_LUM_BERRY', quantity: 10},
			{itemConst: 'ITEM_RAWST_BERRY', quantity: 60},
			{itemConst: 'ITEM_RAWST_BERRY', quantity: 60},
			{itemConst: 'ITEM_BERRY_JUICE', quantity: 50},
			{itemConst: 'ITEM_ASPEAR_BERRY', quantity: 60},
			{itemConst: 'ITEM_ORAN_BERRY', quantity: 60}
		]
	},
	{
		slot: 3,
		items: [
			{itemConst: 'ITEM_SERIOUS_MINT', quantity: 1},
			{itemConst: 'ITEM_ADRENALINE_ORB', quantity: 1},
			{itemConst: 'ITEM_SCRAFTINITE', quantity: 1},
			{itemConst: 'ITEM_ULTRA_BALL', quantity: 10},
			{itemConst: 'ITEM_QUICK_BALL', quantity: 10},
			{itemConst: 'ITEM_LEEK', quantity: 1},
			{itemConst: 'ITEM_THICK_CLUB', quantity: 1}
		]
	},
	{
		slot: 4,
		items: [
			{itemConst: 'ITEM_REVIVE', quantity: 1}
		]
	}
];

var RARE_CANDY_IDS = {
	rarecandy: true,
	endlesscandy: true,
	hypercandy: true
};

var KNOWN_EVOLUTION_ITEM_IDS = {
	auspiciousarmor: true,
	blackaugurite: true,
	chippedpot: true,
	crackedpot: true,
	dawnstone: true,
	deepseascale: true,
	deepseatooth: true,
	dragonscale: true,
	dubiousdisc: true,
	duskstone: true,
	electirizer: true,
	firestone: true,
	galaricacuff: true,
	galaricawreath: true,
	icestone: true,
	kingsrock: true,
	leafstone: true,
	linkingcord: true,
	magmarizer: true,
	maliciousarmor: true,
	metalcoat: true,
	moonstone: true,
	ovalstone: true,
	peatblock: true,
	prismscale: true,
	protector: true,
	razorclaw: true,
	razorfang: true,
	reapercloth: true,
	sachet: true,
	shinystone: true,
	sunstone: true,
	sweetapple: true,
	tartapple: true,
	thunderstone: true,
	upgrade: true,
	waterstone: true,
	whippeddream: true
};

var UNAVAILABLE_MEGA_STONE_DENYLIST = {
	rayquazaite: true
};

var ITEM_LOCATION_KIND_ORDER = {
	'Field': 0,
	'Hidden': 1,
	'Berry Tree': 2,
	'Delivery': 3,
	'Gift': 3,
	'Mart': 4,
	'Move Tutor': 5,
	'Unavailable': 6
};

var cachedEvolutionItemIds = null;
var cachedKnownMegaStoneIds = null;
var cachedBattleItemNameIdToItemId = null;

function renderItemLocationCategoryButtonIcon(optionId) {
	if (optionId !== 'delibirddelivery') return '';
	var iconStyle = Dex.getPokemonIcon('delibird');
	return '<span aria-hidden="true" style="display:inline-block;vertical-align:middle;width:26px;height:19px;overflow:hidden;margin-right:6px;"><span style="display:block;width:40px;height:30px;transform:scale(0.63);transform-origin:left top;' + iconStyle + '"></span></span>';
}

function hasItemLocationCategoryEntries(locations, categoryId) {
	if (!locations || !locations.length) return false;
	for (var i = 0; i < locations.length; i++) {
		var location = locations[i];
		var items = location && location.items || [];
		for (var j = 0; j < items.length; j++) {
			if (entryMatchesItemLocationCategory(items[j], categoryId)) return true;
		}
	}
	return false;
}

function buildItemLocationCategoryFilters(locations, delibirdDeliveryLocations, unavailableMegaStoneEntries) {
	var filters = [{id: 'all', label: 'All Item Locations'}];
	var hasMegaStones = hasItemLocationCategoryEntries(locations, 'megastones') || !!(unavailableMegaStoneEntries && unavailableMegaStoneEntries.length);
	for (var i = 0; i < ITEM_LOCATION_CATEGORY_FILTER_DEFS.length; i++) {
		var option = ITEM_LOCATION_CATEGORY_FILTER_DEFS[i];
		if (option.id === 'delibirddelivery') {
			if (delibirdDeliveryLocations && delibirdDeliveryLocations.length) filters.push(option);
			continue;
		}
		if (option.id === 'megastones') {
			if (hasMegaStones) filters.push(option);
			continue;
		}
		if (!hasItemLocationCategoryEntries(locations, option.id)) continue;
		filters.push(option);
	}
	return filters;
}

function isItemLocationCategoryAvailable(filters, categoryId) {
	for (var i = 0; i < filters.length; i++) {
		if (filters[i].id === categoryId) return true;
	}
	return false;
}

function renderItemLocationCategoryFilterButtons(activeCategoryId, filters) {
	var buf = '<div class="itemlocationfilterbar" style="margin-top:6px;">';
	for (var i = 0; i < filters.length; i++) {
		var option = filters[i];
		var isActive = option.id === activeCategoryId;
		var icon = renderItemLocationCategoryButtonIcon(option.id);
		buf += '<button class="button itemcategoryfilterbutton' + (isActive ? ' cur' : '') + '" type="button" value="' + option.id + '" style="margin:0 4px 4px 0;">' + icon + Dex.escapeHTML(option.label) + '</button>';
	}
	buf += '</div>';
	return buf;
}

function getItemLocationEntryId(entry) {
	return toID((entry && (entry.itemId || entry.item || entry.itemConst)) || '');
}

function getBattleItemNameIdToItemIdMap() {
	if (cachedBattleItemNameIdToItemId) return cachedBattleItemNameIdToItemId;
	var out = {};
	var items = window.BattleItems || {};
	for (var itemKey in items) {
		var dexItem = Dex.items.get(itemKey);
		if (!dexItem || !dexItem.exists) continue;
		var itemNameId = toID(dexItem.name || '');
		var canonicalId = toID(dexItem.id || itemKey);
		if (!itemNameId || !canonicalId) continue;
		if (!out[itemNameId]) out[itemNameId] = canonicalId;
	}
	cachedBattleItemNameIdToItemId = out;
	return out;
}

function getResolvedItemLocationEntryId(entry) {
	var rawItemId = getItemLocationEntryId(entry);
	if (rawItemId) {
		var direct = Dex.items.get(rawItemId);
		if (direct && direct.exists) return toID(direct.id || rawItemId);
	}
	var itemNameId = toID(entry && entry.item || '');
	if (itemNameId) {
		var nameMap = getBattleItemNameIdToItemIdMap();
		if (nameMap[itemNameId]) return nameMap[itemNameId];
	}
	return rawItemId;
}

function getItemLocationIdFromItemConst(itemConst) {
	return toID(String(itemConst || '').replace(/^ITEM_/, ''));
}

function getPrettyNameFromItemConst(itemConst) {
	var raw = String(itemConst || '').replace(/^ITEM_/, '');
	if (!raw) return 'Unknown Item';
	var moveMatch = /^(TM|HM)_([A-Z0-9_]+)$/.exec(raw);
	if (moveMatch) {
		var moveName = moveMatch[2].replace(/_/g, ' ').toLowerCase().replace(/\b[a-z]/g, function (c) {
			return c.toUpperCase();
		});
		return moveMatch[1] + ' ' + moveName;
	}
	var words = raw.split('_');
	for (var i = 0; i < words.length; i++) {
		var word = words[i];
		if (!word) continue;
		words[i] = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
	}
	return words.join(' ');
}

function getItemLocationNameFromItemConst(itemConst) {
	var itemId = getItemLocationIdFromItemConst(itemConst);
	var dexItem = Dex.items.get(itemId);
	if (dexItem && dexItem.exists && dexItem.name) return dexItem.name;
	return getPrettyNameFromItemConst(itemConst);
}

function getItemLocationEntryKey(entry) {
	return [
		toID(entry.kind || ''),
		toID(entry.itemConst || ''),
		toID(entry.item || ''),
		toID(entry.moveId || ''),
		String(entry.quantity || ''),
		String(entry.quantityText || ''),
		String(entry.requirement || '')
	].join('|');
}

function sortItemLocationEntries(items) {
	items.sort(function (a, b) {
		var aKind = ITEM_LOCATION_KIND_ORDER.hasOwnProperty(a.kind) ? ITEM_LOCATION_KIND_ORDER[a.kind] : 99;
		var bKind = ITEM_LOCATION_KIND_ORDER.hasOwnProperty(b.kind) ? ITEM_LOCATION_KIND_ORDER[b.kind] : 99;
		if (aKind !== bKind) return aKind - bKind;
		var aName = String(a.item || a.itemConst || '');
		var bName = String(b.item || b.itemConst || '');
		if (aName !== bName) return aName < bName ? -1 : 1;
		var aReq = String(a.requirement || '');
		var bReq = String(b.requirement || '');
		if (aReq !== bReq) return aReq < bReq ? -1 : 1;
		var aKey = getItemLocationEntryKey(a);
		var bKey = getItemLocationEntryKey(b);
		if (aKey === bKey) return 0;
		return aKey < bKey ? -1 : 1;
	});
}

function getEvolutionItemIdSet() {
	if (cachedEvolutionItemIds) return cachedEvolutionItemIds;
	var out = {};
	for (var knownId in KNOWN_EVOLUTION_ITEM_IDS) out[knownId] = true;
	var dex = window.BattlePokedex || {};
	for (var speciesId in dex) {
		var species = dex[speciesId];
		if (!species) continue;
		var evoItemId = toID(species.evoItem || '');
		if (evoItemId) out[evoItemId] = true;
	}
	cachedEvolutionItemIds = out;
	return out;
}

function getSyntheticMegaStoneName(species, speciesName, formeId) {
	var baseName = String(species && species.baseSpecies || speciesName.replace(/-Mega(?:-[A-Za-z0-9]+)?$/, '') || speciesName);
	if (!baseName) return '';
	if (formeId === 'megaz' || /-Mega-Z$/i.test(speciesName)) return baseName + 'ite (Z-A)';
	if (formeId === 'megax') return baseName + 'ite X';
	if (formeId === 'megay') return baseName + 'ite Y';
	return baseName + 'ite';
}

function getKnownMegaStoneIdSet() {
	if (cachedKnownMegaStoneIds) return cachedKnownMegaStoneIds;
	var known = {};
	var items = window.BattleItems || {};
	for (var itemId in items) {
		var item = Dex.items.get(itemId);
		if (!item || !item.exists || !item.megaStone) continue;
		var canonicalId = toID(item.id || itemId);
		if (canonicalId) known[canonicalId] = true;
		var itemNameId = toID(item.name || '');
		if (itemNameId) known[itemNameId] = true;
	}

	var speciesDex = window.BattlePokedex || {};
	for (var speciesId in speciesDex) {
		var species = speciesDex[speciesId];
		var speciesName = String(species && species.name || speciesId);
		var forme = toID(species && species.forme || '');
		var isMegaForm = /mega/.test(forme) || /-Mega(?:-[A-Za-z0-9]+)?$/.test(speciesName);
		if (!isMegaForm) continue;
		var syntheticStoneName = getSyntheticMegaStoneName(species, speciesName, forme);
		var syntheticStoneId = toID(syntheticStoneName);
		if (syntheticStoneId) known[syntheticStoneId] = true;
	}

	cachedKnownMegaStoneIds = known;
	return known;
}

function getMoveTypeIdForMove(moveId) {
	var cleanMoveId = toID(moveId || '');
	if (!cleanMoveId) return '';
	var overriddenType = toID(ITEM_LOCATION_MOVE_TYPE_ICON_OVERRIDES[cleanMoveId] || '');
	if (overriddenType) return overriddenType;
	var move = Dex.moves.get(cleanMoveId);
	if (!move || !move.exists || !move.type) return '';
	var typeId = toID(move.type);
	return typeId || '';
}

function getItemLocationIconSlugFromName(name) {
	return String(name || '')
		.replace(/[^A-Za-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();
}

function getItemLocationIconUrlFromSlug(slug) {
	return Dex.resourcePrefix + 'sprites/itemicons/' + slug + '.png';
}

function getItemLocationSpriteIconMarkup(slugs, title, fallbackLabel) {
	if (!slugs || !slugs.length) return '';
	var uniqueSlugs = [];
	var seen = {};
	for (var i = 0; i < slugs.length; i++) {
		var slug = String(slugs[i] || '').toLowerCase()
			.replace(/[^a-z0-9_/-]+/g, '')
			.replace(/_/g, '-')
			.replace(/\/+/g, '/')
			.replace(/^\/+|\/+$/g, '');
		if (!slug || seen[slug]) continue;
		seen[slug] = true;
		uniqueSlugs.push(slug);
	}
	if (!uniqueSlugs.length) return '';
	var urls = [];
	for (var j = 0; j < uniqueSlugs.length; j++) {
		urls.push(getItemLocationIconUrlFromSlug(uniqueSlugs[j]));
	}
	var primary = urls[0];
	var fallbacks = urls.slice(1).join('|');
	var onError = "var l=(this.dataset.fallbacks||'').split('|');while(l.length&&!l[0])l.shift();if(l.length){this.src=l.shift();this.dataset.fallbacks=l.join('|');return;}this.onerror=null;var s=document.createElement('span');s.textContent=this.dataset.label||'';s.title=this.title||'';s.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;color:#d9e6ff;font-size:8px;line-height:1;font-weight:bold;';if(this.parentNode)this.parentNode.replaceChild(s,this);";
	return '<img src="' + Dex.escapeHTML(primary) + '" title="' + Dex.escapeHTML(title || '') + '" data-label="' + Dex.escapeHTML(fallbackLabel || '') + '" data-fallbacks="' + Dex.escapeHTML(fallbacks) + '" onerror="' + onError + '" style="display:block;width:24px;height:24px;image-rendering:pixelated;" />';
}

function getMoveTypeSpriteIconMarkup(moveId, labelPrefix, iconPrefix) {
	var cleanMoveId = toID(moveId || '');
	if (!cleanMoveId) return '';
	var move = Dex.moves.get(cleanMoveId);
	var typeId = getMoveTypeIdForMove(cleanMoveId);
	if (!move || !move.exists || !typeId) return '';
	var title = labelPrefix + move.name + ' (' + move.type + ')';
	var prefix = iconPrefix || 'tm';
	var iconSlugs = [prefix + '-' + typeId];
	if (typeId === 'fairy') iconSlugs.push(prefix + '-psychic');
	iconSlugs.push(prefix + '-normal');
	return getItemLocationSpriteIconMarkup(iconSlugs, title, String(prefix || 'TM').toUpperCase());
}

function getItemLocationFallbackIconLabel(entry, itemId) {
	var override = ITEM_LOCATION_FALLBACK_LABEL_OVERRIDES[itemId] || ITEM_LOCATION_FALLBACK_LABEL_OVERRIDES[toID(entry.itemConst || '')];
	if (override) return override;
	var itemName = String(entry.item || entry.itemConst || itemId || '');
	var cleaned = itemName.replace(/[^A-Za-z0-9]+/g, ' ').trim();
	if (!cleaned) return 'IT';
	var parts = cleaned.split(/\s+/);
	if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
	return cleaned.slice(0, 2).toUpperCase();
}

function getFallbackItemIconMarkup(entry, itemId) {
	var label = getItemLocationFallbackIconLabel(entry, itemId);
	return '<span title="No matching sprite icon" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid #4f6ea7;border-radius:3px;background:#0a1a43;color:#d9e6ff;font-size:8px;line-height:1;font-weight:bold;">' + Dex.escapeHTML(label) + '</span>';
}

function isMachineEntry(entry) {
	return /^(?:ITEM_TM_|ITEM_HM_)/.test(String(entry && entry.itemConst || ''));
}

function isMoveTutorEntry(entry) {
	return toID(entry && entry.kind || '') === 'movetutor' || !!toID(entry && entry.moveId || '');
}

function getMachineMoveIdFromEntry(entry) {
	var match = /^(?:ITEM_TM_|ITEM_HM_)([A-Z0-9_]+)$/.exec(String(entry && entry.itemConst || ''));
	if (!match) return '';
	return toID(match[1]);
}

function getMachineTypeIconMarkup(entry) {
	var itemConst = String(entry && entry.itemConst || '');
	var iconPrefix = /^ITEM_HM_/.test(itemConst) ? 'hm' : 'tm';
	return getMoveTypeSpriteIconMarkup(getMachineMoveIdFromEntry(entry), 'TM/HM ', iconPrefix);
}

function getMoveTutorTypeIconMarkup(entry) {
	return getMoveTypeSpriteIconMarkup(entry && entry.moveId || '', 'Move Tutor ', 'tm');
}

function getItemLocationOverrideIconSlugs(entry, itemId) {
	var override = ITEM_LOCATION_ICON_FILE_OVERRIDES[itemId] || ITEM_LOCATION_ICON_FILE_OVERRIDES[toID(entry.itemConst || '')];
	if (!override) return [];
	if (Array.isArray(override)) return override.slice();
	return [override];
}

function getItemLocationAutoIconSlugs(entry, itemId) {
	var slugs = [];
	var itemNameSlug = getItemLocationIconSlugFromName(entry.item || '');
	if (itemNameSlug) slugs.push(itemNameSlug);
	var itemConst = String(entry.itemConst || '');
	if (itemConst.indexOf('ITEM_') === 0) slugs.push(itemConst.slice(5).toLowerCase().replace(/_/g, '-'));
	if (itemId) slugs.push(itemId.toLowerCase());
	return slugs;
}

function getMappedItemIconMarkup(entry, itemId) {
	var slugs = getItemLocationOverrideIconSlugs(entry, itemId).concat(getItemLocationAutoIconSlugs(entry, itemId));
	if (!slugs.length) return '';
	return getItemLocationSpriteIconMarkup(
		slugs,
		String(entry.item || itemId || 'Item') + ' icon',
		getItemLocationFallbackIconLabel(entry, itemId)
	);
}

function getEntryDexItem(entry) {
	var itemId = getResolvedItemLocationEntryId(entry);
	if (!itemId) return null;
	return Dex.items.get(itemId);
}

function isHeartScaleEntry(entry) {
	var itemId = getItemLocationEntryId(entry);
	return itemId === 'heartscale' || toID(entry.itemConst || '') === 'itemheartscale';
}

function isRareCandyEntry(entry) {
	var itemId = getItemLocationEntryId(entry);
	return !!RARE_CANDY_IDS[itemId];
}

function isEvolutionItemEntry(entry) {
	var itemId = getItemLocationEntryId(entry);
	if (!itemId) return false;
	var evoItems = getEvolutionItemIdSet();
	return !!evoItems[itemId];
}

function isMegaStoneEntry(entry) {
	var dexItem = getEntryDexItem(entry);
	if (dexItem && dexItem.exists && dexItem.megaStone) return true;
	var itemId = getResolvedItemLocationEntryId(entry);
	if (!itemId) return false;
	var knownMegaStoneIds = getKnownMegaStoneIdSet();
	return !!knownMegaStoneIds[itemId];
}

function isPokeBallEntry(entry) {
	var dexItem = getEntryDexItem(entry);
	if (dexItem && dexItem.exists && dexItem.isPokeball) return true;
	return /_BALL(?:_|$)/.test(String(entry.itemConst || '')) || /ball$/i.test(String(entry.item || ''));
}

function isFossilEntry(entry) {
	return /FOSSIL/.test(String(entry.itemConst || '').toUpperCase()) || /fossil/i.test(String(entry.item || ''));
}

function isHeldItemEntry(entry) {
	if (isMoveTutorEntry(entry) || isMachineEntry(entry)) return false;
	if (isMegaStoneEntry(entry)) return false;
	if (isEvolutionItemEntry(entry)) return false;
	if (isPokeBallEntry(entry)) return false;
	if (isFossilEntry(entry)) return false;
	var dexItem = getEntryDexItem(entry);
	return !!(dexItem && dexItem.exists && !dexItem.megaStone);
}

function isDelibirdDeliveryEntry(entry) {
	var kindId = toID(entry && entry.kind || '');
	if (kindId === 'delibirddelivery' || kindId === 'delivery') return true;
	var requirementId = toID(entry && entry.requirement || '');
	return requirementId.indexOf('delibird') >= 0 && requirementId.indexOf('delivery') >= 0;
}

function isMartEntry(entry) {
	return toID(entry && entry.kind || '') === 'mart';
}

function entryMatchesItemLocationCategory(entry, category) {
	switch (category) {
	case 'all':
		return true;
	case 'marts':
		return isMartEntry(entry);
	case 'heartscales':
		return isHeartScaleEntry(entry);
	case 'rarecandies':
		return isRareCandyEntry(entry);
	case 'evolutionitems':
		return isEvolutionItemEntry(entry);
	case 'helditems':
		return isHeldItemEntry(entry);
	case 'machinesandtutors':
		return isMachineEntry(entry) || isMoveTutorEntry(entry);
	case 'delibirddelivery':
		return isDelibirdDeliveryEntry(entry);
	case 'megastones':
		return isMegaStoneEntry(entry);
	default:
		return true;
	}
}

function getItemLocationEntrySearchableText(entry) {
	var quantity = (entry.quantityText || entry.quantity || '').toString();
	var requirement = (entry.requirement || '').toString();
	var moveId = toID(entry.moveId || '');
	var move = moveId ? Dex.moves.get(moveId) : null;
	var moveType = move && move.exists ? (move.type || '') : '';
	var machineMoveId = isMachineEntry(entry) ? getMachineMoveIdFromEntry(entry) : '';
	var machineMove = machineMoveId ? Dex.moves.get(machineMoveId) : null;
	var machineMoveType = machineMove && machineMove.exists ? (machineMove.type || '') : '';
	var iconTypeOverride = moveId ? getMoveTypeIdForMove(moveId) : '';
	return [
		entry.item || entry.itemConst || '',
		quantity,
		entry.kind || '',
		requirement,
		moveId,
		moveType,
		machineMoveId,
		machineMoveType,
		iconTypeOverride
	].join(' ');
}

function entryMatchesItemLocationSearch(entry, queryId) {
	if (!queryId) return true;
	return toID(getItemLocationEntrySearchableText(entry)).indexOf(queryId) >= 0;
}

function buildQuickMenuTutorLocations() {
	var locations = [];
	for (var i = 0; i < QUICK_MENU_TUTOR_SOURCE.length; i++) {
		var source = QUICK_MENU_TUTOR_SOURCE[i];
		var items = [];
		for (var j = 0; j < source.moves.length; j++) {
			var moveId = toID(source.moves[j]);
			if (!moveId) continue;
			var move = Dex.moves.get(moveId);
			var moveName = move && move.exists ? move.name : source.moves[j].replace(/_/g, ' ');
			items.push({
				kind: 'Move Tutor',
				itemConst: 'MOVE_TUTOR_' + source.moves[j].toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
				item: moveName,
				itemId: moveId,
				moveId: moveId,
				requirement: source.requirement
			});
		}
		if (!items.length) continue;
		locations.push({
			id: source.locationId,
			name: source.locationName,
			baseArea: getItemOrderedLocationBaseId(source.locationId, source.locationName),
			items: items
		});
	}
	sortItemLocationsByPreferredOrder(locations);
	return locations;
}

function buildQuickMenuDelibirdDeliveryLocations() {
	var locations = [];
	for (var i = 0; i < QUICK_MENU_DELIBIRD_DELIVERY_SOURCE.length; i++) {
		var source = QUICK_MENU_DELIBIRD_DELIVERY_SOURCE[i];
		var byItemConst = {};
		for (var j = 0; j < source.items.length; j++) {
			var reward = source.items[j];
			var itemConst = reward.itemConst;
			if (!itemConst) continue;
			var key = toID(itemConst);
			if (!key) continue;
			var quantity = Number(reward.quantity || 0);
			if (!quantity || quantity < 0) quantity = 1;
			if (!byItemConst[key]) {
				var itemId = getItemLocationIdFromItemConst(itemConst);
				byItemConst[key] = {
					kind: 'Delivery',
					itemConst: itemConst,
					item: getItemLocationNameFromItemConst(itemConst),
					itemId: itemId,
					quantity: 0,
					requirement: ''
				};
			}
			byItemConst[key].quantity += quantity;
		}
		var items = [];
		for (var itemKey in byItemConst) {
			items.push(byItemConst[itemKey]);
		}
		if (!items.length) continue;
		sortItemLocationEntries(items);
		locations.push({
			id: 'quickmenudelibirddeliveryslot' + source.slot,
			name: 'Delibird Delivery Slot ' + source.slot,
			baseArea: 'quickmenudelibirddelivery',
			items: items
		});
	}
	return locations;
}

function buildLocationsFromEntryFilter(baseLocations, filterFn) {
	var locations = [];
	for (var i = 0; i < baseLocations.length; i++) {
		var base = baseLocations[i];
		var filteredItems = [];
		for (var j = 0; j < base.items.length; j++) {
			var entry = base.items[j];
			if (!filterFn(entry)) continue;
			filteredItems.push(entry);
		}
		if (!filteredItems.length) continue;
		sortItemLocationEntries(filteredItems);
		locations.push({
			id: base.id,
			name: base.name,
			baseArea: base.baseArea,
			items: filteredItems
		});
	}
	return locations;
}

function mergeItemLocationsWithTutors(baseLocations, tutorLocations) {
	var merged = [];
	var byId = {};
	for (var i = 0; i < baseLocations.length; i++) {
		var base = baseLocations[i];
		var clone = {
			id: base.id,
			name: base.name,
			baseArea: base.baseArea,
			items: base.items.slice()
		};
		merged.push(clone);
		byId[clone.id] = clone;
	}

	for (var j = 0; j < tutorLocations.length; j++) {
		var tutorLocation = tutorLocations[j];
		var existing = byId[tutorLocation.id];
		if (!existing) {
			var tutorClone = {
				id: tutorLocation.id,
				name: tutorLocation.name,
				baseArea: tutorLocation.baseArea,
				items: tutorLocation.items.slice()
			};
			sortItemLocationEntries(tutorClone.items);
			merged.push(tutorClone);
			byId[tutorClone.id] = tutorClone;
			continue;
		}
		var seen = {};
		for (var k = 0; k < existing.items.length; k++) {
			seen[getItemLocationEntryKey(existing.items[k])] = true;
		}
		for (var m = 0; m < tutorLocation.items.length; m++) {
			var tutorEntry = tutorLocation.items[m];
			var key = getItemLocationEntryKey(tutorEntry);
			if (seen[key]) continue;
			seen[key] = true;
			existing.items.push(tutorEntry);
		}
		sortItemLocationEntries(existing.items);
	}

	sortItemLocationsByPreferredOrder(merged);
	return merged;
}

function buildUnavailableMegaStoneEntries(baseLocations) {
	var availableIds = {};
	for (var i = 0; i < baseLocations.length; i++) {
		var location = baseLocations[i];
		for (var j = 0; j < location.items.length; j++) {
			var entry = location.items[j];
			if (!isMegaStoneEntry(entry)) continue;
			var availableId = getResolvedItemLocationEntryId(entry);
			if (availableId) availableIds[availableId] = true;
			var availableNameId = toID(entry && entry.item || '');
			if (availableNameId) availableIds[availableNameId] = true;
		}
	}

	var unavailable = [];
	var items = window.BattleItems || {};
	var itemIds = Object.keys(items).sort(function (a, b) {
		var aItem = Dex.items.get(a);
		var bItem = Dex.items.get(b);
		var aName = aItem && aItem.exists ? aItem.name : a;
		var bName = bItem && bItem.exists ? bItem.name : b;
		return aName < bName ? -1 : (aName > bName ? 1 : 0);
	});
	for (var idx = 0; idx < itemIds.length; idx++) {
		var itemId = itemIds[idx];
		var item = Dex.items.get(itemId);
		if (!item || !item.exists || !item.megaStone) continue;
		if (UNAVAILABLE_MEGA_STONE_DENYLIST[toID(item.id || itemId)]) continue;
		var canonicalId = toID(item.id || itemId);
		var nameId = toID(item.name || '');
		if (availableIds[canonicalId] || (nameId && availableIds[nameId])) continue;
		unavailable.push({
			kind: 'Unavailable',
			itemConst: 'ITEM_' + canonicalId.toUpperCase(),
			item: item.name,
			itemId: canonicalId,
			requirement: 'Not obtainable in item locations'
		});
	}

	var speciesDex = window.BattlePokedex || {};
	var seenUnavailableIds = {};
	var seenUnavailableNames = {};
	for (var s = 0; s < unavailable.length; s++) {
		seenUnavailableIds[toID(unavailable[s].itemId || '')] = true;
		seenUnavailableNames[toID(unavailable[s].item || '')] = true;
	}
	var megaStoneItemByForm = {};
	for (var n = 0; n < itemIds.length; n++) {
		var knownItem = Dex.items.get(itemIds[n]);
		if (!knownItem || !knownItem.exists || !knownItem.megaStone) continue;
		var megaFormId = toID(knownItem.megaStone || '');
		if (!megaFormId) continue;
		megaStoneItemByForm[megaFormId] = {
			id: knownItem.id,
			name: knownItem.name
		};
	}
	for (var speciesId in speciesDex) {
		var species = speciesDex[speciesId];
		var speciesName = String(species && species.name || '');
		var forme = toID(species && species.forme || '');
		var isMegaForm = /mega/.test(forme) || /-Mega(?:-[A-Za-z0-9]+)?$/.test(speciesName);
		if (!isMegaForm) continue;
		var speciesFormId = toID(speciesName || speciesId);
		var knownStone = megaStoneItemByForm[speciesFormId];
		if (knownStone) {
			var knownStoneId = toID(knownStone.id || '');
			var knownStoneNameId = toID(knownStone.name || '');
			if (UNAVAILABLE_MEGA_STONE_DENYLIST[knownStoneId]) continue;
			if (!availableIds[knownStoneId] && !seenUnavailableIds[knownStoneId] && !seenUnavailableNames[knownStoneNameId]) {
				unavailable.push({
					kind: 'Unavailable',
					itemConst: 'ITEM_' + knownStoneId.toUpperCase(),
					item: knownStone.name,
					itemId: knownStoneId,
					requirement: 'Not obtainable in item locations'
				});
				seenUnavailableIds[knownStoneId] = true;
				seenUnavailableNames[knownStoneNameId] = true;
			}
			continue;
		}

		var syntheticStoneName = getSyntheticMegaStoneName(species, speciesName, forme);
		if (!syntheticStoneName) continue;
		var syntheticId = toID(syntheticStoneName);
		if (UNAVAILABLE_MEGA_STONE_DENYLIST[syntheticId]) continue;
		var syntheticNameId = toID(syntheticStoneName);
		if (!syntheticId || availableIds[syntheticId] || seenUnavailableIds[syntheticId] || seenUnavailableNames[syntheticNameId]) continue;
		unavailable.push({
			kind: 'Unavailable',
			itemConst: 'ITEM_SYNTH_MEGA_' + syntheticId.toUpperCase(),
			item: syntheticStoneName,
			itemId: syntheticId,
			requirement: 'Not obtainable in item locations'
		});
		seenUnavailableIds[syntheticId] = true;
		seenUnavailableNames[syntheticNameId] = true;
	}

	sortItemLocationEntries(unavailable);
	return unavailable;
}

function getItemLocationIconMarkup(entry, itemId, dexItem) {
	var tutorTypeIcon = getMoveTutorTypeIconMarkup(entry);
	if (tutorTypeIcon) return tutorTypeIcon;
	var machineTypeIcon = getMachineTypeIconMarkup(entry);
	if (machineTypeIcon) return machineTypeIcon;
	var spriteNum = dexItem && dexItem.exists ? Number(dexItem.spritenum || 0) : 0;
	var hasOverride = getItemLocationOverrideIconSlugs(entry, itemId).length > 0;
	if (hasOverride || !dexItem || !dexItem.exists || !spriteNum || spriteNum <= 0) {
		var mapped = getMappedItemIconMarkup(entry, itemId);
		if (mapped) return mapped;
	}
	if (!dexItem || !dexItem.exists) return getFallbackItemIconMarkup(entry, itemId);
	if (!spriteNum || spriteNum <= 0) return getFallbackItemIconMarkup(entry, itemId);
	var iconStyle = Dex.getItemIcon(dexItem);
	return '<span style="' + iconStyle + '"></span>';
}

var PokedexItemLocationsPanel = Panels.Panel.extend({
	minWidth: 639,
	maxWidth: 639,
	sidebarWidth: 280,
	mainTabRoute: 'itemlocations/',
	defaultCategory: 'all',
	showCategoryFilters: true,
	searchPlaceholder: 'Filter by location, item, move, or requirement',
	emptyStateMessage: 'No matching item locations.',
	events: {
		'click .tabbar button': 'clickTab',
		'keyup input.searchbox': 'updateFilter',
		'change input.searchbox': 'updateFilter',
		'search input.searchbox': 'updateFilter',
		'click .itemlocationfilterbar button': 'clickCategoryFilter',
		'submit': 'submit'
	},
	initialize: function () {
		this.activeCategory = this.defaultCategory || 'all';
		this.itemLocationNoteRules = getItemLocationNoteRules();
		this.locations = this.buildLocations();
		this.tutorLocations = buildLocationsFromEntryFilter(this.locations, function (entry) {
			return isMoveTutorEntry(entry);
		});
		if (!this.tutorLocations.length) this.tutorLocations = buildQuickMenuTutorLocations();
		this.locationsWithTutors = mergeItemLocationsWithTutors(this.locations, this.tutorLocations);
		this.delibirdDeliveryLocations = buildLocationsFromEntryFilter(this.locations, function (entry) {
			return isDelibirdDeliveryEntry(entry);
		});
		if (!this.delibirdDeliveryLocations.length) this.delibirdDeliveryLocations = buildQuickMenuDelibirdDeliveryLocations();
		this.locationsWithDelibirdDeliveries = mergeItemLocationsWithTutors(this.locations, this.delibirdDeliveryLocations);
		this.unavailableMegaStoneEntries = buildUnavailableMegaStoneEntries(this.locationsWithDelibirdDeliveries);
		this.categoryFilters = buildItemLocationCategoryFilters(
			this.locationsWithTutors,
			this.delibirdDeliveryLocations,
			this.unavailableMegaStoneEntries
		);
		if (this.showCategoryFilters && !isItemLocationCategoryAvailable(this.categoryFilters, this.activeCategory)) this.activeCategory = 'all';

		var buf = '<div class="pfx-body"><form class="pokedex">';
		buf += '<h1><a href="/" data-target="replace">Ooushii Pok&eacute;dex</a></h1>';
		buf += '<h4>Modified from <a href="https://dex.pokemonshowdown.com/">Pok&eacute;mon Showdown Dex</a> for Porydex</h4>';
		buf += renderPokedexMainTabBar(this.mainTabRoute || 'itemlocations/');
		buf += '<div class="searchboxwrapper"><input class="textbox searchbox" type="search" name="q" value="" autocomplete="off" autofocus placeholder="' + Dex.escapeHTML(this.searchPlaceholder || 'Filter by location, item, move, or requirement') + '" /></div>';
		if (this.showCategoryFilters) {
			buf += '<div class="searchboxwrapper" style="margin-top: 6px;">';
			buf += '<label style="margin-right: 8px; font-size: 9pt;">Category:</label>';
			buf += renderItemLocationCategoryFilterButtons(this.activeCategory, this.categoryFilters);
			buf += '</div>';
		}
		buf += '</form><div class="results"></div></div>';
		this.$el.html(buf);

		this.renderList('');
	},
	submit: function (e) {
		e.preventDefault();
	},
	clickTab: function (e) {
		e.preventDefault();
		e.stopPropagation();
		this.app.go(e.currentTarget.value, this, true);
	},
	clickCategoryFilter: function (e) {
		e.preventDefault();
		var category = e.currentTarget && e.currentTarget.value ? e.currentTarget.value : 'all';
		if (!isItemLocationCategoryAvailable(this.categoryFilters, category)) category = 'all';
		if (this.activeCategory === category) return;
		this.activeCategory = category;
		this.$('.itemlocationfilterbar button').removeClass('cur');
		if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('cur');
		this.renderList(this.$('input.searchbox').val() || '');
	},
	updateFilter: function () {
		var query = this.$('input.searchbox').val() || '';
		this.renderList(query);
	},
	buildLocations: function () {
		var locations = [];
		var dex = window.BattleItemLocationdex || {};
		var noteRules = this.itemLocationNoteRules || [];
		for (var id in dex) {
			var location = dex[id];
			if (!location || !location.items || !location.items.length) continue;
			var filteredItems = [];
			for (var j = 0; j < location.items.length; j++) {
				var entry = location.items[j];
				if (isIgnoredItemLocationEntry(entry)) continue;
				filteredItems.push(applyItemLocationNotesToEntry(entry, noteRules, id, location.name || id));
			}
			if (!filteredItems.length) continue;
			locations.push({
				id: id,
				name: location.name || id,
				baseArea: getItemOrderedLocationBaseId(id, location.name || id),
				items: filteredItems
			});
		}
		sortItemLocationsByPreferredOrder(locations);
		return locations;
	},
	renderMachinesAndTutorsColumns: function (queryId, sourceLocations) {
		var tutorBuf = '<ul class="utilichart"><li class="resultheader"><h3>Quick Menu Tutors</h3></li>';
		var machineBuf = '<ul class="utilichart"><li class="resultheader"><h3>TM/HM Locations</h3></li>';
		var shownTutors = 0;
		var shownMachines = 0;

		for (var i = 0; i < sourceLocations.length; i++) {
			var location = sourceLocations[i];
			var locationNameMatches = !queryId || toID(location.name).indexOf(queryId) >= 0;
			var tutorRows = '';
			var machineRows = '';

			for (var j = 0; j < location.items.length; j++) {
				var entry = location.items[j];
				var isTutor = isMoveTutorEntry(entry);
				var isMachine = isMachineEntry(entry);
				if (!isTutor && !isMachine) continue;
				if (!locationNameMatches && !entryMatchesItemLocationSearch(entry, queryId)) continue;
				if (isTutor) tutorRows += this.renderItemRow(entry);
				else if (isMachine) machineRows += this.renderItemRow(entry);
			}

			if (tutorRows) {
				shownTutors++;
				tutorBuf += '<li class="resultheader"><h3>' + Dex.escapeHTML(location.name) + '</h3></li>';
				tutorBuf += tutorRows;
			}
			if (machineRows) {
				shownMachines++;
				machineBuf += '<li class="resultheader"><h3>' + Dex.escapeHTML(location.name) + '</h3></li>';
				machineBuf += machineRows;
			}
		}

		if (!shownTutors) {
			tutorBuf += '<li class="result"><div class="notfound"><em>No matching quick menu tutors.</em></div></li>';
		}
		if (!shownMachines) {
			machineBuf += '<li class="result"><div class="notfound"><em>No matching TM/HM locations.</em></div></li>';
		}

		tutorBuf += '</ul>';
		machineBuf += '</ul>';
		var buf = '<div class="itemlocationtwocols" style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">';
		buf += '<div class="itemlocationcol-left" style="flex:1 1 300px;min-width:280px;">' + tutorBuf + '</div>';
		buf += '<div class="itemlocationcol-right" style="flex:1 1 300px;min-width:280px;">' + machineBuf + '</div>';
		buf += '</div>';
		this.$('.results').html(buf);
	},
	renderList: function (query) {
		var q = toID(query || '');
		var category = this.activeCategory || 'all';
		var sourceLocations = this.locations;
		if (category === 'machinesandtutors') sourceLocations = this.locationsWithTutors;
		if (category === 'delibirddelivery') sourceLocations = this.delibirdDeliveryLocations;
		if (category === 'megastones') sourceLocations = this.locationsWithDelibirdDeliveries;
		if (category === 'machinesandtutors') {
			this.renderMachinesAndTutorsColumns(q, sourceLocations);
			return;
		}
		var buf = '<ul class="utilichart">';
		var shownLocations = 0;

		for (var i = 0; i < sourceLocations.length; i++) {
			var location = sourceLocations[i];
			var locationNameMatches = !q || toID(location.name).indexOf(q) >= 0;
			var rows = '';

			for (var j = 0; j < location.items.length; j++) {
				var entry = location.items[j];
				if (!entryMatchesItemLocationCategory(entry, category)) continue;
				if (!locationNameMatches && !entryMatchesItemLocationSearch(entry, q)) continue;
				rows += this.renderItemRow(entry);
			}

			if (!rows) continue;
			shownLocations++;
			buf += '<li class="resultheader"><h3>' + Dex.escapeHTML(location.name) + '</h3></li>';
			buf += rows;
		}

		if (category === 'megastones' && this.unavailableMegaStoneEntries.length) {
			var unavailableRows = '';
			var unavailableLocationName = 'Unavailable Mega Stones';
			var unavailableNameMatches = !q || toID(unavailableLocationName).indexOf(q) >= 0;
			for (var k = 0; k < this.unavailableMegaStoneEntries.length; k++) {
				var unavailableEntry = this.unavailableMegaStoneEntries[k];
				var searchableUnavailable = (unavailableEntry.item || '') + ' ' + (unavailableEntry.kind || '') + ' ' + (unavailableEntry.requirement || '');
				var unavailableMatch = !q || toID(searchableUnavailable).indexOf(q) >= 0;
				if (!unavailableNameMatches && !unavailableMatch) continue;
				unavailableRows += this.renderItemRow(unavailableEntry);
			}
			if (unavailableRows) {
				shownLocations++;
				buf += '<li class="resultheader"><h3>' + Dex.escapeHTML(unavailableLocationName) + '</h3></li>';
				buf += unavailableRows;
			}
		}

		if (!shownLocations) {
			buf += '<li class="result"><div class="notfound"><em>' + Dex.escapeHTML(this.emptyStateMessage || 'No matching item locations.') + '</em></div></li>';
		}

		buf += '</ul>';
		this.$('.results').html(buf);
	},
	renderItemRow: function (entry) {
		var kind = entry.kind || 'Field';
		var moveId = toID(entry.moveId || '');
		var machineMoveId = isMachineEntry(entry) ? getMachineMoveIdFromEntry(entry) : '';
		var linkedMoveId = moveId || machineMoveId;
		var linkedMove = linkedMoveId ? Dex.moves.get(linkedMoveId) : null;
		var isMoveTutor = !!(moveId && linkedMove && linkedMove.exists);
		var itemName = isMoveTutor ? linkedMove.name : (entry.item || entry.itemConst || 'Unknown Item');
		var itemId = isMoveTutor ? linkedMove.id : getResolvedItemLocationEntryId(entry);
		if (!itemId) itemId = toID(itemName);
		var quantity = (entry.quantityText || entry.quantity || '').toString();
		var requirement = (entry.requirement || '').toString();
		var hasQuantity = !!quantity;
		var hasRequirement = !!requirement;

		var dexItem = isMoveTutor ? null : Dex.items.get(itemId);
		if (dexItem && dexItem.exists) itemId = toID(dexItem.id || itemId);
		var hasItemPage = !!(dexItem && dexItem.exists);
		var attrs = '';
		if (linkedMove && linkedMove.exists) attrs = ' href="/moves/' + linkedMoveId + '" data-target="push"';
		else if (hasItemPage) attrs = ' href="/items/' + itemId + '" data-target="push"';
		var icon = getItemLocationIconMarkup(entry, itemId, dexItem);
		var quantitySuffix = hasQuantity ? (' x' + quantity) : '';
		var requirementSuffix = hasRequirement ? (' [' + requirement + ']') : '';

		var buf = '<li class="result"><a' + attrs + ' class="itemlocationrow">';
		buf += '<span class="col tagcol shorttagcol itemlocationtagcol">' + Dex.escapeHTML(kind) + '</span> ';
		buf += '<span class="col itemiconcol">' + icon + '</span> ';
		buf += '<span class="col namecol itemlocationnamecol">' + Dex.escapeHTML(itemName + quantitySuffix + requirementSuffix) + '</span> ';
		buf += '</a></li>';
		return buf;
	}
});
