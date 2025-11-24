import { BaseConverter } from './base-converter.mjs';

/**
 * Converter for Daggerheart system
 * Handles conversion from intermediate format to Daggerheart actor structure
 */
export class DaggerheartConverter extends BaseConverter {
  /**
   * Check if data is already in Daggerheart format
   * @returns {boolean}
   */
  isAlreadyConverted() {
    return !!(this.data.system?.health && this.data.system?.defenses);
  }

  /**
   * Convert intermediate data to Daggerheart actor format
   * Handles translation from source language (FR/EN) to Daggerheart system format
   * @returns {Object} Daggerheart actor data
   */
  convert() {
    console.log("=== DaggerheartConverter - Début ===");
    console.log("Données intermédiaires reçues:", this.data);

    // If already in Daggerheart format, return as-is
    if (this.isAlreadyConverted()) {
      console.log("✓ Données déjà au format Daggerheart, retour direct");
      return this.data;
    }

    // Build Daggerheart actor from intermediate format
    // Note: Daggerheart uses "adversary" instead of "npc"
    const actorType = this.data.type === "npc" ? "adversary" : (this.data.type || "adversary");

    const result = {
      name: this.data.name || "Acteur Importé",
      type: actorType,
      img: this.data.img || "icons/svg/mystery-man.svg",
      system: {
        description: this.mapBiography(),
        tier: this.data.tier || 1,
        difficulty: this.data.difficulty || 14,
        damageThresholds: this.mapThreshold(),
        resources: this.mapResources(),
        attack: this.mapAttack()
      },
      items: this.mapItems()
    };

    console.log("✓ Conversion terminée");
    console.log("Acteur Daggerheart créé:", result);
    console.log("=== DaggerheartConverter - Fin ===");

    return result;
  }

  /**
   * Map biography to HTML format
   * @returns {string}
   */
  mapBiography() {
    const bio = this.data.biography || "";
    const creatureType = this.data.creatureType || "";

    // Construire la biographie avec le type de créature en en-tête si présent
    let bioHTML = "";

    if (creatureType) {
      bioHTML += `<p><strong>Type:</strong> ${creatureType}</p>`;
    }

    if (bio) {
      // Convertir les sauts de ligne en paragraphes HTML
      const lines = bio.split('\n').filter(line => line.trim());
      bioHTML += lines.length > 0 ? `<p>${lines.join('</p><p>')}</p>` : "";
    }

    return bioHTML;
  }

  /**
   * Map health data to Daggerheart format
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
   * Map stress data to Daggerheart format
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
   * Map threshold data to Daggerheart format
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
   * Map resources (HP and Stress) to Daggerheart format
   * @returns {Object}
   */
  mapResources() {
    const health = this.data.health || { value: 0, max: 8 };
    const stress = this.data.stress || { value: 0, max: 3 };

    return {
      hitPoints: {
        value: health.value || 0,
        max: health.max || 8,
        isReversed: true
      },
      stress: {
        value: stress.value || 0,
        max: stress.max || 3,
        isReversed: true
      }
    };
  }

  /**
   * Map attack data to Daggerheart format
   * Uses the first attack from the attacks array
   * @returns {Object}
   */
  mapAttack() {
    const attacks = this.data.attacks || [];
    const attack = attacks[0];

    if (!attack) {
      // Return default attack structure if no attack data
      return {
        name: "Attack",
        range: "melee",
        roll: {
          type: "attack",
          bonus: null
        },
        damage: {
          parts: []
        }
      };
    }

    // Extract dice type from damage string (e.g., "2d8" → "d8")
    const diceMatch = attack.damage.match(/d(\d+)/);
    const diceType = diceMatch ? `d${diceMatch[1]}` : "d6";

    // Translate damage type abbreviation to full name
    const damageType = this.translateDamageType(attack.damageType || "physical");

    // Build damage parts array
    const damageParts = [{
      type: [damageType],
      value: {
        multiplier: "flat",
        flatMultiplier: 1,
        dice: diceType,
        bonus: attack.damageModifier ? parseInt(attack.damageModifier) : null
      },
      applyTo: "hitPoints"
    }];

    return {
      name: attack.name || "Attack",
      range: this.translateRange(attack.range || "melee"),
      roll: {
        type: "attack",
        bonus: attack.toHit || 0
      },
      damage: {
        parts: damageParts
      }
    };
  }

  /**
   * Translate damage type abbreviation to full name
   * @param {string} type - Damage type (e.g., "phy", "mag")
   * @returns {string} Full damage type name
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
   * Translate range from English to Daggerheart format
   * @param {string} range - Range in English (e.g., "Very Close", "Close", "Far", "Melee")
   * @returns {string} Daggerheart range format
   */
  translateRange(range) {
    const rangeMap = {
      'melee': 'melee',            // Incredible Creatures format
      'very close': 'melee',       // Standard format
      'close': 'close',
      'far': 'ranged',
      'very far': 'veryFar',
      'ranged': 'ranged',          // Incredible Creatures format
      'très proche': 'melee',
      'proche': 'close',
      'loin': 'ranged',
      'très loin': 'veryFar'
    };

    return rangeMap[range.toLowerCase()] || 'melee';
  }

