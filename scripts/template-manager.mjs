/**
 * Import Template Manager v2
 * Handles storage, retrieval, and management of import templates
 * Supports both global (module) and local (world) templates
 */
export class ImportTemplateManager {
  static globalTemplates = {}; // Templates from models/ directory
  static localTemplates = {};  // Templates from world settings

  /**
   * Initialize template storage settings and load templates
   */
  static async initialize() {
    // Register settings for local templates
    game.settings.register('actor-importer', 'localmodel', {
      name: 'Local Templates List',
      hint: 'List of all local template IDs stored in this world',
      scope: 'world',
      config: false,
      type: Array,
      default: []
    });

    // Load templates
    await this.loadGlobalTemplates();
    await this.loadLocalTemplates();
  }

  /**
   * Load global templates from models/ directory
   * @private
   */
  static async loadGlobalTemplates() {
    // List of global template files
    const modelFiles = [
      'daggerheart-standard.json',
      'daggerheart-incredible-creatures.json',
      'fabula-ultima-fr.json'
    ];

    for (const file of modelFiles) {
      try {
        const response = await fetch(`modules/actor-importer/models/${file}`);
        if (!response.ok) {
          console.log(`Global template ${file} not found, skipping`);
          continue;
        }

        const template = await response.json();

        // Validate compatibility with current system
        const compatibleSystems = template.metadata?.compatibleSystems || [];
        if (compatibleSystems.length > 0 && !compatibleSystems.includes(game.system.id)) {
          console.log(`Skipping ${file}: not compatible with ${game.system.id}`);
          continue;
        }

        // Mark as global
        template.metadata.isGlobal = true;

        // Store in cache
        this.globalTemplates[template.metadata.id] = template;

        console.log(`Loaded global template: ${template.metadata.name}`);
      } catch (error) {
        console.error(`Failed to load global template ${file}:`, error);
      }
    }
  }

