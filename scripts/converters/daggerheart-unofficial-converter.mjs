import { BaseConverter } from './base-converter.mjs';

/**
 * Converter for Daggerheart Unofficial system
 * Uses different type names than official Daggerheart:
 * - Actor type: "npc" instead of "adversary"
 * - Item types: "item" and "passive" instead of "feature"
 */
export class DaggerheartUnofficialConverter extends BaseConverter {
  /**
   * Check if data is already in Daggerheart UO format
   * @returns {boolean}
   */
  isAlreadyConverted() {
    return !!(this.data.system?.health && this.data.system?.threshold && this.data.type === 'npc');
  }

  /**
   * Convert intermediate data to Daggerheart Unofficial actor format
   * @returns {Object} Daggerheart UO actor data
   */
  convert() {
    console.log("=== DaggerheartUnofficialConverter - Début ===");
    console.log("Données intermédiaires reçues:", this.data);

    if (this.isAlreadyConverted()) {
      console.log("✓ Données déjà au format Daggerheart UO, retour direct");
      return this.data;
    }

    // Build Daggerheart UO actor from intermediate format
    // IMPORTANT: Daggerheart UO uses "npc" not "adversary"
    const actorType = "npc";

    const result = {
      name: this.data.name || "Acteur Importé",
      type: actorType,
      img: this.data.img || "icons/svg/mystery-man.svg",
      system: {
        biography: this.mapBiography(),
        health: this.mapHealth(),
        stress: this.mapStress(),
        threshold: this.mapThreshold(),
        defenses: this.mapDefenses(),
        'weapon-main': this.mapWeapon('main'),
        'weapon-off': this.mapWeapon('off')
      },
      items: this.mapItems()
    };

    console.log("✓ Conversion terminée");
    console.log("Acteur Daggerheart UO créé:", result);
    console.log("=== DaggerheartUnofficialConverter - Fin ===");

    return result;
  }

  /**
   * Map biography to HTML format with Tier and Creature Type
   * @returns {string}
   */
  mapBiography() {
    const bio = this.data.biography || "";
    const creatureType = this.data.creatureType || "";
    const tier = this.data.tier || 1;

    let bioHTML = "";

    // Add Tier and Creature Type as header if present
    if (tier || creatureType) {
      const tierText = tier ? `Tier ${tier}` : "";
      const typeText = creatureType || "";
      const headerParts = [tierText, typeText].filter(p => p);

      if (headerParts.length > 0) {
        bioHTML += `<p><strong>${headerParts.join(' ')}</strong></p>`;
      }
    }

    // Add biography content
    if (bio) {
      const lines = bio.split('\n').filter(line => line.trim());
      bioHTML += lines.length > 0 ? `<p>${lines.join('</p><p>')}</p>` : "";
    }

    return bioHTML;
  }

  /**
   * Map health to Daggerheart UO format
   * @returns {Object}
   */
  mapHealth() {
    const health = this.data.health || { value: 0, max: 8 };
    return {
      value: health.value || 0,
      min: 0,
      max: health.max || 8
    };
  }

  /**
   * Map stress to Daggerheart UO format
   * @returns {Object}
   */
  mapStress() {
    const stress = this.data.stress || { value: 0, max: 3 };
    return {
      value: stress.value || 0,
      min: 0,
      max: stress.max || 3
    };
  }

  /**
   * Map threshold data to Daggerheart UO format
   * @returns {Object}
   */
  mapThreshold() {
    const thresholds = this.data.thresholds || { major: 8, severe: 15 };
    return {
      major: thresholds.major || 8,
      severe: thresholds.severe || 15
    };
  }

  /**
   * Map defenses to Daggerheart UO format
   * @returns {Object}
   */
  mapDefenses() {
    const difficulty = this.data.difficulty || 14;
    return {
      evasion: {
        value: difficulty,
        baseValue: difficulty,
        modifiers: [],
        permanentModifiers: []
      },
      armor: {
        value: 0,
        baseValue: 0,
        modifiers: [],
        permanentModifiers: []
      },
      'armor-slots': {
        value: 0,
        max: 0
      }
    };
  }

