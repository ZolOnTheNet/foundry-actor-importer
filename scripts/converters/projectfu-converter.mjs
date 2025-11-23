import { BaseConverter } from './base-converter.mjs';

/**
 * Converter for Project FU (Fabula Ultima) system
 * Handles conversion from intermediate format to Project FU actor structure
 */
export class ProjectFUConverter extends BaseConverter {
  /**
   * Check if data is already in Project FU format
   * @returns {boolean}
   */
  isAlreadyConverted() {
    // Check for system-specific fields unique to Project FU
    return !!(this.data.system?.affinities && this.data.system?.resources);
  }

  /**
   * Convert intermediate data to Project FU actor format
   * @returns {Object} Project FU actor data
   */
  convert() {
    console.log("=== ProjectFUConverter - Début ===");
    console.log("Données intermédiaires reçues:", this.data);

    // If already in Project FU format, return as-is
    if (this.isAlreadyConverted()) {
      console.log("✓ Données déjà au format Project FU, retour direct");
      return this.data;
    }

    const result = {
      name: this.data.name || "Acteur Importé",
      type: this.data.type || "npc",
      img: this.data.img || "icons/svg/mystery-man.svg",
      system: {
        level: this.mapLevel(),
        species: this.mapSpecies(),
        attributes: this.mapAttributes(),
        resources: this.mapResources(),
        affinities: this.mapAffinities(),
        derived: this.mapDerivedStats(),
        traits: this.mapTraits(),
        description: this.data.description || this.data.system?.description || "",
        rank: {
          value: "soldier",
          replacedSoldiers: 1
        },
        role: {
          value: "custom"
        },
        phases: {
          value: 1
        },
        villain: {
          value: ""
        },
        multipart: {
          value: ""
        },
        useEquipment: {
          value: false
        },
        study: {
          value: 0
        },
        equipped: {},
        bonuses: this.mapBonuses(),
        multipliers: this.mapMultipliers(),
        immunities: this.mapImmunities(),
        references: {
          actor: null,
          skill: null
        },
        associatedTherioforms: ""
      },
      items: this.mapItems()
    };

    console.log("✓ Conversion terminée");
    console.log("Acteur Project FU créé:", result);
    console.log("=== ProjectFUConverter - Fin ===");

    return result;
  }

  /**
   * Map level data
   * @returns {Object}
   */
  mapLevel() {
    return {
      value: this.data.level || this.data.system?.level?.value || 5
    };
  }

  /**
   * Map species/type data with FR → EN translation
   * @returns {Object}
   */
  mapSpecies() {
    const speciesRaw = this.data.species || this.data.system?.species?.value || "beast";
    console.log("  >> mapSpecies - source:", speciesRaw);

    // Table de traduction FR → EN
    const SPECIES_TRANSLATION = {
      'bête': 'beast',
      'construct': 'construct',
      'démon': 'demon',
      'élémentaire': 'elemental',
      'humanoïde': 'humanoid',
      'monstre': 'monster',
      'plante': 'plant',
      'mort-vivant': 'undead'
    };

    // Traduire si nécessaire (si FR), sinon garder tel quel (si déjà EN)
    const species = SPECIES_TRANSLATION[speciesRaw.toLowerCase()] || speciesRaw;
    console.log("  >> mapSpecies - traduit:", species);

    // Valider que l'espèce est reconnue
    const validSpecies = ['beast', 'construct', 'demon', 'elemental', 'humanoid', 'monster', 'plant', 'undead'];
    if (!validSpecies.includes(species)) {
      console.warn(`  ⚠️ Espèce non reconnue par Project FU: "${species}". Valeurs valides:`, validSpecies);
    }

    return {
      value: species
    };
  }

  /**
   * Map attributes (DEX, INS, MIG, WLP) with FR → EN translation
   * @returns {Object}
   */
  mapAttributes() {
    const attrs = this.data.attributes || this.data.system?.attributes || {};
    console.log("  >> mapAttributes - source:", attrs);

    // Traduction FR → EN pour les attributs
    // FR: dex, int, pui, vol
    // EN: dex, ins, mig, wlp

    return {
      dex: {
        base: attrs.dex?.base || 8
      },
      ins: {
        // INT (FR) → INS (EN)
        base: attrs.ins?.base || attrs.int?.base || 8
      },
      mig: {
        // PUI (FR) → MIG (EN)
        base: attrs.mig?.base || attrs.pui?.base || 8
      },
      wlp: {
        // VOL (FR) → WLP (EN)
        base: attrs.wlp?.base || attrs.vol?.base || 8
      }
    };
  }

