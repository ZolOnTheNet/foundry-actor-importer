import { DaggerheartConverter } from './daggerheart-converter.mjs';

/**
 * Converter for Daggerheart Unofficial system
 * Currently uses the same logic as official Daggerheart
 * Can be extended in the future for system-specific differences
 */
export class DaggerheartUnofficialConverter extends DaggerheartConverter {
  /**
   * Convert intermediate data to Daggerheart Unofficial actor format
   * For now, uses the same conversion as official Daggerheart
   * Override methods below if Unofficial has specific requirements
   * @returns {Object} Daggerheart Unofficial actor data
   */
  convert() {
    // Use parent Daggerheart conversion
    const actorData = super.convert();

    // TODO: Add any Daggerheart Unofficial-specific modifications here
    // Example:
    // actorData.system.unofficialFeature = this.mapUnofficialFeature();

    return actorData;
  }

  // Add Unofficial-specific mapping methods here if needed
  // Example:
  // mapUnofficialFeature() {
  //   return { /* ... */ };
  // }
}
