function pokemonPanelLearnsetSourceType(source) {
  if (typeof source !== "string") return "";
  var normalized = source.trim().toUpperCase();
  if (!normalized) return "";

  if (/^[0-9]*L/.test(normalized)) return "L";
  if (/^[0-9]*(M|TM|HM|TR)/.test(normalized)) return "M";
  if (/^[0-9]*(T|TUTOR)/.test(normalized)) return "T";
  if (/^[0-9]*(E|EGG)/.test(normalized)) return "E";
  if (/^[0-9]*(S|EVENT)/.test(normalized)) return "S";

  var directMatch = normalized.match(/^[0-9]*([A-Z])/);
  var sourceType = directMatch ? directMatch[1] : normalized.charAt(0);
  if (sourceType === "H") return "M"; // HM
  if (sourceType === "R") return "M"; // TR

  return sourceType;
}

function pokemonPanelLearnsetSourceLevel(source) {
  if (typeof source !== "string") return "";
  var levelMatch = source.toUpperCase().match(/L([0-9]+)/);
  return levelMatch ? levelMatch[1] : "";
}

function pokemonPanelLearnsetSourceGen(source) {
  if (typeof source !== "string") return "";
  var genMatch = source.match(/^([0-9]+)/);
  return genMatch ? genMatch[1] : "";
}