  /**
   * Map resources (HP, MP, FP)
   * @returns {Object}
   */
  mapResources() {
    const hp = this.data.hp || this.data.system?.resources?.hp || { value: 0, max: 40, bonus: 0 };
    const mp = this.data.mp || this.data.system?.resources?.mp || { value: 0, max: 40, bonus: 0 };

    const hpBonus = hp.bonus !== undefined ? hp.bonus : 0;
    const mpBonus = mp.bonus !== undefined ? mp.bonus : 0;

    console.log("  >> mapResources - HP:", hp, "bonus utilisé:", hpBonus);
    console.log("  >> mapResources - MP:", mp, "bonus utilisé:", mpBonus);

    return {
      hp: {
        value: hp.value || 0,
        bonus: hpBonus
      },
      mp: {
        value: mp.value || 0,
        bonus: mpBonus
      },
      fp: {
        value: 0
      },
      pronouns: {
        name: ""
      }
    };
  }

  /**
   * Map affinities with FR → EN translation
   * FR: physiques, air, foudre, ténèbres, terre, feu, glace, lumière, poison
   * EN: physical, air, bolt, dark, earth, fire, ice, light, poison
   * @returns {Object}
   */
  mapAffinities() {
    const affinities = this.data.affinities || this.data.system?.affinities || {};
    console.log("  >> mapAffinities - source:", affinities);

    const result = {
      physical: {
        base: affinities.physical?.base || affinities.physiques?.base || 0
      },
      air: {
        base: affinities.air?.base || 0  // "air" est identique en FR et EN
      },
      bolt: {
        base: affinities.bolt?.base || affinities.foudre?.base || 0
      },
      dark: {
        base: affinities.dark?.base || affinities.ténèbres?.base || 0
      },
      earth: {
        base: affinities.earth?.base || affinities.terre?.base || 0
      },
      fire: {
        base: affinities.fire?.base || affinities.feu?.base || 0
      },
      ice: {
        base: affinities.ice?.base || affinities.glace?.base || 0
      },
      light: {
        base: affinities.light?.base || affinities.lumière?.base || 0
      },
      poison: {
        base: affinities.poison?.base || 0  // "poison" est identique en FR et EN
      }
    };

    console.log("  >> mapAffinities - résultat:", result);
    return result;
  }

  /**
   * Map derived stats (init, def, mdef)
   * @returns {Object}
   */
  mapDerivedStats() {
    return {
      init: {
        bonus: this.data.init || 0
      },
      def: {
        bonus: this.data.def || 0
      },
      mdef: {
        bonus: this.data.mdef || 0
      }
    };
  }

  /**
   * Map traits
   * @returns {Object}
   */
  mapTraits() {
    return {
      value: this.data.traits || this.data.system?.traits?.value || ""
    };
  }

  /**
   * Map bonuses structure
   * @returns {Object}
   */
  mapBonuses() {
    return {
      bondStrength: 0,
      incomingRecovery: {
        hp: 0,
        mp: 0,
        ip: 0
      },
      incomingLoss: {
        hp: 0,
        mp: 0,
        ip: 0
      },
      outgoingRecovery: {
        hp: 0,
        mp: 0,
        ip: 0
      },
      accuracy: {
        accuracyCheck: 0,
        accuracyMelee: 0,
        accuracyRanged: 0,
        magicCheck: 0,
        opposedCheck: 0,
        openCheck: 0,
        arcane: 0,
        bow: 0,
        brawling: 0,
        dagger: 0,
        firearm: 0,
        flail: 0,
        heavy: 0,
        spear: 0,
        sword: 0,
        thrown: 0
      },
      incomingDamage: {
        all: 0,
        melee: 0,
        ranged: 0,
        spell: 0,
        arcane: 0,
        bow: 0,
        brawling: 0,
        dagger: 0,
        firearm: 0,
        flail: 0,
        heavy: 0,
        spear: 0,
        sword: 0,
        thrown: 0,
        physical: 0,
        air: 0,
        bolt: 0,
        dark: 0,
        earth: 0,
        fire: 0,
        ice: 0,
        light: 0,
        poison: 0,
        beast: 0,
        construct: 0,
        demon: 0,
        elemental: 0,
        humanoid: 0,
        monster: 0,
        plant: 0,
        undead: 0
      },
      damage: {
        all: 0,
        melee: 0,
        ranged: 0,
        spell: 0,
        arcane: 0,
        bow: 0,
        brawling: 0,
        dagger: 0,
        firearm: 0,
        flail: 0,
        heavy: 0,
        spear: 0,
        sword: 0,
        thrown: 0,
        physical: 0,
        air: 0,
        bolt: 0,
        dark: 0,
        earth: 0,
        fire: 0,
        ice: 0,
        light: 0,
        poison: 0,
        beast: 0,
        construct: 0,
        demon: 0,
        elemental: 0,
        humanoid: 0,
        monster: 0,
        plant: 0,
        undead: 0
      },
      turns: 0
    };
  }

