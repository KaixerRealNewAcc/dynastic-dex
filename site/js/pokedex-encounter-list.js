var ENCOUNTER_SPECIAL_SELECTIONS = {
	missed: 'Missed',
	delaying: 'Delaying'
};

function isEncounterSpecialSelection(selectionId) {
	return !!ENCOUNTER_SPECIAL_SELECTIONS[toID(selectionId || '')];
}

function getEncounterSpecialSelectionLabel(selectionId) {
	return ENCOUNTER_SPECIAL_SELECTIONS[toID(selectionId || '')] || '';
}

function getEncounterSharedMetLocationNameBase(locationName) {
	var name = String(locationName || '').trim();
	if (!name) return '';
	var patterns = [
		/^(.*?)(?:\s+Rooms?\s+(?:B\s*\d+F(?:\s+\d+R)?|\d+F(?:\s+\d+R)?))$/i,
		/^(.*?)(?:\s+(?:B\s*\d+F(?:\s+\d+R)?|\d+F(?:\s+\d+R)?))$/i,
		/^(.*?)(?:\s+Room\s+\d+)$/i,
		/^(.*?)(?:\s+Stevens\s+(?:Room|Cave))$/i,
		/^(.*?)(?:\s+(?:Entrance|Exterior|Summit|Inside))$/i,
		/^(.*?)(?:\s+Hidden\s+Floor\s+Corridors)$/i,
		/^(.*?)(?:\s+(?:Low|High)\s+Tide\s+.+)$/i,
		/^(.*?)(?:\s+Unused\s+Ruby\s+Sapphire\s+Map\s+\d+)$/i
	];
	for (var i = 0; i < patterns.length; i++) {
		var match = name.match(patterns[i]);
		if (match && match[1]) return match[1].trim();
	}
	return '';
}

function getEncounterSharedMetLocationGroupId(locationId, locationName) {
	var sharedNameBase = getEncounterSharedMetLocationNameBase(locationName);
	if (sharedNameBase) return toID(sharedNameBase);
	return getEncounterOrderedLocationBaseId(locationId, locationName);
}

