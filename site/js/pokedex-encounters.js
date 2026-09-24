
var PokedexEncountersPanel = PokedexResultPanel.extend({
	events: {
		'change input[name=encounter-static-boost]': 'changeStaticBoost',
		'change input[name=encounter-harvest-boost]': 'changeHarvestBoost',
		'change input[name=encounter-magnet-pull-boost]': 'changeMagnetPullBoost'
	},
	initialize: function(id) {
		id = toID(id);
		var location = BattleLocationdex[id];
		this.id = id;
		if (!location || !location.name) {
			this.shortTitle = id || "not found";
			this.html(
				'<div class="pfx-body dexentry"><a href="/" class="pfx-backbutton button" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a><h1>Encounter zone not found</h1><p>No encounter data exists for <code>' +
				BattleLog.escapeHTML(id) +
				'</code>.</p></div>'
			);
			return;
		}
		this.shortTitle = location.name;
		this.hideRates = !!location.hideRates;
		this.customEncounterLabel = location.encounterLabel || 'Gift/Static';
		this.customModeHeaders = !!location.customModeHeaders;
		this.encounterModeLabels = (location.encounterModeLabels && typeof location.encounterModeLabels === 'object') ? location.encounterModeLabels : {};
		this.boundHandleScroll = this.handleScroll.bind(this);

		var buf = '<div class="pfx-body dexentry">';

		buf += '<a href="/" class="pfx-backbutton button" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/encounters/'+id+'" data-target="push" class="button subtle">'+location.name+'</a></h1>';
		buf += this.renderAbilityBoostControls();

		// distribution
		buf += '<ul class="utilichart metricchart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);
		this.handleDupeUpdate = this.handleDupeUpdate.bind(this);
		this.handleAbilityBoostUpdate = this.handleAbilityBoostUpdate.bind(this);
		$(document).on('encounterlist:dupes-updated.' + this.cid, this.handleDupeUpdate);
		$(document).on('encounterlist:abilityboost-updated.' + this.cid, this.handleAbilityBoostUpdate);

		setTimeout(this.renderDistribution.bind(this));
	},
	remove: function() {
		$(document).off('encounterlist:dupes-updated.' + this.cid);
		$(document).off('encounterlist:abilityboost-updated.' + this.cid);
		if (this.boundHandleScroll) this.$el.off('scroll', this.boundHandleScroll);
		PokedexResultPanel.prototype.remove.apply(this, arguments);
	},
	renderAbilityBoostControls: function () {
		return '';
	},
	syncAbilityBoostControls: function () {
		if (!window.PokedexEncounterAbilityBoostStore) return;
		var state = PokedexEncounterAbilityBoostStore.getState();
		this.$('input[name=encounter-static-boost]').prop('checked', !!state.staticBoost);
		this.$('input[name=encounter-harvest-boost]').prop('checked', !!state.harvestBoost);
		this.$('input[name=encounter-magnet-pull-boost]').prop('checked', !!state.magnetPullBoost);
	},
	changeStaticBoost: function (e) {
		if (!window.PokedexEncounterAbilityBoostStore) return;
		PokedexEncounterAbilityBoostStore.setStaticBoost(!!$(e.currentTarget).prop('checked'));
	},
	changeHarvestBoost: function (e) {
		if (!window.PokedexEncounterAbilityBoostStore) return;
		PokedexEncounterAbilityBoostStore.setHarvestBoost(!!$(e.currentTarget).prop('checked'));
	},
	changeMagnetPullBoost: function (e) {
		if (!window.PokedexEncounterAbilityBoostStore) return;
		PokedexEncounterAbilityBoostStore.setMagnetPullBoost(!!$(e.currentTarget).prop('checked'));
	},
	handleAbilityBoostUpdate: function () {
		this.syncAbilityBoostControls();
		this.renderDistribution();
	},
	getRateBoostMultiplier: function (speciesId) {
		return 1;
	},
	formatRateNumber: function (rate) {
		if (rate === undefined || rate === null || isNaN(rate)) return '';
		var rounded = Math.round(rate * 10) / 10;
		return (Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : rounded.toFixed(1)) + '%';
	},
	parseDistributionRow: function (row) {
		if (!row || row.length <= 1) return null;
		var parts = row.substr(1).trim().split(/\s+/);
		if (parts.length < 2) return null;
		var parsed = {
			mode: row.charAt(0),
			rateText: '',
			rangeToken: '',
			speciesId: '',
			baseRate: null,
			min: 0,
			max: 0,
			levelText: ''
		};
		if (parts.length >= 3) {
			parsed.rateText = parts[0].replace(/z/g, '');
			parsed.rangeToken = parts[1];
			parsed.speciesId = toID(parts[2]);
		} else {
			parsed.rangeToken = parts[0];
			parsed.speciesId = toID(parts[1]);
		}
		var range = parsed.rangeToken.split('-');
		parsed.min = parseInt(range[0], 10);
		parsed.max = parseInt(range[1], 10);
		if (isNaN(parsed.min)) parsed.min = 0;
		if (isNaN(parsed.max)) parsed.max = parsed.min;
		parsed.levelText = (parsed.min === parsed.max) ? ('Lv ' + parsed.min) : ('Lv ' + parsed.min + '-' + parsed.max);
		if (parsed.rateText) {
			var baseRate = parseFloat(parsed.rateText.replace('%', ''));
			parsed.baseRate = isNaN(baseRate) ? null : baseRate;
		}
		return parsed;
	},
	getDynamicRateContext: function (results) {
		var context = {byIndex: {}, modeHasDupes: {}};
		if (this.hideRates) return context;
		var pools = {};
		for (var i = 0; i < results.length; i++) {
			var parsed = this.parseDistributionRow(results[i]);
			if (!parsed || parsed.baseRate === null || !parsed.speciesId) continue;
			var mode = parsed.mode;
			if (!pools[mode]) {
				pools[mode] = {
					entries: [],
					hasDupe: false,
					totalEligibleRate: 0
				};
			}
			var boostedRate = parsed.baseRate * this.getRateBoostMultiplier(parsed.speciesId);
			if (isNaN(boostedRate) || boostedRate < 0) boostedRate = 0;
			var isDupe = this.isDupeSpecies(parsed.speciesId);
			var eligibleRate = isDupe ? 0 : boostedRate;
			pools[mode].entries.push({
				index: i,
				eligibleRate: eligibleRate
			});
			pools[mode].totalEligibleRate += eligibleRate;
			if (isDupe) pools[mode].hasDupe = true;
		}
		for (var mode in pools) {
			if (!pools.hasOwnProperty(mode)) continue;
			var pool = pools[mode];
			context.modeHasDupes[mode] = !!pool.hasDupe;
			if (!pool.hasDupe) continue;
			var denominator = pool.totalEligibleRate;
			for (var j = 0; j < pool.entries.length; j++) {
				var entry = pool.entries[j];
				context.byIndex[entry.index] = denominator > 0 ? (entry.eligibleRate / denominator * 100) : 0;
			}
		}
		return context;
	},
	getEncounterHeaderLabel: function (mode) {
		var labels = this.encounterModeLabels || {};
		switch (mode) {
		case 'L':
			return labels.land || 'Land';
		case 'W':
			return labels.surf || 'Surfing';
		case 'R':
			return labels.rock || 'Rock Smash';
		case 'O':
			return labels.fishOld || 'Old Rod';
		case 'G':
			return labels.fishGood || 'Good Rod';
		case 'S':
			return labels.fishSuper || labels.fish || 'Fishing';
		case 'E':
			return this.customEncounterLabel || 'Gift/Static';
		}
		return '';
	},
	getDistribution: function() {
		if (this.results) return this.results;
		if (!window.BattleLocationdex || !BattleLocationdex.rates) return this.results = [];

        var landRates = BattleLocationdex['rates']['land']
		var oldRodRates = BattleLocationdex['rates']['fish']['old']
        var goodRodRates = BattleLocationdex['rates']['fish']['good']
        var superRodRates = BattleLocationdex['rates']['fish']['super']
        var surfRates = BattleLocationdex['rates']['surf']
        var rockRates = BattleLocationdex['rates']['rock']        

		var location = this.id;
		var locationData = BattleLocationdex[location];
		if (!locationData) return this.results = [];
		var results = [];
		var hideRates = !!locationData.hideRates;

        var formatRate = function(i) {
            if (hideRates) return '';
            if (i === undefined || i === null) i = 0;
            return i.toString().padStart(2, 'z') + '% '
        }

        var formatRange = function(min, max) {
            return min.toString().padStart(3, '0') + '-' + max.toString().padStart(3, '0') + ' '
        }

        if (hideRates) {
            var pushCustomRows = function(prefix, modeData) {
                if (!modeData || !modeData['encs']) return;
                for (let i = 0; i < modeData['encs'].length; i++) {
                    let enc = modeData['encs'][i];
                    let min = enc.minLvl;
                    let max = enc.maxLvl;
                    let mon = enc.species;
                    results.push(prefix + formatRange(min, max) + mon);
                }
            };
			if (locationData.customModeHeaders) {
				pushCustomRows('L', locationData['land']);
				pushCustomRows('W', locationData['surf']);
				pushCustomRows('R', locationData['rock']);
				pushCustomRows('S', locationData['fish']);
			} else {
				pushCustomRows('E', locationData['land']);
				pushCustomRows('E', locationData['surf']);
				pushCustomRows('E', locationData['rock']);
				pushCustomRows('E', locationData['fish']);
			}
        } else {
        var landRateTable = (locationData['land'] && locationData['land']['rates'] && locationData['land']['rates'].length) ? locationData['land']['rates'] : landRates;
        if (locationData['land'] && locationData['land']['encs'] !== undefined) {
            for (let i = 0; i < locationData['land']['encs'].length; i++) {
                let enc = locationData['land']['encs'][i];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('L' + formatRate(landRateTable[i]) + formatRange(min, max) + mon);
            }
        }

        var surfRateTable = (locationData['surf'] && locationData['surf']['rates'] && locationData['surf']['rates'].length) ? locationData['surf']['rates'] : surfRates;
        if (locationData['surf'] && locationData['surf']['encs'] !== undefined) {
            for (let i = 0; i < locationData['surf']['encs'].length; i++) {
                let enc = locationData['surf']['encs'][i];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('W' + formatRate(surfRateTable[i]) + formatRange(min, max) + mon);
            }
        }

        var rockRateTable = (locationData['rock'] && locationData['rock']['rates'] && locationData['rock']['rates'].length) ? locationData['rock']['rates'] : rockRates;
        if (locationData['rock'] && locationData['rock']['encs'] !== undefined) {
            for (let i = 0; i < locationData['rock']['encs'].length; i++) {
                let enc = locationData['rock']['encs'][i];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('R' + formatRate(rockRateTable[i]) + formatRange(min, max) + mon);
            }
        }

        if (locationData['fish'] && locationData['fish']['encs'] !== undefined) {
            var oldStart = 0;
            for (let i = 0; i < oldRodRates.length; i++) {
                let enc = locationData['fish']['encs'][i + oldStart];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('O' + formatRate(oldRodRates[i]) + formatRange(min, max) + mon);
            }

            var goodStart = oldRodRates.length + oldStart;
            for (let i = 0; i < goodRodRates.length; i++) {
                let enc = locationData['fish']['encs'][i + goodStart];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('G' + formatRate(goodRodRates[i]) + formatRange(min, max) + mon);
            }

            var superStart = goodRodRates.length + goodStart;
            for (let i = 0; i < superRodRates.length; i++) {
                let enc = locationData['fish']['encs'][i + superStart];
                let min = enc.minLvl;
                let max = enc.maxLvl;
                let mon = enc.species;
                results.push('S' + formatRate(superRodRates[i]) + formatRange(min, max) + mon);
            }
        }
        }

		var last = '';
		for (var i=0; i<results.length; i++) {
			if (results[i].charAt(0) !== last) {
				results.splice(i, 0, results[i].charAt(0).toUpperCase());
				i++;
			}
			last = results[i].charAt(0);
		}
		return this.results = results;
	},
	renderDistribution: function() {
		var results = this.getDistribution();
		this.$chart = this.$('.utilichart');
		this.syncAbilityBoostControls();
		this.dynamicRateContext = this.getDynamicRateContext(results);

		if (results.length > 1600/33) {
			if (!this.streamLoading) {
				this.streamLoading = true;
				this.$el.on('scroll', this.boundHandleScroll);
			}

			var panelTop = this.$el.children().offset().top;
			var panelHeight = this.$el.outerHeight();
			var chartTop = this.$chart.offset().top;
			var scrollLoc = this.scrollLoc = this.$el.scrollTop();

			var start = Math.floor((scrollLoc - (chartTop-panelTop)) / 33 - 35);
			var end = Math.floor(start + 35 + panelHeight / 33 + 35);
			if (start < 0) start = 0;
			if (end > results.length-1) end = results.length-1;
			this.start = start, this.end = end;

			// distribution
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i, i < start || i > end)+'</li>';
			}
			this.$chart.html(buf);
		} else {
			if (this.streamLoading) {
				this.streamLoading = false;
				this.$el.off('scroll', this.boundHandleScroll);
			}
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i)+'</li>';
			}
			this.$chart.html(buf);
		}
		this.updateDupeHighlightClasses();
	},
	renderRow: function(i, offscreen) {
		var results = this.results;
		var row = results[i];
		var id = '';
		var rateText = '';
		var levelText = '';
		var parsed = this.parseDistributionRow(row);

		// Header rows are single-letter mode markers inserted in getDistribution.
		if (parsed) {
			rateText = parsed.rateText;
			id = parsed.speciesId;
			levelText = parsed.levelText;
		}

		var template = id ? BattlePokedex[id] : undefined;
		if (!template) {
			var headerLabel = this.getEncounterHeaderLabel(row.charAt(0));
			if (headerLabel) return '<h3>' + Dex.escapeHTML(headerLabel) + '</h3>';
			return '<pre>error: "'+results[i]+'"</pre>';
		} else if (offscreen) {
			return ''+template.name+' '+template.abilities['0']+' '+(template.abilities['1']||'')+' '+(template.abilities['H']||'')+'';
		} else {
			if (!this.hideRates && rateText) {
				var displayRate;
				var mode = row.charAt(0);
				var hasDupeInMode = !!(this.dynamicRateContext && this.dynamicRateContext.modeHasDupes && this.dynamicRateContext.modeHasDupes[mode]);
				if (hasDupeInMode && this.dynamicRateContext.byIndex && this.dynamicRateContext.byIndex.hasOwnProperty(i)) {
					displayRate = this.dynamicRateContext.byIndex[i];
				} else {
					var baseRate = parsed && parsed.baseRate !== null ? parsed.baseRate : parseFloat(rateText.replace('%', ''));
					if (!isNaN(baseRate)) {
						displayRate = baseRate * this.getRateBoostMultiplier(id);
					}
				}
				if (displayRate !== undefined) {
					rateText = this.formatRateNumber(displayRate);
				}
			}
			var desc = '';
			if (!this.hideRates && rateText) {
				desc += rateText + ' ';
			}
			desc += levelText;
			var rowHtml = BattleSearch.renderTaggedLocationRowInner(template, desc, undefined, id);
			return this.decorateDupeEncounterRow(rowHtml, id);
		}
	},
	decorateDupeEncounterRow: function(rowHtml, speciesId) {
		var cleanId = toID(speciesId);
		if (!cleanId) return rowHtml;
		var decorated = rowHtml.replace(/^<a\b/, '<a data-encounter-species="' + BattleLog.escapeHTML(cleanId) + '"');
		if (this.isDupeSpecies(cleanId)) {
			decorated = decorated.replace(/^<a\b/, '<a class="encounter-dupe"');
		}
		return decorated;
	},
	isDupeSpecies: function(speciesId) {
		return !!(window.PokedexEncounterDupeStore &&
			PokedexEncounterDupeStore.isDupe &&
			PokedexEncounterDupeStore.isDupe(speciesId));
	},
	handleDupeUpdate: function() {
		this.renderDistribution();
	},
	updateDupeHighlightClasses: function() {
		if (!this.$chart || !this.$chart.length) this.$chart = this.$('.utilichart');
		if (!this.$chart || !this.$chart.length) return;
		var self = this;
		this.$chart.find('a[data-encounter-species]').each(function() {
			var $row = $(this);
			var speciesId = toID($row.attr('data-encounter-species'));
			$row.toggleClass('encounter-dupe', self.isDupeSpecies(speciesId));
		});
	},
	handleScroll: function() {
		var scrollLoc = this.$el.scrollTop();
		if (Math.abs(scrollLoc - this.scrollLoc) > 20*33) {
			this.renderUpdateDistribution();
		}
	},
	debouncedPurgeTimer: null,
	renderUpdateDistribution: function(fullUpdate) {
		if (this.debouncedPurgeTimer) {
			clearTimeout(this.debouncedPurgeTimer);
			this.debouncedPurgeTimer = null;
		}
		if (!this.dynamicRateContext) this.dynamicRateContext = this.getDynamicRateContext(this.results || []);

		var panelTop = this.$el.children().offset().top;
		var panelHeight = this.$el.outerHeight();
		var chartTop = this.$chart.offset().top;
		var scrollLoc = this.scrollLoc = this.$el.scrollTop();

		var results = this.results;

		var rowFit = Math.floor(panelHeight / 33);

		var start = Math.floor((scrollLoc - (chartTop-panelTop)) / 33 - 35);
		var end = start + 35 + rowFit + 35;
		if (start < 0) start = 0;
		if (end > results.length-1) end = results.length-1;

		var $rows = this.$chart.children();

		if (fullUpdate || start < this.start - rowFit - 30 || end > this.end + rowFit + 30) {
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i, (i < start || i > end))+'</li>';
			}
			this.$chart.html(buf);
			this.start = start, this.end = end;
			return;
		}

		if (start < this.start) {
			for (var i = start; i<this.start; i++) {
				$rows[i].innerHTML = this.renderRow(i);
			}
			this.start = start;
		}

		if (end > this.end) {
			for (var i = this.end+1; i<=end; i++) {
				$rows[i].innerHTML = this.renderRow(i);
			}
			this.end = end;
		}

		if (this.end - this.start > rowFit+90) {
			var self = this;
			this.debouncedPurgeTimer = setTimeout(function() {
				self.renderUpdateDistribution(true);
			}, 1000);
		}
	}
});