  /**
   * Map multipliers structure
   * @returns {Object}
   */
  mapMultipliers() {
    return {
      incomingRecovery: {
        hp: 0,
        mp: 0,
        ip: 0
      },
      incomingLoss: {
        hp: 0,
        mp: 0,
        ip: 0
      },
      outgoingRecovery: {
        hp: 0,
        mp: 0,
        ip: 0
      }
    };
  }

  /**
   * Map immunities structure
   * @returns {Object}
   */
  mapImmunities() {
    return {
      slow: {
        base: false
      },
      dazed: {
        base: false
      },
      weak: {
        base: false
      },
      shaken: {
        base: false
      },
      enraged: {
        base: false
      },
      poisoned: {
        base: false
      }
    };
  }

  /**
   * Map items to Project FU format with FR → EN translation
   * @returns {Array}
   */
  mapItems() {
    const items = this.data.items || [];
    console.log("  >> mapItems -", items.length, "items à mapper");

    // Tables de traduction FR → EN
    const DAMAGE_TYPE_TRANSLATION = {
      'physiques': 'physical',
      'd\'air': 'air',
      'de foudre': 'bolt',
      'de ténèbres': 'dark',
      'de terre': 'earth',
      'de feu': 'fire',
      'de glace': 'ice',
      'de lumière': 'light',
      'de poison': 'poison'
    };

    const ATTRIBUTE_TRANSLATION = {
      'int': 'ins',  // INT (FR) → INS (EN)
      'pui': 'mig',  // PUI (FR) → MIG (EN)
      'vol': 'wlp'   // VOL (FR) → WLP (EN)
      // 'dex' reste 'dex'
    };

    return items.map(item => {
      if (item.type === 'basic') {
        // Traduire les attributs
        const primaryAttr = item.system.attributes?.primary?.value || 'dex';
        const secondaryAttr = item.system.attributes?.secondary?.value || 'dex';
        const primaryEN = ATTRIBUTE_TRANSLATION[primaryAttr] || primaryAttr;
        const secondaryEN = ATTRIBUTE_TRANSLATION[secondaryAttr] || secondaryAttr;

        // Traduire le type de dégâts
        const damageTypeFR = item.system.damageType?.value || 'physical';
        const damageTypeEN = DAMAGE_TYPE_TRANSLATION[damageTypeFR] || damageTypeFR;

        console.log(`  >> Item "${item.name}": damageType ${damageTypeFR} → ${damageTypeEN}, attrs ${primaryAttr}/${secondaryAttr} → ${primaryEN}/${secondaryEN}`);

        // Attaque de base
        return {
          name: item.name,
          type: 'basic',
          img: 'icons/svg/item-bag.svg',
          system: {
            fuid: 'basique-2',
            description: item.system.description || '',
            summary: {
              value: item.system.summary?.value || item.system.summary || ''
            },
            showTitleCard: {
              value: false
            },
            isBehavior: {
              value: false
            },
            weight: {
              value: 1
            },
            attributes: {
              primary: {
                value: primaryEN
              },
              secondary: {
                value: secondaryEN
              }
            },
            accuracy: {
              value: item.system.accuracy?.value || 0
            },
            defense: 'def',
            damage: {
              value: item.system.damage?.value || 0
            },
            type: {
              value: item.system.type?.value || 'melee'
            },
            damageType: {
              value: damageTypeEN
            },
            cost: {
              value: 100
            },
            quality: {
              value: ''
            },
            rollInfo: {
              useWeapon: {
                hrZero: {
                  value: false
                }
              }
            },
            traits: item.system.traits || [],
            source: ''
          },
          effects: [],
          folder: null,
          sort: 0,
          flags: {
            projectfu: {
              favorite: false
            }
          }
        };
      } else if (item.type === 'rule') {
        // Règle spéciale
        return {
          name: item.name,
          type: 'rule',
          img: 'icons/svg/item-bag.svg',
          system: {
            fuid: 'regle',
            description: item.system.description || '',
            summary: {
              value: item.system.summary?.value || item.system.summary || ''
            },
            showTitleCard: {
              value: false
            },
            isBehavior: {
              value: false
            },
            weight: {
              value: 1
            },
            hasClock: {
              value: false
            },
            progress: {
              current: 0,
              step: 1,
              max: 6,
              enabled: false
            },
            source: ''
          },
          effects: [],
          folder: null,
          sort: 0,
          flags: {
            projectfu: {
              favorite: false
            }
          }
        };
      } else {
        // Autre type d'item, retourner tel quel
        return item;
      }
    });
  }
}