var PokedexEncounterDupeStore = window.PokedexEncounterDupeStore || (function () {
	var STORAGE_KEY = 'porydex-encounter-selections';
	var state = {selections: {}};

	function toSelectionId(value) {
		return toID(value || '');
	}
	function cloneSelections() {
		var copy = {};
		for (var locationId in state.selections) {
			if (!state.selections.hasOwnProperty(locationId)) continue;
			copy[locationId] = state.selections[locationId];
		}
		return copy;
	}
	function normalizeSelectionsMap(source) {
		var normalized = {};
		if (!source || typeof source !== 'object') return normalized;
		for (var locationId in source) {
			if (!source.hasOwnProperty(locationId)) continue;
			var cleanLocationId = toSelectionId(locationId);
			var cleanSpeciesId = toSelectionId(source[locationId]);
			if (!cleanLocationId || !cleanSpeciesId) continue;
			normalized[cleanLocationId] = cleanSpeciesId;
		}
		return normalized;
	}
	function areSelectionsEqual(a, b) {
		var aCount = 0;
		var bCount = 0;
		for (var aKey in a) {
			if (!a.hasOwnProperty(aKey)) continue;
			aCount++;
			if (b[aKey] !== a[aKey]) return false;
		}
		for (var bKey in b) {
			if (b.hasOwnProperty(bKey)) bCount++;
		}
		return aCount === bCount;
	}
	function load() {
		state.selections = {};
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			var parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return;
			state.selections = normalizeSelectionsMap(parsed);
		} catch (err) {}
	}
	function save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selections));
		} catch (err) {}
	}
	function getDexSpecies(speciesId) {
		var dex = window.BattlePokedex || {};
		var cleanSpeciesId = toSelectionId(speciesId);
		if (!cleanSpeciesId) return null;
		return dex[cleanSpeciesId] || null;
	}
	function addEvolutionLineToDupeSet(dupes, speciesId) {
		var queue = [toSelectionId(speciesId)];
		var visited = {};
		while (queue.length) {
			var currentId = toSelectionId(queue.pop());
			if (!currentId || visited[currentId]) continue;
			visited[currentId] = true;
			dupes[currentId] = true;

			var species = getDexSpecies(currentId);
			if (!species) continue;
			var prevoId = toSelectionId(species.prevo || '');
			if (prevoId && !visited[prevoId]) queue.push(prevoId);
			var evos = species.evos || [];
			for (var i = 0; i < evos.length; i++) {
				var evoId = toSelectionId(evos[i]);
				if (evoId && !visited[evoId]) queue.push(evoId);
			}
		}
	}
	function getDupeSet() {
		var dupes = {};
		for (var locationId in state.selections) {
			if (!state.selections.hasOwnProperty(locationId)) continue;
			var speciesId = toSelectionId(state.selections[locationId]);
			if (!speciesId || isEncounterSpecialSelection(speciesId)) continue;
			addEvolutionLineToDupeSet(dupes, speciesId);
		}
		return dupes;
	}

	load();

	return {
		getSelections: function () {
			return cloneSelections();
		},
		setSelections: function (selections) {
			var normalized = normalizeSelectionsMap(selections);
			if (areSelectionsEqual(state.selections, normalized)) return;
			state.selections = normalized;
			save();
			$(document).trigger('encounterlist:dupes-updated');
		},
		setSelection: function (locationId, speciesId) {
			var cleanLocationId = toSelectionId(locationId);
			var cleanSpeciesId = toSelectionId(speciesId);
			if (!cleanLocationId) return;
			if (cleanSpeciesId) {
				state.selections[cleanLocationId] = cleanSpeciesId;
			} else {
				delete state.selections[cleanLocationId];
			}
			save();
			$(document).trigger('encounterlist:dupes-updated');
		},
		clear: function () {
			state.selections = {};
			save();
			$(document).trigger('encounterlist:dupes-updated');
		},
		getDupeSet: function () {
			return getDupeSet();
		},
		isDupe: function (speciesId) {
			var cleanSpeciesId = toSelectionId(speciesId);
			if (!cleanSpeciesId) return false;
			return !!getDupeSet()[cleanSpeciesId];
		},
		getDupeCount: function () {
			var count = 0;
			var dupes = getDupeSet();
			for (var speciesId in dupes) {
				if (dupes.hasOwnProperty(speciesId)) count++;
			}
			return count;
		}
	};
})();

var PokedexEncounterAbilityBoostStore = window.PokedexEncounterAbilityBoostStore || (function () {
	var STORAGE_KEY = 'porydex-encounter-ability-boosts';
	var state = {
		staticBoost: false,
		harvestBoost: false,
		magnetPullBoost: false
	};

	function toBool(value) {
		return !!value;
	}
	function load() {
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			var parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return;
			state.staticBoost = toBool(parsed.staticBoost);
			state.harvestBoost = toBool(parsed.harvestBoost);
			state.magnetPullBoost = toBool(parsed.magnetPullBoost);
		} catch (err) {}
	}
	function save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch (err) {}
	}
	function emitChange() {
		$(document).trigger('encounterlist:abilityboost-updated');
	}

	load();

	return {
		getState: function () {
			return {
				staticBoost: toBool(state.staticBoost),
				harvestBoost: toBool(state.harvestBoost),
				magnetPullBoost: toBool(state.magnetPullBoost)
			};
		},
		isStaticBoost: function () {
			return !!state.staticBoost;
		},
		isHarvestBoost: function () {
			return !!state.harvestBoost;
		},
		isMagnetPullBoost: function () {
			return !!state.magnetPullBoost;
		},
		setStaticBoost: function (enabled) {
			state.staticBoost = toBool(enabled);
			save();
			emitChange();
		},
		setHarvestBoost: function (enabled) {
			state.harvestBoost = toBool(enabled);
			save();
			emitChange();
		},
		setMagnetPullBoost: function (enabled) {
			state.magnetPullBoost = toBool(enabled);
			save();
			emitChange();
		}
	};
})();