  /**
   * Map weapon data to Daggerheart UO format
   * @param {string} slot - 'main' or 'off'
   * @returns {Object}
   */
  mapWeapon(slot) {
    const attacks = this.data.attacks || [];
    const attack = slot === 'main' ? attacks[0] : attacks[1];

    if (!attack) {
      // Default weapon
      return {
        name: "Fist",
        range: "melee",
        dmgType: "physical",
        modifier: "",
        description: "Range | 1H | Trait",
        'to-hit': {
          value: "1d6",
          baseValue: "1d6",
          modifiers: [],
          permanentModifiers: []
        },
        damage: {
          value: "1d6",
          baseValue: "1d6",
          modifiers: [],
          permanentModifiers: []
        }
      };
    }

    // Build damage string: "1d8+3"
    let damageValue = attack.damage || "1d6";
    if (attack.damageModifier) {
      damageValue += attack.damageModifier; // already includes + or -
    }

    // Build to-hit values
    // baseValue = modificateur avec signe ("+1")
    // value = valeur numérique sans signe ("1")
    let toHitBase = "1d6";
    let toHitVal = "1d6";

    if (attack.toHit !== undefined) {
      const bonus = attack.toHit;
      toHitBase = bonus >= 0 ? `+${bonus}` : `${bonus}`;  // "+1" ou "-1"
      toHitVal = `${Math.abs(bonus)}`;  // "1" (valeur absolue)
    }

    return {
      name: attack.name || "Attack",
      range: this.translateRange(attack.range || "melee"),
      dmgType: this.translateDamageType(attack.damageType || "physical"),
      modifier: "",
      description: `${attack.range || "Melee"}`,
      'to-hit': {
        value: toHitVal,        // "1" (sans signe)
        baseValue: toHitBase,   // "+1" (avec signe)
        modifiers: [],
        permanentModifiers: []
      },
      damage: {
        value: damageValue,
        baseValue: damageValue,
        modifiers: [],
        permanentModifiers: []
      }
    };
  }

  /**
   * Translate damage type abbreviation to full name
   * @param {string} type - Damage type
   * @returns {string}
   */
  translateDamageType(type) {
    const typeMap = {
      'phy': 'physical',
      'mag': 'magical',
      'physical': 'physical',
      'magical': 'magical'
    };
    return typeMap[type.toLowerCase()] || 'physical';
  }

  /**
   * Translate range to Daggerheart format
   * @param {string} range - Range
   * @returns {string}
   */
  translateRange(range) {
    const rangeMap = {
      'melee': 'melee',
      'very close': 'melee',
      'close': 'close',
      'far': 'ranged',
      'very far': 'veryFar',
      'ranged': 'ranged',
      'très proche': 'melee',
      'proche': 'close',
      'loin': 'ranged',
      'très loin': 'veryFar'
    };
    return rangeMap[range.toLowerCase()] || 'melee';
  }

  /**
   * Map items to Daggerheart UO format
   * IMPORTANT: Uses "item" and "passive" types, NOT "feature"
   * @returns {Array}
   */
  mapItems() {
    const items = [];
    console.log("  >> mapItems - début");

    const ACTION_TYPE_TRANSLATION = {
      'réaction': 'Reaction',
      'passif': 'Passive',
      'action': 'Action',
      'reaction': 'Reaction',
      'passive': 'Passive'
    };

    // Map experiences as items
    const experiences = this.data.experiences || [];
    experiences.forEach(exp => {
      const description = `${exp.name} ${exp.bonus}${exp.description ? ' ' + exp.description : ''}`;
      items.push({
        name: exp.name,
        type: "item",  // Use "item" type
        img: "icons/svg/item-bag.svg",
        system: {
          description: `<p>${description}</p>`,
          rarity: Math.abs(parseInt(exp.bonus)).toString(),
          location: "backpack"  // NPCs use "backpack", not "abilities"
        }
      });
      console.log(`  >> Experience: ${exp.name} (${exp.bonus})`);
    });

    // Map features with proper types
    const features = this.data.features || [];
    features.forEach(feature => {
      if (!feature.actionType) {
        console.warn(`  ⚠️ Feature "${feature.name}" sans actionType, défaut à "Passive"`);
        feature.actionType = 'Passive';
      }

      const actionTypeLower = feature.actionType.toLowerCase();
      const actionType = ACTION_TYPE_TRANSLATION[actionTypeLower] || feature.actionType;

      // Use "passive" type for Passive features, "item" for others
      const itemType = actionType === 'Passive' ? 'passive' : 'item';
      // IMPORTANT: NPCs use "backpack" for items, not "abilities"
      const location = actionType === 'Passive' ? 'passives' : 'backpack';

      items.push({
        name: feature.name,
        type: itemType,  // "passive" or "item"
        img: "icons/svg/item-bag.svg",
        system: {
          description: `<p><strong>${actionType}:</strong> ${feature.description}</p>`,
          rarity: feature.uses || "",
          location: location  // "passives" or "backpack"
        }
      });
      console.log(`  >> Feature: ${feature.name} (${feature.actionType} → ${actionType}, type: ${itemType}, location: ${location})`);
    });

    console.log(`  >> mapItems - fin, ${items.length} items créés`);
    return items;
  }
}