var PokedexPokemonPanel = PokedexResultPanel.extend({
  initialize: function (id) {
    id = toID(id);
    var rawDexEntry = (window.BattlePokedex && window.BattlePokedex[id]) || {};
    var rawPerfectIVs = parseInt(rawDexEntry.perfectIVCount, 10) || 0;
    var pokemon = Dex.species.get(id);
    this.id = id;
    if (!pokemon.exists) {
      this.shortTitle = id || "not found";
      this.html(
        '<div class="pfx-body dexentry"><a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a><h1>Pok&eacute;mon not found</h1><p>No data exists for <code>' +
          BattleLog.escapeHTML(id) +
          "</code>.</p></div>",
      );
      return;
    }
    this.shortTitle = pokemon.baseSpecies;

    var isUnobtainable = pokemon.tier === "unobtainable";
    var guaranteedPerfectIVs = parseInt(pokemon.perfectIVCount, 10) || rawPerfectIVs;
    if (!guaranteedPerfectIVs && pokemon.baseSpecies) {
      var baseSpeciesEntry = (window.BattlePokedex && window.BattlePokedex[toID(pokemon.baseSpecies)]) || {};
      guaranteedPerfectIVs = parseInt(baseSpeciesEntry.perfectIVCount, 10) || 0;
    }
    var buf = '<div class="pfx-body dexentry">';

    buf +=
      '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';

    buf += "<h1>";
    if (pokemon.forme) {
      buf +=
        '<a href="/pokemon/' +
        id +
        '" data-target="push" class="subtle">' +
        pokemon.baseSpecies +
        "<small>-" +
        pokemon.forme +
        "</small></a>";
    } else {
      buf +=
        '<a href="/pokemon/' +
        id +
        '" data-target="push" class="subtle">' +
        pokemon.name +
        "</a>";
    }
    if (pokemon.num > 0) buf += " <code>#" + pokemon.num + "</code>";
    buf += "</h1>";
    if (guaranteedPerfectIVs === 3) {
      buf +=
        '<div class="perfectivbanner"><strong>Note:</strong> This Pok&eacute;mon has guaranteed 3 perfect IVs.</div>';
    }

    if (isUnobtainable) {
      buf +=
        '<div class="warning"><strong>Note:</strong> This Pok&eacute;mon cannot be obtained.</div>';
    }

    buf +=
      '<img src="' +
      Dex.resourcePrefix +
      "sprites/gen5/" +
      pokemon.spriteid +
      ".png" +
      '" alt="" width="96" height="96" class="sprite" />';

    buf += '<dl class="typeentry">';
    buf += "<dt>Types:</dt> <dd>";
    for (var i = 0; i < pokemon.types.length; i++) {
      buf +=
        '<a class="type ' +
        toID(pokemon.types[i]) +
        '" href="/types/' +
        toID(pokemon.types[i]) +
        '" data-target="push">' +
        pokemon.types[i] +
        "</a> ";
    }
    buf += "</dd>";
    buf += "</dl>";

    buf += '<dl class="sizeentry">';
    buf += "<dt>Size:</dt> <dd>";
    var gkPower = (function (weightkg) {
      if (weightkg >= 200) return 120;
      if (weightkg >= 100) return 100;
      if (weightkg >= 50) return 80;
      if (weightkg >= 25) return 60;
      if (weightkg >= 10) return 40;
      return 20;
    })(pokemon.weightkg);
    buf +=
      "" +
      pokemon.heightm +
      " m, " +
      pokemon.weightkg +
      ' kg<br /><small><a class="subtle" href="/moves/grassknot" data-target="push">Grass Knot</a>: ' +
      gkPower +
      "</small>";
    buf += "</dd>";
    buf += "</dl>";

    buf += '<dl class="abilityentry">';
    buf += '<dt>Abilities:</dt> <dd class="imgentry">';
    for (var i in pokemon.abilities) {
      var ability = pokemon.abilities[i];
      if (!ability) continue;

      if (i !== "0") buf += " | ";
      if (i === "H") ability = "<em>" + pokemon.abilities[i] + "</em>";
      buf +=
        '<a href="/abilities/' +
        toID(pokemon.abilities[i]) +
        '" data-target="push">' +
        ability +
        "</a>";
      if (i === "H") buf += "<small> (H)</small>";
      if (i === "S") buf += "<small> (special)</small>";
    }
    buf += "</dd>";
    buf += "</dl>";

    buf += "<dl>";
    buf += '<dt style="clear:left">Base stats:</dt><dd><table class="stats">';

    var StatTitles = {
      hp: "HP",
      atk: "Attack",
      def: "Defense",
      spa: "Sp. Atk",
      spd: "Sp. Def",
      spe: "Speed",
    };
    var formatDelta = function (val) {
      if (!val) return "";
      var sign = val > 0 ? "+" : "";
      var cls = val > 0 ? "delta-positive" : "delta-negative";
      return ' <small class="' + cls + '">' + sign + val + "</small>";
    };
    buf +=
      '<tr><td></td><td></td><td style="width:200px"></td><th class="ministat"><abbr title="0 IVs, 0 EVs, negative nature">min&minus;</a></th><th class="ministat"><abbr title="31 IVs, 0 EVs, neutral nature">min</abbr></th><th class="ministat"><abbr title="31 IVs, 252 EVs, neutral nature">max</abbr></th><th class="ministat"><abbr title="31 IVs, 252 EVs, positive nature">max+</abbr></th>';
    var bst = 0;
    for (var stat in BattleStatNames) {
      var baseStat = pokemon.baseStats[stat];
      var statDelta = pokemon.baseStatsDelta && pokemon.baseStatsDelta[stat] ? pokemon.baseStatsDelta[stat] : 0;
      bst += baseStat;
      var width = Math.floor((baseStat * 200) / 200);
      if (width > 200) width = 200;
      var color = Math.floor((baseStat * 180) / 255);
      if (color > 360) color = 360;
      buf +=
        "<tr><th>" +
        StatTitles[stat] +
        formatDelta(statDelta) +
        ':</th><td class="stat">' +
        baseStat +
        "</td>";
      buf +=
        '<td class="statbar"><span style="width:' +
        Math.floor(width) +
        "px;background:hsl(" +
        color +
        ",85%,45%);border-color:hsl(" +
        color +
        ',75%,35%)"></span></td>';
      buf +=
        '<td class="ministat"><small>' +
        (stat === "hp" ? "" : this.getStat(baseStat, false, 100, 0, 0, 0.9)) +
        '</small></td><td class="ministat"><small>' +
        this.getStat(baseStat, stat === "hp", 100, 31, 0, 1.0) +
        "</small></td>";
      buf +=
        '<td class="ministat"><small>' +
        this.getStat(baseStat, stat === "hp", 100, 31, 255, 1.0) +
        '</small></td><td class="ministat"><small>' +
        (stat === "hp"
          ? ""
          : this.getStat(baseStat, false, 100, 31, 255, 1.1)) +
        "</small></td></tr>";
    }
    var totalDelta = pokemon.baseStatsDelta && pokemon.baseStatsDelta.total ? pokemon.baseStatsDelta.total : 0;
    var totalDeltaClass = totalDelta > 0 ? "delta-positive" : "delta-negative";
    buf +=
      '<tr><th class="bst">Total:</th><td class="bst">' +
      bst +
      (totalDelta ? '<br /><small class="' + totalDeltaClass + '">' + (totalDelta > 0 ? "+" : "") + totalDelta + '</small>' : "") +
      '</td><td></td><td class="ministat" colspan="4">at level <input type="text" class="textbox" name="level" placeholder="100" size="5" /></td>';

    buf += "</table></dd>";

    buf += "<dt>Evolution:</dt> <dd>";
    var template = pokemon;
    while (template.prevo) template = Dex.species.get(template.prevo);
    if (template.evos) {
      var stages = [];
      var stage = [template.name];
      while (stage.length) {
        stages.push(stage.slice());
        var nextStage = [];
        for (var si = 0; si < stage.length; si++) {
          var stageTemplate = Dex.species.get(stage[si]);
          if (!stageTemplate.evos) continue;
          for (var ei = 0; ei < stageTemplate.evos.length; ei++) {
            var evoName = stageTemplate.evos[ei];
            if (nextStage.indexOf(evoName) < 0) nextStage.push(evoName);
          }
        }
        if (!nextStage.length) break;
        stage = nextStage;
      }

      buf += '<table class="evos"><tr>';
      for (var s = 0; s < stages.length; s++) {
        if (s > 0) {
          var firstInStage = Dex.species.get(stages[s][0]);
          if (firstInStage && firstInStage.prevo) {
            buf +=
              '<td class="arrow"><span><abbr title="' +
              this.getEvoMethod(firstInStage) +
              '">&rarr;</abbr></span></td>';
          } else {
            buf += '<td class="arrow"><span>&rarr;</span></td>';
          }
        }

        buf += "<td>";
        for (var i = 0; i < stages[s].length; i++) {
          template = Dex.species.get(stages[s][i]);
          var name = template.forme
            ? template.baseSpecies + "<small>-" + template.forme + "</small>"
            : template.name;
          name =
            '<span class="picon" style="' +
            Dex.getPokemonIcon(template) +
            '"></span>' +
            name;
          if (template.id === pokemon.id) {
            buf += "<div><strong>" + name + "</strong></div>";
          } else {
            buf +=
              '<div><a href="/pokemon/' +
              template.id +
              '" data-target="replace">' +
              name +
              "</a></div>";
          }
        }
        buf += "</td>";
      }
      buf += "</tr></table>";
      if (pokemon.prevo) {
        buf +=
          "<div><small>Evolves from " +
          Dex.species.get(pokemon.prevo).name +
          " (" +
          this.getEvoMethod(pokemon) +
          ")</small></div>";
      }
    } else {
      buf += "<em>Does not evolve</em>";
    }

    if (pokemon.otherFormes || pokemon.forme) {
      buf += "</dd><dt>Formes:</dt> <dd>";
      template = pokemon.forme ? Dex.species.get(pokemon.baseSpecies) : pokemon;
      var name = template.baseForme || "Base";
      name =
        '<span class="picon" style="' +
        Dex.getPokemonIcon(template) +
        '"></span>' +
        name;
      if (template === pokemon) {
        buf += "<strong>" + name + "</strong>";
      } else {
        buf +=
          '<a href="/pokemon/' +
          template.id +
          '" data-target="replace">' +
          name +
          "</a>";
      }
      var baseSpeciesName = template.name;
      var otherFormes = template.otherFormes;
      if (otherFormes)
        for (var i = 0; i < otherFormes.length; i++) {
          var formeName = otherFormes[i];
          template = Dex.species.get(formeName);
          var formeId = toID(formeName);
          var name = template.forme || formeName;
          if (name.slice(0, baseSpeciesName.length + 1) === baseSpeciesName + "-") {
            name = name.slice(baseSpeciesName.length + 1);
          }
          name =
            '<span class="picon" style="' +
            Dex.getPokemonIcon(formeName) +
            '"></span>' +
            name;
          if (formeId === pokemon.id) {
            buf += ", <strong>" + name + "</strong>";
          } else {
            buf +=
              ', <a href="/pokemon/' +
              formeId +
              '" data-target="replace">' +
              name +
              "</a>";
          }
        }
      if (template.requiredItem) {
        buf +=
          '<div><small>Must hold <a href="/items/' +
          toID(template.requiredItem) +
          '" data-target="push">' +
          template.requiredItem +
          "</a></small></div>";
      }
    }
    if (pokemon.cosmeticFormes) {
      buf += "</dd><dt>Cosmetic formes:</dt> <dd>";
      var name = pokemon.baseForme || "Base";
      name =
        '<span class="picon" style="' +
        Dex.getPokemonIcon(pokemon) +
        '"></span>' +
        name;
      buf += "" + name;

      for (var i = 0; i < pokemon.cosmeticFormes.length; i++) {
        var formeName = pokemon.cosmeticFormes[i];
        template = Dex.species.get(formeName);
        var formeId = toID(formeName);
        var name = template.forme || formeName;
        if (name.slice(0, pokemon.name.length + 1) === pokemon.name + "-") {
          name = name.slice(pokemon.name.length + 1);
        }
        name =
          '<span class="picon" style="' +
          Dex.getPokemonIcon(formeName) +
          '"></span>' +
          name;
        if (formeId === pokemon.id) {
          buf += ", <strong>" + name + "</strong>";
        } else {
          buf +=
            ', <a href="/pokemon/' +
            formeId +
            '" data-target="replace">' +
            name +
            "</a>";
        }
      }
    }
    buf += "</dd></dl>";

    if (pokemon.eggGroups) {
      buf +=
        '<dl class="colentry"><dt>Egg groups:</dt><dd><span class="picon" style="margin-top:-12px;' +
        Dex.getPokemonIcon("egg") +
        '"></span><a href="/egggroups/' +
        pokemon.eggGroups.map(toID).join("+") +
        '" data-target="push">' +
        pokemon.eggGroups.join(", ") +
        "</a></dd></dl>";
      buf += '<dl class="colentry"><dt>Gender ratio:</dt><dd>';
      if (pokemon.gender)
        switch (pokemon.gender) {
          case "M":
            buf += "100% male";
            break;
          case "F":
            buf += "100% female";
            break;
          case "N":
            buf += "100% genderless";
            break;
        }
      else if (pokemon.genderRatio) {
        buf +=
          "" +
          pokemon.genderRatio.M * 100 +
          "% male, " +
          pokemon.genderRatio.F * 100 +
          "% female";
      } else {
        buf += "50% male, 50% female";
      }
      buf += "</dd></dl>";

      if (pokemon.items && (pokemon.items.C || pokemon.items.R)) {
        var heldRows = [];
        if (pokemon.items.C && pokemon.items.C !== "-------") {
          heldRows.push({label: "Common", name: pokemon.items.C});
        }
        if (pokemon.items.R && pokemon.items.R !== "-------") {
          heldRows.push({label: "Rare", name: pokemon.items.R});
        }

        if (heldRows.length) {
          buf += '<dl class="colentry"><dt>Held Items:</dt><dd>';
          for (var i = 0; i < heldRows.length; i++) {
            var held = heldRows[i];
            var itemid = toID(held.name);
            var item = Dex.items.get(itemid);
            if (i) buf += "<br />";
            buf += held.label + ": ";
            buf += '<a href="/items/' + itemid + '" data-target="push">';
            if (item && item.name) {
              buf += '<span class="itemicon" style="margin-top:-3px;margin-right:5px;' + Dex.getItemIcon(item) + '"></span>';
              buf += item.name;
            } else {
              buf += held.name;
            }
            buf += "</a>";
          }
          buf += "</dd></dl>";
        }
      }

      buf += '<div style="clear:left"></div>';
    }

		if (pokemon.heldItems) {
			buf += '<dl class="colentry"><dt>Held Items:</dt>';
			for (var i in pokemon.heldItems) {
				var heldItem = pokemon.heldItems[i];
				var itemid = heldItem.substr(3);
				var chance = parseInt(heldItem.substr(0, 3));
				var item = Dex.items.get(itemid)
				buf += '<dd>';
				buf += '<a href="/items/'+itemid+'" data-target="push">';
				buf += '<span class="itemicon" style="margin-top:-3px;margin-right:5px;'+Dex.getItemIcon(item)+'"></span>';
				buf += item.name;
				buf += '</a>';
				buf += ` (${chance}%)`
				buf += '</dd>';
			}
			buf += '</dl>';
		}
		buf += '<div style="clear:left"></div>';

    // learnset
    if (pokemon.tier === "obtainable") {
      buf +=
        '<ul class="tabbar"><li><button class="button nav-first cur" value="move">Moves</button></li><li><button class="button" value="details">Flavor</button></li><li><button class="button" value="encounters">Encounters</button></li></ul>';
    } else {
      buf +=
        '<ul class="tabbar"><li><button class="button nav-first cur" value="move">Moves</button></li><li><button class="button" value="details">Flavor</button></li></ul>';
    }

    buf += '<ul class="utilichart nokbd">';
    if (!isUnobtainable) {
      buf += '<li class="resultheader"><h3>Level-up</h3></li>';

      var learnsetTable = window.BattleLearnsets || {};
      var learnset = learnsetTable[id] && learnsetTable[id].learnset;
      if (!learnset && learnsetTable[toID(pokemon.baseSpecies)]) {
        learnset = learnsetTable[toID(pokemon.baseSpecies)].learnset;
      }

      var moves = [];
      if (learnset) {
        for (var moveid in learnset) {
          var sources = learnset[moveid];
          if (typeof sources === "string") sources = [sources];
          for (var i = 0, len = sources.length; i < len; i++) {
            var source = sources[i];
            if (source.substr(0, 1) === "L") {
              moves.push("a" + source.substr(1).padStart(3, "0") + " " + moveid);
            }
          }
        }
      }
      moves.sort();
      for (var i = 0, len = moves.length; i < len; i++) {
        var move = BattleMovedex[moves[i].substr(5)];
        if (move) {
          var desc =
            moves[i].substr(1, 3) === "001" || moves[i].substr(1, 3) === "000"
              ? "&ndash;"
              : "<small>L</small>" + (parseInt(moves[i].substr(1, 3), 10) || "?");
          buf += BattleSearch.renderTaggedMoveRow(move, desc);
        }
      }
    }
    buf += "</ul>";

    buf += "</div>";

    this.html(buf);

    setTimeout(this.renderFullLearnset.bind(this));
  },
  events: {
    "click .tabbar button": "selectTab",
    "input input[name=level]": "updateLevel",
    "keyup input[name=level]": "updateLevel",
    "change input[name=level]": "updateLevel",
  },
  updateLevel: function (e) {
    var val = this.$("input[name=level]").val();
    var level = val === "" ? 100 : parseInt(val, 10);
    var lowIV = 31,
      highIV = 31;
    var lowEV = 0,
      highEV = 255;
    if (val.slice(-1) === ":") {
      lowIV = 0;
      highEV = 0;
    }
    var i = 0;
    var $entries = this.$("table.stats td.ministat small");
    var pokemon = Dex.species.get(this.id);
    for (var stat in BattleStatNames) {
      var baseStat = pokemon.baseStats[stat];

      $entries
        .eq(4 * i + 0)
        .text(
          stat === "hp" ? "" : this.getStat(baseStat, false, level, 0, 0, 0.9),
        );
      $entries
        .eq(4 * i + 1)
        .text(this.getStat(baseStat, stat === "hp", level, lowIV, lowEV, 1.0));
      $entries
        .eq(4 * i + 2)
        .text(
          this.getStat(baseStat, stat === "hp", level, highIV, highEV, 1.0),
        );
      $entries
        .eq(4 * i + 3)
        .text(
          stat === "hp"
            ? ""
            : this.getStat(baseStat, false, level, highIV, highEV, 1.1),
        );
      i++;
    }
  },
  getEvoMethod: function (evo) {
    let condition = evo.evoCondition ? ` ${evo.evoCondition}` : ``;
    switch (evo.evoType) {
      case "levelExtra":
        return "level-up" + condition;
      case "levelFriendship":
        return "level-up with high Friendship" + condition;
      case "levelHold":
        return "level-up while holding " + evo.evoItem + condition;
      case "useItem":
        return "use " + evo.evoItem + condition;
      case "useMove":
        return "use " + evo.evoMove + condition;
      case "levelMove":
        return "level-up while knowing " + evo.evoMove + condition;
      case "levelMap":
        return "level-up while located in " + evo.evoMap;
      case "levelParty":
        return "level-up while " + evo.evoSpecies + " is in the party";
      case "trade":
        return "trade";
      case "tradeSpecies":
        return "trade for a " + evo.evoSpecies;
      case "tradeItem":
        return "trade" + condition + " " + evo.evoItem;
      case "other":
        return evo.evoCondition;
      default:
        if (!evo.evoLevel) {
          if (evo.evoMove) {
            return "level-up while knowing " + evo.evoMove + condition;
          }
          if (condition) {
            return "level-up" + condition;
          }
        }
        return "level " + evo.evoLevel + condition;
    }
  },
  selectTab: function (e) {
    this.$(".tabbar button").removeClass("cur");
    $(e.currentTarget).addClass("cur");
    switch (e.currentTarget.value) {
      case "move":
        this.renderFullLearnset();
        break;
      case "details":
        this.renderDetails();
        break;
      case "encounters":
        this.renderEncounters();
        break;
    }
  },
  renderFullLearnset: function () {
    var pokemon = Dex.species.get(this.id);
    if (pokemon.tier === "unobtainable") {
      this.$(".utilichart").empty();
      return;
    }
    var learnsetTable = window.BattleLearnsets || {};
    var learnset = learnsetTable[this.id] && learnsetTable[this.id].learnset;
    if (!learnset && learnsetTable[toID(pokemon.baseSpecies)]) {
      learnset = learnsetTable[toID(pokemon.baseSpecies)].learnset;
    }
    if (!learnset) {
      this.$(".utilichart").html(
        '<li class="result"><em>No learnset data found.</em></li>',
      );
      return;
    }
    if (
      pokemon.changesFrom &&
      learnsetTable[toID(pokemon.changesFrom)] &&
      learnsetTable[toID(pokemon.changesFrom)].learnset
    ) {
      learnset = $.extend(
        {},
        learnset,
        learnsetTable[toID(pokemon.changesFrom)].learnset,
      );
    }

    // learnset
    var buf = "";
    var moves = [];
    var shownMoves = {};
    /** The most recent generation this pokemon has appeared in */
    var mostRecentGen = Dex.gen;
    var pastGenPoke = pokemon;
    for (; mostRecentGen > 7; mostRecentGen--) {
      if (pastGenPoke.isNonstandard !== "Past") break;
      pastGenPoke = Dex.forGen(mostRecentGen - 1).species.get(pastGenPoke.id);
    }
    mostRecentGen = "" + mostRecentGen;
    for (var moveid in learnset) {
      var sources = learnset[moveid];
      if (typeof sources === "string") sources = [sources];
      for (var i = 0, len = sources.length; i < len; i++) {
        var source = sources[i];
        var sourceType = source.charAt(0);
        switch (sourceType) {
          case "L":
            moves.push("a" + source.substr(1).padStart(3, "0") + " " + moveid);
            shownMoves[moveid] = shownMoves[moveid] | 2;
            break;
          case "M":
            moves.push("d000 " + moveid);
            shownMoves[moveid] = shownMoves[moveid] | 1;
            break;
          case "T":
            moves.push("e000 " + moveid);
            shownMoves[moveid] = shownMoves[moveid] | 1;
            break;
          case "E":
            moves.push("f000 " + moveid);
            shownMoves[moveid] = shownMoves[moveid] | 4;
            break;
        }
        if (sourceType === "S") {
          if (shownMoves[moveid] & 8) continue;
          moves.push("i000 " + moveid);
          shownMoves[moveid] = shownMoves[moveid] | 8;
        }
      }
    }
    var prevo1, prevo2;
    if (pokemon.prevo) {
      var getInheritedLevel = function (source) {
        if (source.charAt(0) === "L") return source.substr(1);
        if (source.substr(0, 2) === mostRecentGen + "L") return source.substr(2);
        return "";
      };
      var isInheritedEggSource = function (source) {
        return source === "E" || source === mostRecentGen + "E";
      };
      var isInheritedEventSource = function (source) {
        return source.charAt(0) === "S" || source.charAt(1) === "S";
      };
      prevo1 = toID(pokemon.prevo);
      var prevoData = learnsetTable[prevo1];
      var prevoLearnset = prevoData && prevoData.learnset;
      if (prevoLearnset) {
        for (var moveid in prevoLearnset) {
          var sources = prevoLearnset[moveid];
          if (typeof sources === "string") sources = [sources];
          for (var i = 0, len = sources.length; i < len; i++) {
            var source = sources[i];
            var inheritedLevel = getInheritedLevel(source);
            if (inheritedLevel) {
              if (shownMoves[moveid] & 2) continue;
              moves.push("b" + inheritedLevel.padStart(3, "0") + " " + moveid);
              shownMoves[moveid] = shownMoves[moveid] | 2;
            } else if (isInheritedEggSource(source)) {
              if (shownMoves[moveid] & 4) continue;
              moves.push("g000 " + moveid);
              shownMoves[moveid] = shownMoves[moveid] | 4;
            } else if (isInheritedEventSource(source)) {
              if (shownMoves[moveid] & 8) continue;
              moves.push("i000 " + moveid);
              shownMoves[moveid] = shownMoves[moveid] | 8;
            }
          }
        }
      }

      if (BattlePokedex[prevo1] && BattlePokedex[prevo1].prevo) {
        prevo2 = toID(BattlePokedex[prevo1].prevo);
        var prevo2Data = learnsetTable[prevo2];
        prevoLearnset = prevo2Data && prevo2Data.learnset;
        if (prevoLearnset) {
          for (var moveid in prevoLearnset) {
            var sources = prevoLearnset[moveid];
            if (typeof sources === "string") sources = [sources];
            for (var i = 0, len = sources.length; i < len; i++) {
              var source = sources[i];
              var inheritedLevel = getInheritedLevel(source);
              if (inheritedLevel) {
                if (shownMoves[moveid] & 2) continue;
                moves.push(
                  "c" + inheritedLevel.padStart(3, "0") + " " + moveid,
                );
                shownMoves[moveid] = shownMoves[moveid] | 2;
              } else if (isInheritedEggSource(source)) {
                if (shownMoves[moveid] & 4) continue;
                moves.push("h000 " + moveid);
                shownMoves[moveid] = shownMoves[moveid] | 4;
              } else if (isInheritedEventSource(source)) {
                if (shownMoves[moveid] & 8) continue;
                moves.push("i000 " + moveid);
                shownMoves[moveid] = shownMoves[moveid] | 8;
              }
            }
          }
        }
      }
    }
    for (var moveid in learnset) {
      if (moveid in shownMoves) continue;
      moves.push("j000 " + moveid);
      shownMoves[moveid] = shownMoves[moveid] | 1;
    }
    moves.sort();
    var last = "",
      lastChanged = false;
    for (var i = 0, len = moves.length; i < len; i++) {
      var move = BattleMovedex[moves[i].substr(5)];
      if (!move) {
        buf += '<li><pre>error: "' + moves[i] + '"</pre></li>';
      } else {
        if ((lastChanged = moves[i].substr(0, 1) !== last)) {
          last = moves[i].substr(0, 1);
        }
        var desc = "";
        switch (last) {
          case "a": // level-up move
            if (lastChanged)
              buf += '<li class="resultheader"><h3>Level-up</h3></li>';
            desc =
              moves[i].substr(1, 3) === "001"
                ? "&ndash;"
                : moves[i].substr(1, 3) === "000"
                  ? "Evo."
                  : "<small>L</small>" + (Number(moves[i].substr(1, 3)) || "?");
            break;
          case "b": // prevo1 level-up move
            if (lastChanged)
              buf +=
                '<li class="resultheader"><h3>Level-up from ' +
                BattlePokedex[prevo1].name +
                "</h3></li>";
            desc =
              moves[i].substr(1, 3) === "001" || moves[i].substr(1, 3) === "000"
                ? "&ndash;"
                : "<small>L</small>" + (Number(moves[i].substr(1, 3)) || "?");
            break;
          case "c": // prevo2 level-up move
            if (lastChanged)
              buf +=
                '<li class="resultheader"><h3>Level-up from ' +
                BattlePokedex[prevo2].name +
                "</h3></li>";
            desc =
              moves[i].substr(1, 3) === "001" || moves[i].substr(1, 3) === "000"
                ? "&ndash;"
                : "<small>L</small>" + (Number(moves[i].substr(1, 3)) || "?");
            break;
          case "d": // tm/hm
            if (lastChanged)
              buf += '<li class="resultheader"><h3>TM/HM</h3></li>';
            desc =
              '<img src="//' +
              Config.routes.client +
              '/sprites/itemicons/tm-normal.png" style="margin-top:-3px;opacity:.7" width="24" height="24" alt="M" />';
            break;
          case "e": // tutor
            if (lastChanged)
              buf += '<li class="resultheader"><h3>Tutor</h3></li>';
            desc =
              '<img src="//' +
              Config.routes.client +
              '/sprites/tutor.png" style="margin-top:-4px;opacity:.7" width="27" height="26" alt="T" />';
            break;
          case "f": // egg move
            if (lastChanged)
              buf += '<li class="resultheader"><h3>Egg</h3></li>';
            desc =
              '<span class="picon" style="margin-top:-12px;' +
              Dex.getPokemonIcon("egg") +
              '"></span>';
            break;
          case "g": // prevo1 egg move
            if (lastChanged)
              buf +=
                '<li class="resultheader"><h3>Egg from ' +
                BattlePokedex[prevo1].name +
                "</h3></li>";
            desc =
              '<span class="picon" style="margin-top:-12px;' +
              Dex.getPokemonIcon("egg") +
              '"></span>';
            break;
          case "h": // prevo2 egg move
            if (lastChanged)
              buf +=
                '<li class="resultheader"><h3>Egg from ' +
                BattlePokedex[prevo2].name +
                "</h3></li>";
            desc =
              '<span class="picon" style="margin-top:-12px;' +
              Dex.getPokemonIcon("egg") +
              '"></span>';
            break;
          case "i": // event
            if (lastChanged)
              buf += '<li class="resultheader"><h3>Event</h3></li>';
            desc = "!";
            break;
          case "j": // pastgen
            if (lastChanged)
              buf +=
                '<li class="resultheader"><h3>Past generation only</h3></li>';
            desc = "...";
            break;
        }
        buf += BattleSearch.renderTaggedMoveRow(move, desc);
      }
    }
    this.$(".utilichart").html(buf);
  },
  renderDetails: function () {
    var pokemon = Dex.species.get(this.id);
    var buf = "";

    // flavor
    buf += '<li class="resultheader"><h3>Flavor</h3></li>';
    buf += "<li><dl><dt>Color:</dt><dd>" + pokemon.color + "</dd></dl></li>";

    // animated gen 6
    if (
      pokemon.num > 0 &&
      pokemon.gen < 10 &&
      this.id !== "missingno" &&
      this.id !== "pichuspikyeared"
    ) {
      buf += '<li class="resultheader"><h3>Animated Gen 6-9 sprites</h3></li>';

      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/ani/" +
        pokemon.spriteid +
        '.gif" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/ani-shiny/" +
        pokemon.spriteid +
        '.gif" /></td></table>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/ani-back/" +
        pokemon.spriteid +
        '.gif" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/ani-back-shiny/" +
        pokemon.spriteid +
        '.gif" /></td></table>';

      buf += '<div style="clear:left"></div></li>';
    }

    // cry
    buf += '<li class="resultheader"><h3>Cry</h3></li>';

    buf +=
      '<li class="content"><audio src="' +
      Dex.resourcePrefix +
      "audio/cries/" +
      pokemon.spriteid +
      '.mp3" controls="controls"><a href="' +
      Dex.resourcePrefix +
      "audio/cries/" +
      pokemon.spriteid +
      '.mp3">Play</a></audio></li>';

    // still gen 5
    if (this.id !== "pichuspikyeared") {
      buf += '<li class="resultheader"><h3>Gen 5 Sprites</h3></li>';
      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen5/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen5-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen5-back/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen5-back-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';

      buf += '<div style="clear:left"></div></li>';

      // animated gen 5
      if (pokemon.gen < 6 && this.id !== "missingno") {
        buf += '<li class="resultheader"><h3>Animated Gen 5 sprites</h3></li>';

        buf +=
          '<li class="content"><table class="sprites"><tr><td><img src="' +
          Dex.resourcePrefix +
          "sprites/gen5ani/" +
          pokemon.spriteid +
          '.gif" /></td>';
        buf +=
          '<td><img src="' +
          Dex.resourcePrefix +
          "sprites/gen5ani-shiny/" +
          pokemon.spriteid +
          '.gif" /></td></table>';
        buf +=
          '<table class="sprites"><tr><td><img src="' +
          Dex.resourcePrefix +
          "sprites/gen5ani-back/" +
          pokemon.spriteid +
          '.gif" /></td>';
        buf +=
          '<td><img src="' +
          Dex.resourcePrefix +
          "sprites/gen5ani-back-shiny/" +
          pokemon.spriteid +
          '.gif" /></td></table>';

        buf += '<div style="clear:left"></div></li>';
      }
    }

    if (pokemon.gen < 5) {
      buf += '<li class="resultheader"><h3>Gen 4 Sprites</h3></li>';
      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen4/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen4-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen4-back/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen4-back-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
    }

    if (pokemon.gen < 4) {
      buf += '<li class="resultheader"><h3>Gen 3 Sprites</h3></li>';
      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen3/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen3-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen3-back/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen3-back-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
    }

    if (pokemon.gen < 3) {
      buf += '<li class="resultheader"><h3>Gen 2 Sprites</h3></li>';
      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen2/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen2-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen2-back/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen2-back-shiny/" +
        pokemon.spriteid +
        '.png" /></td></table>';
    }

    if (pokemon.gen < 2) {
      buf += '<li class="resultheader"><h3>Gen 1 Sprites</h3></li>';
      buf +=
        '<li class="content"><table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen1/" +
        pokemon.spriteid +
        '.png" /></td>';
      buf +=
        '<table class="sprites"><tr><td><img src="' +
        Dex.resourcePrefix +
        "sprites/gen1-back/" +
        pokemon.spriteid +
        '.png" /></td>';
    }

    this.$(".utilichart").html(buf);
  },
  getEncounterLocations: function (pokemon) {
    if (this.results) return this.results;
    if (!window.BattleLocationdex || !BattleLocationdex.rates) return [];

    var rates = BattleLocationdex["rates"];

      let isInZone = function (location, enc_mode, pokemon) {
      let for_mode = location[enc_mode];

      if (!for_mode || !("encs" in for_mode)) {
        return { rate: 0, min: 0, max: 0 };
      }

      let sum_rate = 0;
      let min_level = 999;
      let max_level = 0;
      for (let i = 0; i < for_mode["encs"].length; i++) {
        let slot = for_mode["encs"][i];
        let species = slot["species"];
        if (species === pokemon) {
          if (enc_mode === "fish") {
            // since rates are specific to super rod for fishing, change mapping
            sum_rate += rates[enc_mode]["super"][i] || 0;
          } else if (for_mode["rates"] && for_mode["rates"][i] !== undefined) {
            sum_rate += for_mode["rates"][i] || 0;
          } else {
            sum_rate += rates[enc_mode][i] || 0;
          }
          min_level = Math.min(min_level, slot["minLvl"]);
          max_level = Math.max(max_level, slot["maxLvl"]);
        }
      }

      if (!sum_rate) return { rate: 0, min: 0, max: 0 };
      return { rate: sum_rate, min: min_level, max: max_level };
    };

    var results = [];
    for (let location in BattleLocationdex) {
      if (location === "rates") {
        continue;
      }

      let encounters = BattleLocationdex[location];
      let land_rate = isInZone(encounters, "land", pokemon);
      let surf_rate = isInZone(encounters, "surf", pokemon);
      let rock_rate = isInZone(encounters, "rock", pokemon);
      let fish_rate = isInZone(encounters, "fish", pokemon);

      if (encounters.hideRates) {
        if (encounters.customModeHeaders) {
          let modeLabels = encounters.encounterModeLabels || {};
          if (land_rate.rate > 0) {
            results.push({
              mode: "A",
              rate: 0,
              min: land_rate.min,
              max: land_rate.max,
              location: location,
              hideRates: true,
              encounterLabel: modeLabels.land || "Land",
            });
          }
          if (surf_rate.rate > 0) {
            results.push({
              mode: "B",
              rate: 0,
              min: surf_rate.min,
              max: surf_rate.max,
              location: location,
              hideRates: true,
              encounterLabel: modeLabels.surf || "Surfing",
            });
          }
          if (rock_rate.rate > 0) {
            results.push({
              mode: "C",
              rate: 0,
              min: rock_rate.min,
              max: rock_rate.max,
              location: location,
              hideRates: true,
              encounterLabel: modeLabels.rock || "Rock Smash",
            });
          }
          if (fish_rate.rate > 0) {
            results.push({
              mode: "D",
              rate: 0,
              min: fish_rate.min,
              max: fish_rate.max,
              location: location,
              hideRates: true,
              encounterLabel: modeLabels.fish || "Fishing",
            });
          }
        } else {
          let minLevel = 999;
          let maxLevel = 0;
          let hasEncounter = false;
          let customRates = [land_rate, surf_rate, rock_rate, fish_rate];
          for (let j = 0; j < customRates.length; j++) {
            let customRate = customRates[j];
            if (customRate.rate <= 0) continue;
            hasEncounter = true;
            minLevel = Math.min(minLevel, customRate.min);
            maxLevel = Math.max(maxLevel, customRate.max);
          }
          if (hasEncounter) {
            results.push({
              mode: "E",
              rate: 0,
              min: minLevel,
              max: maxLevel,
              location: location,
              hideRates: true,
              encounterLabel: encounters.encounterLabel || "Gift/Static",
            });
          }
        }
        continue;
      }

      if (land_rate.rate > 0) results.push({ mode: "A", rate: land_rate.rate, min: land_rate.min, max: land_rate.max, location: location });
      if (surf_rate.rate > 0) results.push({ mode: "B", rate: surf_rate.rate, min: surf_rate.min, max: surf_rate.max, location: location });
      if (rock_rate.rate > 0) results.push({ mode: "C", rate: rock_rate.rate, min: rock_rate.min, max: rock_rate.max, location: location });
      if (fish_rate.rate > 0) results.push({ mode: "D", rate: fish_rate.rate, min: fish_rate.min, max: fish_rate.max, location: location });
    }

    let modeOrder = { E: 0, A: 1, B: 2, C: 3, D: 4 };
    results.sort(function (a, b) {
      if (modeOrder[a.mode] !== modeOrder[b.mode]) return modeOrder[a.mode] - modeOrder[b.mode];
      return a.location.localeCompare(b.location);
    });
    return results;
  },
  renderEncounters: function () {
    var locations = this.getEncounterLocations(this.id);
    var buf = "";
    var lastSection = "";
    for (let i = 0; i < locations.length; i++) {
      let row = locations[i];
      let sectionKey = row.hideRates ? ("E:" + (row.encounterLabel || "Gift/Static")) : row.mode;
      if (sectionKey !== lastSection) {
        if (buf.length != 0) buf += "</ul>";
        lastSection = sectionKey;
        if (row.hideRates) {
          buf += '<li class="resultheader"><h3>' + Dex.escapeHTML(row.encounterLabel || "Gift/Static") + '</h3></li>';
        } else {
          switch (row.mode) {
            case "A":
              buf += '<li class="resultheader"><h3>Land</h3></li>';
              break;
            case "B":
              buf += '<li class="resultheader"><h3>Surfing</h3></li>';
              break;
            case "C":
              buf += '<li class="resultheader"><h3>Rock Smash</h3></li>';
              break;
            case "D":
              buf += '<li class="resultheader"><h3>Fishing</h3></li>';
              break;
          }
        }
        buf += "<ul>";
      }
      let zone = BattleLocationdex[row.location];
      let levelTag = row.min === row.max ? ("Lv " + row.min) : ("Lv " + row.min + "-" + row.max);
      let tag = row.hideRates
        ? levelTag
        : (row.rate + "% " + levelTag);
      buf += BattleSearch.renderTaggedEncounterRow(zone, tag, row.location);
    }

    if (buf.length != 0) {
      buf += "</ul>";
    }

    this.$(".utilichart").html(buf);
  },
  getStat: function (baseStat, isHP, level, iv, ev, natureMult) {
    if (isHP) {
      if (baseStat === 1) return 1;
      return Math.floor(
        (Math.floor(
          2 * baseStat + (iv || 0) + Math.floor((ev || 0) / 4) + 100,
        ) *
          level) /
          100 +
          10,
      );
    }
    var val = Math.floor(
      (Math.floor(2 * baseStat + (iv || 0) + Math.floor((ev || 0) / 4)) *
        level) /
        100 +
        5,
    );
    if (natureMult && !isHP) val *= natureMult;
    return Math.floor(val);
  },
});