var ENCOUNTER_LOCATION_ORDER = [
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
	'underwaterroute128'
];

var ENCOUNTER_LOCATION_ORDER_INDEX = (function () {
	var index = {};
	for (var i = 0; i < ENCOUNTER_LOCATION_ORDER.length; i++) {
		index[ENCOUNTER_LOCATION_ORDER[i]] = i;
	}
	return index;
})();

function normalizeEncounterLocationOrderKey(key) {
	var normalized = toID(key || '');
	if (normalized.indexOf('alteringcave') === 0) {
		return normalized.replace(/^alteringcave/, 'starfallcave');
	}
	if (normalized.indexOf('evergrandecity') === 0) return 'evergrandecity';
	if (normalized.indexOf('scorchedslabs') === 0) return 'scorchedslab';
	return normalized;
}

function getEncounterOrderedLocationBaseId(locationId, locationName) {
	var normalized = normalizeEncounterLocationOrderKey(locationId || locationName || '');
	if (/^route\d+$/.test(normalized) || /^underwaterroute\d+$/.test(normalized)) {
		return normalized;
	}
	for (var i = 0; i < ENCOUNTER_LOCATION_ORDER.length; i++) {
		var key = ENCOUNTER_LOCATION_ORDER[i];
		if (normalized === key || normalized.indexOf(key) === 0) return key;
	}
	return normalized;
}

function sortEncounterLocationsByPreferredOrder(locations) {
	locations.sort(function (a, b) {
		var aBase = getEncounterOrderedLocationBaseId(a.id, a.name);
		var bBase = getEncounterOrderedLocationBaseId(b.id, b.name);
		var aRank = ENCOUNTER_LOCATION_ORDER_INDEX.hasOwnProperty(aBase) ? ENCOUNTER_LOCATION_ORDER_INDEX[aBase] : 9999;
		var bRank = ENCOUNTER_LOCATION_ORDER_INDEX.hasOwnProperty(bBase) ? ENCOUNTER_LOCATION_ORDER_INDEX[bBase] : 9999;
		if (aRank !== bRank) return aRank - bRank;
		if (aBase !== bBase) return aBase < bBase ? -1 : 1;
		if (a.name !== b.name) return a.name < b.name ? -1 : 1;
		return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
	});
}

