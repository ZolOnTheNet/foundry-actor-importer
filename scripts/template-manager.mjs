/**
 * Import Template Manager
 * Handles storage, retrieval, and management of import templates
 */
export class ImportTemplateManager {
  /**
   * Initialize template storage settings
   */
  static initialize() {
    game.settings.register('actor-importer', 'templates', {
      name: 'Import Templates',
      hint: 'Stored import templates for actor creation',
      scope: 'world',
      config: false,
      type: Object,
      default: {}
    });
  }

  /**
   * Get all templates for a specific system
   * @param {string} system - The target system ID (e.g., 'daggerheart')
   * @returns {Object} Object containing all templates for the system
   */
  static getTemplates(system) {
    const allTemplates = game.settings.get('actor-importer', 'templates');
    return allTemplates[system] || {};
  }

  /**
   * Get all templates across all systems
   * @returns {Object} All stored templates
   */
  static getAllTemplates() {
    return game.settings.get('actor-importer', 'templates');
  }

  /**
   * Get a specific template
   * @param {string} system - The target system ID
   * @param {string} templateId - The template ID
   * @returns {Object|null} The template or null if not found
   */
  static getTemplate(system, templateId) {
    const templates = this.getTemplates(system);
    return templates[templateId] || null;
  }

  /**
   * Save a template
   * @param {string} system - The target system ID
   * @param {string} templateId - The template ID
   * @param {Object} template - The template data
   */
  static async saveTemplate(system, templateId, template) {
    const allTemplates = game.settings.get('actor-importer', 'templates');

    if (!allTemplates[system]) {
      allTemplates[system] = {};
    }

    // Update metadata
    if (!template.metadata.created) {
      template.metadata.created = new Date().toISOString();
    }
    template.metadata.updated = new Date().toISOString();

    allTemplates[system][templateId] = template;

    await game.settings.set('actor-importer', 'templates', allTemplates);

    ui.notifications.info(`Template "${template.metadata.name}" saved successfully`);
  }

  /**
   * Delete a template
   * @param {string} system - The target system ID
   * @param {string} templateId - The template ID
   */
  static async deleteTemplate(system, templateId) {
    const allTemplates = game.settings.get('actor-importer', 'templates');

    if (allTemplates[system] && allTemplates[system][templateId]) {
      const templateName = allTemplates[system][templateId].metadata.name;
      delete allTemplates[system][templateId];

      await game.settings.set('actor-importer', 'templates', allTemplates);

      ui.notifications.info(`Template "${templateName}" deleted successfully`);
      return true;
    }

    return false;
  }

  /**
   * Export a template to JSON file
   * @param {string} system - The target system ID
   * @param {string} templateId - The template ID
   */
  static exportTemplate(system, templateId) {
    const template = this.getTemplate(system, templateId);

    if (!template) {
      ui.notifications.error('Template not found');
      return;
    }

    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateId}.fvtt-template.json`;
    a.click();

    URL.revokeObjectURL(url);

    ui.notifications.info(`Template "${template.metadata.name}" exported successfully`);
  }

  /**
   * Import a template from JSON file
   * @param {File} file - The file to import
   * @returns {Promise<Object>} The imported template
   */
  static async importTemplate(file) {
    try {
      const text = await file.text();
      const template = JSON.parse(text);

      // Validate template format
      if (template.templateFormat !== 'fvtt-import-v1') {
        throw new Error('Invalid template format');
      }

      // Validate required fields
      if (!template.metadata || !template.metadata.id || !template.metadata.system) {
        throw new Error('Template missing required metadata');
      }

      const system = template.metadata.system;
      const templateId = template.metadata.id;

      await this.saveTemplate(system, templateId, template);

      return template;
    } catch (error) {
      console.error('Error importing template:', error);
      ui.notifications.error(`Failed to import template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Duplicate a template with a new ID
   * @param {string} system - The target system ID
   * @param {string} templateId - The source template ID
   * @param {string} newName - The name for the duplicated template
   * @returns {Promise<string>} The new template ID
   */
  static async duplicateTemplate(system, templateId, newName) {
    const template = this.getTemplate(system, templateId);

    if (!template) {
      ui.notifications.error('Template not found');
      return null;
    }

    const newTemplate = foundry.utils.deepClone(template);
    const newId = `${templateId}-copy-${Date.now()}`;

    newTemplate.metadata.id = newId;
    newTemplate.metadata.name = newName || `${template.metadata.name} (Copy)`;
    newTemplate.metadata.version = '1.0.0';
    delete newTemplate.metadata.created;
    delete newTemplate.metadata.updated;

    await this.saveTemplate(system, newId, newTemplate);

    return newId;
  }

  /**
   * Get available systems (systems that have templates)
   * @returns {Array<string>} Array of system IDs
   */
  static getAvailableSystems() {
    const allTemplates = this.getAllTemplates();
    return Object.keys(allTemplates).filter(system =>
      Object.keys(allTemplates[system]).length > 0
    );
  }

  /**
   * Validate a template structure
   * @param {Object} template - The template to validate
   * @returns {Object} {valid: boolean, errors: Array<string>}
   */
  static validateTemplate(template) {
    const errors = [];

    // Check format version
    if (!template.templateFormat || template.templateFormat !== 'fvtt-import-v1') {
      errors.push('Invalid or missing templateFormat');
    }

    // Check metadata
    if (!template.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!template.metadata.id) errors.push('Missing metadata.id');
      if (!template.metadata.system) errors.push('Missing metadata.system');
      if (!template.metadata.name) errors.push('Missing metadata.name');
    }

    // Check tokens
    if (!template.tokens || !Array.isArray(template.tokens)) {
      errors.push('Missing or invalid tokens array');
    } else if (template.tokens.length === 0) {
      errors.push('Template must have at least one token');
    }

    // Validate each token
    template.tokens?.forEach((token, index) => {
      if (!token.mode) {
        errors.push(`Token ${index}: missing mode`);
      }

      if (!token.skip && !token.field && token.mode !== 'list' && token.mode !== 'construct') {
        errors.push(`Token ${index}: must have either 'field' or 'skip' property`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
