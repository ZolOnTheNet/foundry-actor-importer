/**
 * Save Template Modal
 * Modal for saving and configuring import templates
 */
export class SaveTemplateModal extends FormApplication {
  constructor(options) {
    super({}, options);
    this.annotations = options.annotations;
    this.sourceText = options.sourceText;
    this.callback = options.callback;
    this.existingTemplate = options.template || null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'save-template',
      classes: ['actor-importer', 'save-template-modal'],
      template: 'modules/actor-importer/templates/save-modal.html',
      width: 600,
      height: 'auto',
      title: game.i18n.localize('ACTOR_IMPORTER.SaveTemplate.Title'),
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    });
  }

  getData() {
    const systems = this._getAvailableSystems();
    const suggestedId = this._generateId();

    return {
      systems: systems,
      suggestedId: suggestedId,
      isEdit: !!this.existingTemplate,
      template: this.existingTemplate || {
        metadata: {
          name: '',
          description: '',
          system: systems[0]?.id || 'other',
          author: game.user.name
        }
      }
    };
  }

  /**
   * Get list of available systems
   * @private
   */
  _getAvailableSystems() {
    // Get all installed game systems
    const installedSystems = Array.from(game.systems.values()).map(sys => ({
      id: sys.id,
      name: sys.title
    }));

    // Add common systems that might not be installed
    const commonSystems = [
      {id: 'daggerheart', name: 'Daggerheart'},
      {id: 'dnd5e', name: 'D&D 5e'},
      {id: 'pf2e', name: 'Pathfinder 2e'},
      {id: 'projectfu', name: 'Project FU'},
      {id: 'other', name: 'Other/Generic'}
    ];

    // Merge and deduplicate
    const systemMap = new Map();
    for (const sys of [...installedSystems, ...commonSystems]) {
      if (!systemMap.has(sys.id)) {
        systemMap.set(sys.id, sys);
      }
    }

    return Array.from(systemMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Generate a unique template ID
   * @private
   */
  _generateId() {
    if (this.existingTemplate) {
      return this.existingTemplate.metadata.id;
    }
    return `template-${Date.now()}`;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Auto-generate ID from name
    html.find('#template-name').on('input', this._onNameChange.bind(this));

    // Export button
    html.find('#export-only').on('click', this._onExportOnly.bind(this));
  }

  /**
   * Handle name change to update ID
   * @private
   */
  _onNameChange(event) {
    if (this.existingTemplate) {
      return; // Don't change ID for existing templates
    }

    const name = event.target.value;
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    this.element.find('#template-id').val(id || `template-${Date.now()}`);
  }

  /**
   * Handle export only (without saving)
   * @private
   */
  async _onExportOnly(event) {
    event.preventDefault();

    const formData = this._getSubmitData();
    const metadata = {
      id: formData.id,
      system: formData.system,
      name: formData.name,
      description: formData.description,
      author: formData.author || game.user.name,
      version: formData.version || '1.0.0'
    };

    if (this.callback) {
      const template = await this.callback(metadata, true); // true = export only

      if (template) {
        this._exportTemplate(template);
      }
    }
  }

  /**
   * Export template to JSON file
   * @private
   */
  _exportTemplate(template) {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.metadata.id}.fvtt-template.json`;
    a.click();

    URL.revokeObjectURL(url);

    ui.notifications.info(`Template "${template.metadata.name}" exported`);
  }

  async _updateObject(event, formData) {
    const metadata = {
      id: formData.id,
      system: formData.system,
      name: formData.name,
      description: formData.description,
      author: formData.author || game.user.name,
      version: formData.version || '1.0.0'
    };

    // Validate required fields
    if (!metadata.name) {
      ui.notifications.error('Template name is required');
      return;
    }

    if (!metadata.id) {
      ui.notifications.error('Template ID is required');
      return;
    }

    // Call the callback
    if (this.callback) {
      await this.callback(metadata, false); // false = save
    }
  }
}
