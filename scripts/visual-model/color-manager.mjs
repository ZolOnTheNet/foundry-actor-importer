/**
 * Color Manager for Visual Model Builder
 * Generates and manages distinct HSL colors for token visualization
 *
 * @author Actor Importer Module
 * @version 2.0.0
 */
export class ColorManager {
  constructor() {
    this.colorIndex = 0;
    this.tokenColors = new Map(); // tokenId → {background, border}
    this.maxColors = 12; // Maximum distinct colors before cycling
  }

  /**
   * Generate HSL color for a given index
   * Uses hue rotation to create visually distinct colors
   *
   * @param {number} index - Index for color generation (0-11)
   * @returns {string} HSL color string
   */
  generateColor(index) {
    const normalizedIndex = index % this.maxColors;
    const hue = (normalizedIndex * 30) % 360; // 12 colors: 0°, 30°, 60°, ..., 330°
    const saturation = 70; // Consistent saturation
    const lightness = 85; // Light background suitable for text overlay

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Get darker shade of an HSL color for borders
   * Reduces lightness by 30% to create contrast
   *
   * @param {string} hslColor - HSL color string
   * @returns {string} Darker HSL color string
   */
  getDarkerShade(hslColor) {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);

    if (match) {
      const [, h, s, l] = match;
      const darkerLightness = Math.max(0, parseInt(l) - 30);
      return `hsl(${h}, ${s}%, ${darkerLightness}%)`;
    }

    // Fallback if regex doesn't match
    return hslColor;
  }

  /**
   * Assign a unique color to a token
   * If token already has a color, returns existing color
   *
   * @param {string} tokenId - Unique identifier for the token
   * @returns {object} Color object {background, border}
   */
  assignColor(tokenId) {
    // Return existing color if already assigned
    if (this.tokenColors.has(tokenId)) {
      return this.tokenColors.get(tokenId);
    }

    // Generate new color
    const bgColor = this.generateColor(this.colorIndex);
    const borderColor = this.getDarkerShade(bgColor);

    const colors = {
      background: bgColor,
      border: borderColor
    };

    // Store and increment
    this.tokenColors.set(tokenId, colors);
    this.colorIndex++;

    return colors;
  }

  /**
   * Get color for a specific token
   *
   * @param {string} tokenId - Token identifier
   * @returns {object|null} Color object or null if not found
   */
  getColor(tokenId) {
    return this.tokenColors.get(tokenId) || null;
  }

  /**
   * Get color for "Next" separator tokens
   * Uses a neutral gray color instead of the cycling HSL colors
   *
   * @returns {object} Color object {background, border}
   */
  getNextColor() {
    return {
      background: '#e8e8e8',
      border: '#999999'
    };
  }

  /**
   * Get color for unmapped fields (fields not in system schema)
   * Uses a faded gray to indicate they will be ignored
   *
   * @returns {object} Color object {background, border}
   */
  getUnmappedColor() {
    return {
      background: '#e0e0e0',
      border: '#aaaaaa'
    };
  }

  /**
   * Reset all color assignments
   * Useful when clearing annotations or starting fresh
   */
  reset() {
    this.colorIndex = 0;
    this.tokenColors.clear();
  }

  /**
   * Get total number of colors assigned
   *
   * @returns {number} Number of unique token colors
   */
  getColorCount() {
    return this.tokenColors.size;
  }

  /**
   * Export color mappings for template serialization
   *
   * @returns {object} Map of tokenId → colors
   */
  export() {
    const exported = {};
    for (const [tokenId, colors] of this.tokenColors.entries()) {
      exported[tokenId] = colors;
    }
    return exported;
  }

  /**
   * Import color mappings from template
   *
   * @param {object} colorData - Map of tokenId → colors
   */
  import(colorData) {
    this.reset();

    if (!colorData) return;

    for (const [tokenId, colors] of Object.entries(colorData)) {
      this.tokenColors.set(tokenId, colors);
    }

    // Update color index to continue from where we left off
    this.colorIndex = this.tokenColors.size;
  }

  /**
   * Preview all available colors
   * Useful for debugging and design validation
   *
   * @returns {array} Array of color objects
   */
  getAllColors() {
    const colors = [];
    for (let i = 0; i < this.maxColors; i++) {
      const bg = this.generateColor(i);
      const border = this.getDarkerShade(bg);
      colors.push({ index: i, background: bg, border: border });
    }
    return colors;
  }
}