var PokedexEncounterListPanel = Panels.Panel.extend({
	minWidth: 639,
	maxWidth: 639,
	events: {
		'click .encounterlist-row': 'clickRow',
		'click .encounterlist-route-link': 'clickRoute',
		'input input.encounterlist-search': 'updateFilter',
		'keyup input.encounterlist-search': 'updateFilter',
		'change input.encounterlist-search': 'updateFilter',
		'search input.encounterlist-search': 'updateFilter',
		'change .encounterlist-catch': 'changeSelection',
		'change input[name=encounter-static-boost]': 'changeStaticBoost',
		'change input[name=encounter-harvest-boost]': 'changeHarvestBoost',
		'change input[name=encounter-magnet-pull-boost]': 'changeMagnetPullBoost',
		'click button[name=reset-encounterlist]': 'resetSelections'
	},
	initialize: function () {
		this.locationFilter = '';
		this.syncStatus = null;
		this.locations = this.buildLocations();
		this.locationsById = {};
		this.locationsByMetGroupId = {};
		for (var i = 0; i < this.locations.length; i++) {
			var location = this.locations[i];
			this.locationsById[location.id] = location;
			var metGroupId = location.metGroupId || location.id;
			if (!this.locationsByMetGroupId[metGroupId]) this.locationsByMetGroupId[metGroupId] = [];
			this.locationsByMetGroupId[metGroupId].push(location.id);
		}
		this.activeLocationId = this.locations.length ? this.locations[0].id : '';
		this.handleDupeUpdate = this.handleDupeUpdate.bind(this);
		this.handleAbilityBoostUpdate = this.handleAbilityBoostUpdate.bind(this);
		$(document).on('encounterlist:dupes-updated.' + this.cid, this.handleDupeUpdate);
		$(document).on('encounterlist:abilityboost-updated.' + this.cid, this.handleAbilityBoostUpdate);
		this.render();
	},
	remove: function () {
		$(document).off('encounterlist:dupes-updated.' + this.cid);
		$(document).off('encounterlist:abilityboost-updated.' + this.cid);
		Panels.Panel.prototype.remove.apply(this, arguments);
	},
	buildLocations: function () {
		var locations = [];
		var dex = window.BattleLocationdex || {};
		for (var id in dex) {
			if (!dex.hasOwnProperty(id) || id === 'rates') continue;
			var locationData = dex[id];
			if (!locationData || !locationData.name) continue;
			var speciesByMode = this.getLocationSpeciesByMode(locationData);
			var speciesIds = this.getLocationSpeciesFromModeMap(speciesByMode);
			if (!speciesIds.length) continue;
			locations.push({
				id: toID(id),
				name: locationData.name,
				speciesIds: speciesIds,
				speciesByMode: speciesByMode,
				modeLabels: locationData.encounterModeLabels || {},
				speciesSearchIndex: this.buildSpeciesSearchIndex(speciesIds),
				searchText: this.buildLocationSearchText(locationData.name, speciesIds),
				metGroupId: getEncounterSharedMetLocationGroupId(id, locationData.name)
			});
		}
		sortEncounterLocationsByPreferredOrder(locations);
		return locations;
	},
	normalizeSelectionsForSharedMetLocations: function (selections) {
		var source = selections || {};
		var normalized = {};
		var selectedByGroup = {};
		for (var i = 0; i < this.locations.length; i++) {
			var location = this.locations[i];
			if (!location) continue;
			var locationId = toID(location.id);
			if (!locationId) continue;
			var selectionId = toID(source[locationId] || '');
			if (!selectionId) continue;
			var isSpecialSelection = isEncounterSpecialSelection(selectionId);
			if (!isSpecialSelection && location.speciesIds.indexOf(selectionId) < 0) continue;
			var metGroupId = location.metGroupId || locationId;
			if (selectedByGroup[metGroupId]) continue;
			selectedByGroup[metGroupId] = locationId;
			normalized[locationId] = selectionId;
		}
		return normalized;
	},
	ensureSelectionsNormalized: function () {
		var selections = PokedexEncounterDupeStore.getSelections();
		var normalized = this.normalizeSelectionsForSharedMetLocations(selections);
		var changed = false;
		var seen = {};
		for (var locationId in selections) {
			if (!selections.hasOwnProperty(locationId)) continue;
			var cleanLocationId = toID(locationId);
			var cleanSelectionId = toID(selections[locationId]);
			if (!cleanLocationId || !cleanSelectionId) {
				changed = true;
				continue;
			}
			seen[cleanLocationId] = true;
			if (normalized[cleanLocationId] !== cleanSelectionId) {
				changed = true;
			}
		}
		for (var normalizedLocationId in normalized) {
			if (!normalized.hasOwnProperty(normalizedLocationId)) continue;
			if (!seen[normalizedLocationId]) {
				changed = true;
				break;
			}
		}
		if (changed) {
			PokedexEncounterDupeStore.setSelections(normalized);
			return null;
		}
		return normalized;
	},
	getLocationSpeciesByMode: function (locationData) {
		var speciesByMode = {
			land: [],
			surf: [],
			rock: [],
			fish: []
		};
		var seenByMode = {
			land: {},
			surf: {},
			rock: {},
			fish: {}
		};
		var modes = ['land', 'surf', 'rock', 'fish'];
		for (var i = 0; i < modes.length; i++) {
			var mode = modes[i];
			var modeData = locationData[mode];
			if (!modeData || !modeData.encs || !modeData.encs.length) continue;
			for (var j = 0; j < modeData.encs.length; j++) {
				var enc = modeData.encs[j];
				var speciesId = toID(enc && enc.species);
				if (!speciesId || seenByMode[mode][speciesId]) continue;
				seenByMode[mode][speciesId] = true;
				speciesByMode[mode].push(speciesId);
			}
		}
		return speciesByMode;
	},
	getLocationSpeciesFromModeMap: function (speciesByMode) {
		var speciesIds = [];
		var seen = {};
		var modes = ['land', 'surf', 'rock', 'fish'];
		for (var i = 0; i < modes.length; i++) {
			var mode = modes[i];
			var modeSpecies = (speciesByMode && speciesByMode[mode]) ? speciesByMode[mode] : [];
			for (var j = 0; j < modeSpecies.length; j++) {
				var speciesId = toID(modeSpecies[j]);
				if (!speciesId || seen[speciesId]) continue;
				seen[speciesId] = true;
				speciesIds.push(speciesId);
			}
		}
		return speciesIds;
	},
	getSpeciesName: function (speciesId) {
		var pokemon = BattlePokedex[speciesId];
		return pokemon && pokemon.name ? pokemon.name : speciesId;
	},
	buildSpeciesSearchIndex: function (speciesIds) {
		var index = {};
		for (var i = 0; i < speciesIds.length; i++) {
			var speciesId = speciesIds[i];
			index[speciesId] = toID(speciesId + ' ' + this.getSpeciesName(speciesId));
		}
		return index;
	},
	buildLocationSearchText: function (locationName, speciesIds) {
		var tokens = [locationName || ''];
		for (var i = 0; i < speciesIds.length; i++) {
			var speciesId = speciesIds[i];
			tokens.push(speciesId);
			tokens.push(this.getSpeciesName(speciesId));
		}
		return toID(tokens.join(' '));
	},
	render: function () {
		var selections = PokedexEncounterDupeStore.getSelections();
		var buf = '<div class="pfx-body dexentry encounterlist-panel">';
		buf += '<a href="/" class="pfx-backbutton button" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1>Encounter List</h1>';
		buf += '<p class="encounterlist-controls"><button class="button" name="reset-encounterlist">Reset</button> ';
		buf += '<button class="button" name="import-ae-lua-encounterlist">' + Dex.escapeHTML(this.getAeLuaImportButtonLabel()) + '</button> ';
		buf += '<span class="encounterlist-dupe-count">Dupes: 0</span>';
		buf += '</p>';
		buf += '<div class="searchboxwrapper encounterlist-search-wrap"><input class="textbox searchbox encounterlist-search" type="search" name="encounterlist-q" value="' + Dex.escapeHTML(this.locationFilter || '') + '" autocomplete="off" placeholder="Filter by location or species" aria-label="Filter encounter list" /></div>';
		buf += this.renderAbilityBoostControls();
		buf += '<p class="encounterlist-note">Note: Verdanturf Town is a guaranteed double encounter.</p>';
		buf += '<p class="encounterlist-note">Note: Dewford Town is a guaranteed double encounter.</p>';
		buf += '<p class="encounterlist-note">Note: Starfall Cave is a guaranteed double encounter.</p>';
		buf += '<p class="encounterlist-note">Note: Fiery Path is a guaranteed double encounter.</p>';
		buf += '<ul class="encounterlist-rows">';
		for (var i = 0; i < this.locations.length; i++) {
			buf += this.renderLocationRow(this.locations[i], selections);
		}
		buf += '</ul>';
		buf += '<p class="encounterlist-empty">No encounter locations match your filter.</p>';
		buf += '</div>';
		this.html(buf);
		this.refreshState();
	},
	renderLocationRow: function (location, selections) {
		var selectedSelection = toID(selections[location.id] || '');
		if (selectedSelection && !isEncounterSpecialSelection(selectedSelection) && location.speciesIds.indexOf(selectedSelection) < 0) selectedSelection = '';
		var linkClass = 'encounterlist-route-link';
		if (this.activeLocationId === location.id) linkClass += ' encounterlist-route-active';

		var buf = '<li class="encounterlist-row" data-location-id="' + Dex.escapeHTML(location.id) + '">';
		buf += '<a href="/encounters/' + Dex.escapeHTML(location.id) + '" data-target="push" class="' + linkClass + '" data-location-id="' + Dex.escapeHTML(location.id) + '">';
		buf += Dex.escapeHTML(location.name) + '</a>';
		buf += '<span class="encounterlist-picked-icon">' + this.renderSelectedIcon(selectedSelection) + '</span>';
		buf += '<div class="encounterlist-catch-controls">';
		buf += '<select class="textbox encounterlist-catch" data-location-id="' + Dex.escapeHTML(location.id) + '" aria-label="Choose species for ' + Dex.escapeHTML(location.name) + '">';
		buf += this.renderCatchSelectOptions(location, selectedSelection);
		buf += '</select>';
		buf += '</div>';
		buf += '</li>';
		return buf;
	},
	renderAbilityBoostControls: function () {
		return '';
	},
	renderCatchSelectOptions: function (location, selectedSelection) {
		var selectedId = toID(selectedSelection || '');
		var self = this;
		var selectedAttr = function (value) {
			var optionId = toID(value || '');
			if (!optionId && !selectedId) return ' selected';
			return optionId === selectedId ? ' selected' : '';
		};
		var buf = '<option value=""' + selectedAttr('') + '>(None)</option>';
		buf += '<option value="missed"' + selectedAttr('missed') + '>Missed</option>';
		buf += '<option value="delaying"' + selectedAttr('delaying') + '>Delaying</option>';
		var modeLabels = (location && location.modeLabels && typeof location.modeLabels === 'object') ? location.modeLabels : {};
		var sections = [
			{mode: 'land', label: modeLabels.land || 'Land'},
			{mode: 'surf', label: modeLabels.surf || 'Surfing'},
			{mode: 'rock', label: modeLabels.rock || 'Rock Smash'},
			{mode: 'fish', label: modeLabels.fish || 'Rod'}
		];
		for (var i = 0; i < sections.length; i++) {
			var section = sections[i];
			var speciesIds = location && location.speciesByMode && location.speciesByMode[section.mode] ? location.speciesByMode[section.mode] : [];
			if (!speciesIds.length) continue;
			buf += '<optgroup label="' + Dex.escapeHTML(section.label) + '">';
			for (var j = 0; j < speciesIds.length; j++) {
				var speciesId = toID(speciesIds[j]);
				if (!speciesId) continue;
				buf += '<option value="' + Dex.escapeHTML(speciesId) + '"' + selectedAttr(speciesId) + '>' + Dex.escapeHTML(self.getSpeciesName(speciesId)) + '</option>';
			}
			buf += '</optgroup>';
		}
		return buf;
	},
	getSelectedSpeciesDisplay: function (location, selectedSpecies) {
		if (isEncounterSpecialSelection(selectedSpecies)) {
			return getEncounterSpecialSelectionLabel(selectedSpecies);
		}
		if (!selectedSpecies || !location || location.speciesIds.indexOf(selectedSpecies) < 0) return '';
		return this.getSpeciesName(selectedSpecies);
	},
	resolveSpeciesInput: function (location, rawValue) {
		if (!location) return '';
		var raw = String(rawValue || '').trim();
		if (!raw) return '';
		var rawId = toID(raw);
		if (!rawId || rawId === 'none') return '';
		if (isEncounterSpecialSelection(rawId)) return rawId;
		if (location.speciesIds.indexOf(rawId) >= 0) return rawId;

		var matches = [];
		var searchIndex = location.speciesSearchIndex || {};
		for (var i = 0; i < location.speciesIds.length; i++) {
			var speciesId = location.speciesIds[i];
			var speciesNameId = toID(this.getSpeciesName(speciesId));
			if (speciesNameId === rawId) return speciesId;
			var haystack = searchIndex[speciesId] || (speciesId + speciesNameId);
			if (haystack.indexOf(rawId) >= 0) matches.push(speciesId);
		}
		return matches.length === 1 ? matches[0] : null;
	},
	syncCatchControlForRow: function ($row, location, selectedSpecies) {
		if (!location || !$row || !$row.length) return;
		var normalizedSelection = toID(selectedSpecies || '');
		if (normalizedSelection && !isEncounterSpecialSelection(normalizedSelection) && location.speciesIds.indexOf(normalizedSelection) < 0) {
			normalizedSelection = '';
		}
		$row.find('.encounterlist-catch').val(normalizedSelection);
	},
	clickRoute: function (e) {
		this.activeLocationId = toID($(e.currentTarget).attr('data-location-id'));
		this.highlightActiveRoute();
	},
	clickRow: function (e) {
		if ($(e.target).closest('.encounterlist-catch-controls').length) return;
		var $row = $(e.currentTarget);
		var locationId = toID($row.attr('data-location-id'));
		if (!locationId) return;
		this.activeLocationId = locationId;
		this.highlightActiveRoute();
		if ($(e.target).closest('.encounterlist-route-link').length) return;
		e.preventDefault();
		e.stopPropagation();
		this.app.go('encounters/' + locationId, this, false, $row.find('.encounterlist-route-link'));
	},
	changeSelection: function (e) {
		var $input = $(e.currentTarget);
		var locationId = toID($input.attr('data-location-id'));
		var location = this.locationsById[locationId];
		if (!location) return;
		var resolvedSelectionId = this.resolveSpeciesInput(location, $input.val());
		if (resolvedSelectionId === null) {
			var currentSelections = PokedexEncounterDupeStore.getSelections();
			var currentSelectionId = toID(currentSelections[locationId] || '');
			$input.val(currentSelectionId);
			return;
		}
		PokedexEncounterDupeStore.setSelection(locationId, resolvedSelectionId);
		$input.val(resolvedSelectionId || '');
	},
	changeStaticBoost: function (e) {
		PokedexEncounterAbilityBoostStore.setStaticBoost(!!$(e.currentTarget).prop('checked'));
	},
	changeHarvestBoost: function (e) {
		PokedexEncounterAbilityBoostStore.setHarvestBoost(!!$(e.currentTarget).prop('checked'));
	},
	changeMagnetPullBoost: function (e) {
		PokedexEncounterAbilityBoostStore.setMagnetPullBoost(!!$(e.currentTarget).prop('checked'));
	},
	syncAbilityBoostControls: function () {
		var state = PokedexEncounterAbilityBoostStore.getState();
		this.$('input[name=encounter-static-boost]').prop('checked', !!state.staticBoost);
		this.$('input[name=encounter-harvest-boost]').prop('checked', !!state.harvestBoost);
		this.$('input[name=encounter-magnet-pull-boost]').prop('checked', !!state.magnetPullBoost);
	},
	updateFilter: function () {
		this.locationFilter = toID(this.$('input.encounterlist-search').val() || '');
		this.applyLocationFilter();
	},
	matchesLocationFilter: function (location, queryId) {
		if (!queryId) return true;
		if (!location) return false;
		var searchText = location.searchText || toID(location.name || '');
		return searchText.indexOf(queryId) >= 0;
	},
	applyLocationFilter: function () {
		var queryId = this.locationFilter || '';
		var visibleCount = 0;
		var self = this;
		this.$('.encounterlist-row').each(function () {
			var $row = $(this);
			var locationId = toID($row.attr('data-location-id'));
			var location = self.locationsById[locationId];
			var isVisible = self.matchesLocationFilter(location, queryId);
			$row.toggleClass('encounterlist-row-hidden', !isVisible);
			if (isVisible) visibleCount++;
		});
		this.$('.encounterlist-empty').toggle(!visibleCount);
	},
	resetSelections: function (e) {
		e.preventDefault();
		e.stopPropagation();
		PokedexEncounterDupeStore.clear();
		this.setAeLuaSyncStatus('', '');
	},
	highlightActiveRoute: function () {
		var activeLocationId = this.activeLocationId;
		this.$('.encounterlist-route-link').each(function () {
			var $link = $(this);
			var locationId = toID($link.attr('data-location-id'));
			$link.toggleClass('encounterlist-route-active', activeLocationId && locationId === activeLocationId);
		});
	},
	handleDupeUpdate: function () {
		this.refreshState();
	},
	handleAbilityBoostUpdate: function () {
		this.syncAbilityBoostControls();
	},
	refreshState: function () {
		var selections = this.ensureSelectionsNormalized();
		if (!selections) return;
		var dupes = PokedexEncounterDupeStore.getDupeSet();
		var selectedLocationByMetGroupId = {};
		var self = this;
		for (var i = 0; i < this.locations.length; i++) {
			var location = this.locations[i];
			var locationId = toID(location && location.id);
			if (!locationId) continue;
			var selectedSelectionId = toID(selections[locationId] || '');
			if (!selectedSelectionId) continue;
			var metGroupId = location.metGroupId || locationId;
			if (!selectedLocationByMetGroupId[metGroupId]) {
				selectedLocationByMetGroupId[metGroupId] = locationId;
			}
		}
		this.$('.encounterlist-row').each(function () {
			var $row = $(this);
			var locationId = toID($row.attr('data-location-id'));
			var selectedSelection = toID(selections[locationId] || '');
			var location = self.locationsById[locationId];
			if (location && selectedSelection && !isEncounterSpecialSelection(selectedSelection) && location.speciesIds.indexOf(selectedSelection) < 0) {
				selectedSelection = '';
			}
			self.syncCatchControlForRow($row, location, selectedSelection);
			var metGroupId = location && location.metGroupId ? location.metGroupId : locationId;
			var selectedLocationInGroup = selectedLocationByMetGroupId[metGroupId] || '';
			var lockedBySharedMet = !!(selectedLocationInGroup && selectedLocationInGroup !== locationId);
			$row.toggleClass('encounterlist-row-dupe', !!(selectedSelection && !isEncounterSpecialSelection(selectedSelection) && dupes[selectedSelection]));
			$row.toggleClass('encounterlist-row-missed', selectedSelection === 'missed');
			$row.toggleClass('encounterlist-row-delaying', selectedSelection === 'delaying');
			$row.toggleClass('encounterlist-row-locked', lockedBySharedMet);
			$row.find('.encounterlist-catch').prop('disabled', lockedBySharedMet);
			$row.find('.encounterlist-picked-icon').html(self.renderSelectedIcon(selectedSelection));
		});
		this.$('.encounterlist-dupe-count').text('Dupes: ' + PokedexEncounterDupeStore.getDupeCount());
		this.syncAbilityBoostControls();
		this.highlightActiveRoute();
		this.applyLocationFilter();
	},
	renderSelectedIcon: function (speciesId) {
		if (!speciesId) return '';
		var template = BattlePokedex[speciesId];
		if (!template || !template.name) return '';
		return '<span class="picon" style="' + Dex.getPokemonIcon(template.name) + '"></span>';
	}
});