  /**
   * Load local templates from world settings
   * @private
   */
  static async loadLocalTemplates() {
    try {
      // Get list of local template IDs
      const localIds = game.settings.get('actor-importer', 'localmodel') || [];

      for (const id of localIds) {
        try {
          // Get template data
          const template = game.settings.get('actor-importer', id);

          if (template) {
            this.localTemplates[id] = template;
            console.log(`Loaded local template: ${template.metadata?.name || id}`);
          } else {
            console.warn(`Local template ${id} listed but not found in settings`);
          }
        } catch (error) {
          console.error(`Failed to load local template ${id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load local templates:', error);
    }
  }

  /**
   * Get all templates (global + local) organized by type
   * @returns {Object} {global: Array, local: Array}
   */
  static getAllTemplates() {
    return {
      global: Object.values(this.globalTemplates),
      local: Object.values(this.localTemplates)
    };
  }

  /**
   * Get templates for a specific system
   * @param {string} system - System ID
   * @returns {Object} {global: Array, local: Array}
   */
  static getTemplatesForSystem(system) {
    const global = Object.values(this.globalTemplates).filter(t => {
      const compatible = t.metadata?.compatibleSystems || [];
      return compatible.length === 0 || compatible.includes(system);
    });

    const local = Object.values(this.localTemplates).filter(t => {
      const compatible = t.metadata?.compatibleSystems || [];
      return compatible.length === 0 || compatible.includes(system);
    });

    return {global, local};
  }

  /**
   * Get a specific template by ID
   * @param {string} id - Template ID
   * @param {boolean} isGlobal - Whether to look in global templates
   * @returns {Object|null} Template or null if not found
   */
  static getTemplate(id, isGlobal = false) {
    if (isGlobal) {
      return this.globalTemplates[id] || null;
    } else {
      return this.localTemplates[id] || null;
    }
  }

  /**
   * Save a local template to world settings
   * @param {Object} template - Template data
   */
  static async saveLocalTemplate(template) {
    const id = template.metadata.id;

    // Ensure not global
    template.metadata.isGlobal = false;

    // Update timestamps
    if (!template.metadata.created) {
      template.metadata.created = new Date().toISOString();
    }
    template.metadata.updated = new Date().toISOString();

    // Register setting if needed
    try {
      game.settings.register('actor-importer', id, {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
      });
    } catch (e) {
      // Already registered
    }

    // Save template data
    await game.settings.set('actor-importer', id, template);

    // Update localmodel list
    let localIds = game.settings.get('actor-importer', 'localmodel') || [];
    if (!localIds.includes(id)) {
      localIds.push(id);
      await game.settings.set('actor-importer', 'localmodel', localIds);
    }

    // Update cache
    this.localTemplates[id] = template;

    ui.notifications.info(`Template saved: ${template.metadata.name}`);
    console.log(`Saved local template: ${template.metadata.name} (${id})`);
  }

  /**
   * Delete a local template
   * @param {string} id - Template ID
   */
  static async deleteLocalTemplate(id) {
    // Remove from localmodel list
    let localIds = game.settings.get('actor-importer', 'localmodel') || [];
    localIds = localIds.filter(i => i !== id);
    await game.settings.set('actor-importer', 'localmodel', localIds);

    // Clear template data
    try {
      await game.settings.set('actor-importer', id, {});
    } catch (e) {
      // Ignore error if setting doesn't exist
    }

    // Remove from cache
    const templateName = this.localTemplates[id]?.metadata?.name || id;
    delete this.localTemplates[id];

    ui.notifications.info(`Template deleted: ${templateName}`);
    console.log(`Deleted local template: ${templateName} (${id})`);
  }

  /**
   * Export a template to JSON file
   * @param {Object} template - Template to export
   */
  static exportTemplate(template) {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.metadata.id}.json`;
    a.click();

    URL.revokeObjectURL(url);

    ui.notifications.info(`Template exported: ${template.metadata.name}`);
  }

  /**
   * Import a template from JSON file
   * @param {File} file - The file to import
   * @returns {Promise<Object>} The imported template
   */
  static async importTemplate(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const template = JSON.parse(event.target.result);

          // Validate format
          if (!template.templateFormat || !template.templateFormat.startsWith('fvtt-import-v')) {
            throw new Error('Invalid template format');
          }

          // Validate metadata
          if (!template.metadata || !template.metadata.id) {
            throw new Error('Template missing required metadata');
          }

          // Generate unique ID if conflicts
          let id = template.metadata.id;
          let counter = 1;
          while (this.localTemplates[id] || this.globalTemplates[id]) {
            id = `${template.metadata.id}-${counter}`;
            counter++;
          }
          template.metadata.id = id;

          // Mark as local and imported
          template.metadata.isGlobal = false;
          template.metadata.imported = true;
          delete template.metadata.created; // Will be set by saveLocalTemplate
          template.metadata.updated = new Date().toISOString();

          // Save
          await this.saveLocalTemplate(template);

          ui.notifications.info(`Template imported: ${template.metadata.name}`);
          resolve(template);
        } catch (error) {
          ui.notifications.error(`Import failed: ${error.message}`);
          console.error('Import error:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error('Failed to read file');
        ui.notifications.error(error.message);
        reject(error);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Duplicate a template (useful for "Save As" from global template)
   * @param {Object} sourceTemplate - Source template
   * @param {string} newName - New name for the duplicate
   * @returns {Promise<Object>} The new template
   */
  static async duplicateTemplate(sourceTemplate, newName) {
    const newTemplate = foundry.utils.deepClone(sourceTemplate);

    // Generate new ID
    const baseId = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let id = baseId;
    let counter = 1;
    while (this.localTemplates[id] || this.globalTemplates[id]) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    // Update metadata
    newTemplate.metadata.id = id;
    newTemplate.metadata.name = newName;
    newTemplate.metadata.isGlobal = false;
    delete newTemplate.metadata.created; // Will be set by saveLocalTemplate

    // Save as local
    await this.saveLocalTemplate(newTemplate);

    return newTemplate;
  }

  /**
   * Validate template format
   * @param {Object} template - Template to validate
   * @returns {Object} {valid: boolean, errors: Array<string>}
   */
  static validateTemplate(template) {
    const errors = [];

    // Check format version
    if (!template.templateFormat || !template.templateFormat.startsWith('fvtt-import-v')) {
      errors.push('Invalid or missing templateFormat');
    }

    // Check metadata
    if (!template.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!template.metadata.id) errors.push('Missing metadata.id');
      if (!template.metadata.name) errors.push('Missing metadata.name');
      if (!template.metadata.compatibleSystems || !Array.isArray(template.metadata.compatibleSystems)) {
        errors.push('Missing or invalid metadata.compatibleSystems');
      }
    }

    // Check version
    if (!template.version) {
      errors.push('Missing version');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Migrate old v1 template to v2 format
   * @param {Object} oldTemplate - v1 template
   * @returns {Object} v2 template
   */
  static migrateV1ToV2(oldTemplate) {
    console.log('Migrating template from v1 to v2');

    return {
      templateFormat: 'fvtt-import-v2',
      version: '2.0.0',
      metadata: {
        id: oldTemplate.metadata?.id || 'migrated-template',
        name: oldTemplate.metadata?.name || 'Migrated Template',
        system: oldTemplate.metadata?.system || game.system.id,
        compatibleSystems: oldTemplate.metadata?.system ? [oldTemplate.metadata.system] : [game.system.id],
        author: oldTemplate.metadata?.author || 'Unknown',
        description: oldTemplate.metadata?.description || 'Migrated from v1',
        created: oldTemplate.metadata?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        isGlobal: false
      },
      annotations: [], // v1 didn't have annotations in this format
      constructs: oldTemplate.constructs || {},
      tokens: oldTemplate.tokens || [],
      mappings: [],
      colorData: {}
    };
  }

  /**
   * Clear all local templates (for debugging)
   * WARNING: This deletes all local templates!
   */
  static async clearAllLocalTemplates() {
    const confirmed = await Dialog.confirm({
      title: 'Clear All Local Templates',
      content: '<p><strong>Warning:</strong> This will delete all local templates. Global templates will not be affected.</p><p>Are you sure?</p>',
      defaultYes: false
    });

    if (!confirmed) return;

    const localIds = game.settings.get('actor-importer', 'localmodel') || [];

    for (const id of localIds) {
      try {
        await game.settings.set('actor-importer', id, {});
      } catch (e) {
        // Ignore
      }
    }

    await game.settings.set('actor-importer', 'localmodel', []);

    this.localTemplates = {};

    ui.notifications.warn('All local templates have been cleared');
  }
}