  /**
   * Map defenses data to Daggerheart format
   * @returns {Object}
   */
  mapDefenses() {
    const existing = this.data.system?.defenses;
    if (existing) return existing;

    const evasion = this.data.evasion || this.data.difficulty || 14;
    return {
      evasion: {
        baseValue: evasion,
        value: evasion
      },
      armor: {
        baseValue: 0,
        value: 0
      },
      "armor-slots": {
        value: 0,
        max: 6
      }
    };
  }

  /**
   * Map weapon data to Daggerheart format from attacks array
   * @param {string} slot - 'main' or 'off'
   * @returns {Object}
   */
  mapWeapon(slot) {
    const attacks = this.data.attacks || [];

    // For main weapon, use first attack; for off weapon, use second (if exists)
    const attack = slot === 'main' ? attacks[0] : attacks[1];

    if (attack) {
      // Build damage string with modifier
      let damageValue = attack.damage;
      if (attack.damageModifier) {
        damageValue += ` ${attack.damageModifier}`;
      }

      // Build modifiers array if there's a damage modifier
      const modifiers = attack.damageModifier ? [
        {
          name: attack.damageType || "",
          value: attack.damageModifier,
          enabled: true
        }
      ] : [];

      return {
        name: attack.name || "",
        description: `${attack.range || ""} | ${attack.damageType || ""}`,
        damage: {
          baseValue: attack.damage || "1d8",
          modifiers: modifiers,
          permanentModifiers: [],
          value: damageValue
        },
        "to-hit": {
          baseValue: 0,
          modifiers: [],
          permanentModifiers: [],
          value: attack.toHit || 0
        },
        range: attack.range || "",
        modifier: "",
        dmgType: attack.damageType || ""
      };
    }

    // Default empty weapon
    return {
      name: slot === 'main' ? "Attaque:" : "",
      description: slot === 'main' ? "Close" : "Range | 1H | Trait",
      damage: {
        baseValue: "1d8",
        modifiers: [],
        permanentModifiers: [],
        value: "1d8"
      },
      "to-hit": {
        baseValue: 0,
        modifiers: [],
        permanentModifiers: [],
        value: 0
      },
      range: slot === 'main' ? "Close" : "",
      modifier: "",
      dmgType: ""
    };
  }

  /**
   * Map items (experiences and features) to Daggerheart items with translation
   * Translates action types from FR to EN: "Réaction" → "Reaction", "Passif" → "Passive"
   * @returns {Array}
   */
  mapItems() {
    const items = [];
    console.log("  >> mapItems - début");

    // Table de traduction pour les types d'action FR → EN
    const ACTION_TYPE_TRANSLATION = {
      'réaction': 'Reaction',
      'passif': 'Passive',
      'action': 'Action',
      'reaction': 'Reaction',
      'passive': 'Passive'
    };

    // Mapper les expériences
    const experiences = this.data.experiences || [];
    experiences.forEach(exp => {
      const description = `${exp.name} ${exp.bonus}${exp.description ? ' ' + exp.description : ''}`;
      items.push({
        name: exp.name,
        type: "feature",  // Daggerheart uses "feature" not "item"
        img: "icons/svg/item-bag.svg",
        system: {
          description: `<p>${description}</p>`,
          category: "Experience",
          rarity: Math.abs(parseInt(exp.bonus)).toString(),
          location: "backpack"
        }
      });
      console.log(`  >> Experience: ${exp.name} (${exp.bonus})`);
    });

    // Mapper les features avec traduction des types d'action
    const features = this.data.features || [];
    features.forEach(feature => {
      // Traduire le type d'action si nécessaire
      if (!feature.actionType) {
        console.warn(`  ⚠️ Feature "${feature.name}" n'a pas de actionType défini, utilisation de "Passive" par défaut`);
        feature.actionType = 'Passive';
      }
      const actionTypeLower = feature.actionType.toLowerCase();
      const actionType = ACTION_TYPE_TRANSLATION[actionTypeLower] || feature.actionType;

      items.push({
        name: feature.name,
        type: "feature",  // Daggerheart uses "feature" not "item"
        img: "icons/svg/item-bag.svg",
        system: {
          description: `<p>${feature.description}</p>`,
          category: actionType,  // Traduit en anglais
          rarity: feature.uses || "",
          location: actionType.toLowerCase() === 'passive' ? 'passives' : 'backpack'
        }
      });
      console.log(`  >> Feature: ${feature.name} (${feature.actionType} → ${actionType})`);
    });

    console.log(`  >> mapItems - fin, ${items.length} items créés`);
    return items;
  }
}
