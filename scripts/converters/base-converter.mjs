/**
 * Base converter class for converting intermediate data to Foundry actor format
 * All system-specific converters should extend this class
 */
export class BaseConverter {
  constructor(intermediateData) {
    this.data = intermediateData;
  }

  /**
   * Convert intermediate data to Foundry actor format
   * This is the generic implementation used by "Other" systems
   * @returns {Object} Foundry actor data
   */
  convert() {
    return {
      name: this.data.name || "Acteur Importé",
      type: this.data.type || "npc",
      img: this.data.img || "icons/svg/mystery-man.svg",
      system: {
        biography: this.data.system?.biography || this.data.biography || ""
      },
      items: this.data.items || []
    };
  }

  /**
   * Helper method to safely get nested properties
   * @param {Object} obj - Source object
   * @param {string} path - Dot-notation path (e.g., "system.health.max")
   * @param {*} defaultValue - Default value if path doesn't exist
   * @returns {*} Value at path or default
   */
  getNestedProperty(obj, path, defaultValue = null) {
    return path.split('.').reduce((current, key) =>
      current?.[key] !== undefined ? current[key] : defaultValue, obj);
  }

  /**
   * Helper method to check if data is already in target format
   * Override in subclasses for system-specific detection
   * @returns {boolean}
   */
  isAlreadyConverted() {
    return false;
  }
}
