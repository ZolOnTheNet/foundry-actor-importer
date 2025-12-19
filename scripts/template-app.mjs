import { ImportTemplateManager } from './template-manager.mjs';
import { TemplateParser } from './template-parser.mjs';
import { ConstructEditorModal } from './modals/construct-editor-modal.mjs';
import { SaveTemplateModal } from './modals/save-template-modal.mjs';
import { ColorManager } from './visual-model/color-manager.mjs';

/**
 * Import Template Application
 * Main UI for creating and applying import templates
 */
export class ImportTemplateApp extends Application {
  constructor(options = {}) {
    super(options);

    this.mode = 'create'; // 'create' or 'apply'
    this.currentTemplate = null;
    this.currentSystem = options.system || 'daggerheart';
    this.annotations = [];
    this.sourceText = '';
    this.selectedRange = null;
    this.constructs = {};
    this.eraserMode = false;
    this.colorManager = new ColorManager(); // Color management for tokens
    this.fieldColors = new Map(); // Map field name → colors for button styling
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'import-template-app',
      classes: ['actor-importer', 'import-template-app'],
      template: 'modules/actor-importer/templates/template-creator.html',
      width: 1200,
      height: 800,
      resizable: true,
      title: game.i18n.localize('ACTOR_IMPORTER.TemplateCreator.Title')
    });
  }

  getData() {
    const allTemplates = ImportTemplateManager.getTemplatesForSystem(this.currentSystem);

    // Format templates for dropdown with global/local separation
    const globalTemplates = allTemplates.global.map(t => ({
      id: `global:${t.metadata.id}`,
      name: `${t.metadata.name} (global)`,
      isGlobal: true
    }));

    const localTemplates = allTemplates.local.map(t => ({
      id: `local:${t.metadata.id}`,
      name: t.metadata.name,
      isGlobal: false
    }));

    return {
      mode: this.mode,
      currentSystem: this.currentSystem,
      globalTemplates: globalTemplates,
      localTemplates: localTemplates,
      currentTemplate: this.currentTemplate,
      currentTemplateName: this.currentTemplate?.metadata?.name?.replace(' (global)', '') || '',
      isGlobalTemplate: this.currentTemplate?.metadata?.isGlobal || false,
      sourceText: this.sourceText,
      annotatedHtml: this._generateAnnotatedHtml(),
      systemFields: this._getSystemFields(),
      hasAnnotations: this.annotations.length > 0
    };
  }

  /**
   * Get available fields for the current system
   * @private
   */
  _getSystemFields() {
    // Define common fields for different systems
    const fieldSets = {
      daggerheart: [
        'name', 'tier', 'type', 'description', 'motives',
        'difficulty', 'threshold.major', 'threshold.severe',
        'health.max', 'stress.max',
        'weapon.name', 'weapon.tohit', 'weapon.range', 'weapon.damage',
        'experience.name', 'experience.value'
      ],
      dnd5e: [
        'name', 'type', 'size', 'alignment',
        'ac', 'hp', 'speed',
        'str', 'dex', 'con', 'int', 'wis', 'cha',
        'cr', 'xp'
      ],
      projectfu: [
        'name', 'species', 'level', 'traits',
        'dex', 'ins', 'mig', 'wlp',
        'hp.max', 'mp.max', 'ip.max',
        'defense', 'mdef'
      ],
      other: [
        'name', 'type', 'description',
        'value1', 'value2', 'value3'
      ]
    };

    return fieldSets[this.currentSystem] || fieldSets.other;
  }

  /**
   * Check if a field exists in the current system schema
   * Fields are considered valid if they are in the known fields list
   * @private
   * @param {string} field - Field path to check
   * @returns {boolean} True if field exists in system
   */
  _fieldExistsInSystem(field) {
    if (!field) return true; // No field means it's a special annotation (skip, construct)

    const knownFields = this._getSystemFields();

    // Check if field is in the known fields list
    return knownFields.includes(field);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Mode switching
    html.find('#mode-select').on('change', this._onModeChange.bind(this));
    html.find('#template-select').on('change', this._onTemplateSelect.bind(this));
    html.find('#system-select').on('change', this._onSystemChange.bind(this));

    // Text editing
    html.find('#paste-text').on('click', this._onPasteText.bind(this));
    html.find('#refresh-view').on('click', this._onRefreshView.bind(this));
    html.find('#clear-text').on('click', this._onClearText.bind(this));
    html.find('#source-text').on('mouseup', this._onTextSelection.bind(this));
    html.find('#source-text').on('input', this._onSourceTextChange.bind(this));
    html.find('#source-text').on('paste', this._onSourceTextPaste.bind(this));

    // Field buttons
    html.find('.field-btn').on('click', this._onFieldButton.bind(this));

    // Tool buttons
    html.find('#tool-skip').on('click', this._onSkipTool.bind(this));
    html.find('#tool-multiline').on('click', this._onMultilineTool.bind(this));
    html.find('#tool-construct').on('click', this._onConstructTool.bind(this));
    html.find('#tool-list').on('click', this._onListTool.bind(this));
    html.find('#tool-transform').on('click', this._onTransformTool.bind(this));
    html.find('#tool-eraser').on('click', this._onEraserTool.bind(this));

    // Template name input
    html.find('#template-name').on('input', this._onTemplateNameChange.bind(this));

    // Template actions
    html.find('#save-template').on('click', this._onSaveTemplate.bind(this));
    html.find('#save-as-template').on('click', this._onSaveAsTemplate.bind(this));
    html.find('#test-template').on('click', this._onTestTemplate.bind(this));
    html.find('#apply-template').on('click', this._onApplyTemplate.bind(this));
    html.find('#export-template').on('click', this._onExportTemplate.bind(this));
    html.find('#import-template').on('click', this._onImportTemplate.bind(this));
    html.find('#delete-template').on('click', this._onDeleteTemplate.bind(this));

    // Annotated model interaction
    html.find('#annotated-model').on('click', '.tag', this._onTagClick.bind(this));
    html.find('#annotated-model').on('contextmenu', '.tag', this._onTagRightClick.bind(this));

    // Hover tooltips for annotations
    html.find('#annotated-model').on('mouseenter', '.tag, .annotated-text', this._onTagHover.bind(this));
    html.find('#annotated-model').on('mouseleave', '.tag, .annotated-text', this._onTagLeave.bind(this));

    // Clear annotations
    html.find('#clear-annotations').on('click', this._onClearAnnotations.bind(this));
  }

  /**
   * Handle mode change
   * @private
   */
  _onModeChange(event) {
    this.mode = event.target.value;
    this.render();
  }

  /**
   * Handle template selection
   * @private
   */
  _onTemplateSelect(event) {
    const fullId = event.target.value;

    if (!fullId) {
      this.currentTemplate = null;
      this.annotations = [];
      this.render();
      return;
    }

    // Parse ID format: "global:template-id" or "local:template-id"
    const [type, templateId] = fullId.split(':');
    const isGlobal = type === 'global';

    const template = ImportTemplateManager.getTemplate(templateId, isGlobal);

    if (template) {
      this.currentTemplate = template;
      this.constructs = template.constructs || {};

      // Load annotations if present
      if (template.annotations && Array.isArray(template.annotations)) {
        this.annotations = template.annotations;
      } else {
        this.annotations = [];
      }

      // Restore color manager state
      if (template.colorData) {
        this.colorManager.import(template.colorData);
      }

      // If in apply mode, we're done
      if (this.mode === 'apply') {
        this.render();
        return;
      }

      // If in create mode, convert template to annotations for editing
      // This is optional - for now, just load it
      ui.notifications.info(`Template "${template.metadata.name}" loaded`);
      this.render();
    }
  }

  /**
   * Handle system change
   * @private
   */
  _onSystemChange(event) {
    this.currentSystem = event.target.value;
    this.currentTemplate = null;
    this.render();
  }

  /**
   * Handle paste text from clipboard
   * @private
   */
  async _onPasteText(event) {
    event.preventDefault();

    try {
      const text = await navigator.clipboard.readText();
      this.sourceText = text;
      this.element.find('#source-text').text(text);
      this._updateDisplay();
      ui.notifications.info('Text pasted successfully');
    } catch (error) {
      ui.notifications.error('Failed to read clipboard. Try pasting directly with Ctrl+V');
    }
  }

  /**
   * Handle refresh view
   * @private
   */
  _onRefreshView(event) {
    event.preventDefault();
    // Sync source text from contenteditable
    const sourceElement = this.element.find('#source-text');
    this.sourceText = sourceElement.text();
    this._updateDisplay();
    ui.notifications.info('View refreshed');
  }

  /**
   * Handle clear text
   * @private
   */
  _onClearText(event) {
    event.preventDefault();
    this.sourceText = '';
    this.annotations = [];
    this.element.find('#source-text').text('');
    this._updateDisplay();
  }

  /**
   * Handle source text change (when user types)
   * @private
   */
  _onSourceTextChange(event) {
    this.sourceText = event.currentTarget.textContent;
    // Clear annotations when text changes significantly
    // Note: Pour une implémentation plus robuste, il faudrait ajuster les positions
    this._updateDisplay();
  }

  /**
   * Handle paste into source text
   * @private
   */
  _onSourceTextPaste(event) {
    event.preventDefault();

    // Get plain text from clipboard
    const text = (event.originalEvent || event).clipboardData.getData('text/plain');

    // Insert plain text at cursor position
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));

    // Update source text and display
    this.sourceText = event.currentTarget.textContent;
    this._updateDisplay();
  }

  /**
   * Handle text selection
   * @private
   */
  _onTextSelection(event) {
    const selection = window.getSelection();

    if (selection.toString().length > 0) {
      const range = selection.getRangeAt(0);
      const container = event.currentTarget;

      // Calculate positions in the full text
      this.selectedRange = {
        start: this._getTextPosition(container, range.startContainer, range.startOffset),
        end: this._getTextPosition(container, range.endContainer, range.endOffset),
        text: selection.toString()
      };

      console.log('Selection:', this.selectedRange);
    } else {
      this.selectedRange = null;
    }
  }

  /**
   * Handle field button click
   * @private
   */
  _onFieldButton(event) {
    const field = $(event.currentTarget).data('field');

    if (!this.selectedRange) {
      ui.notifications.warn('Please select text first');
      return;
    }

    // Create annotation with colors
    const annotationId = `ann-${Date.now()}`;
    const annotation = {
      id: annotationId,
      start: this.selectedRange.start,
      end: this.selectedRange.end,
      field: field,
      selectedText: this.selectedRange.text,
      mode: this._detectMode(this.selectedRange),
      colors: this.colorManager.assignColor(annotationId) // Assign unique color
    };

    // Store field color for button styling
    if (!this.fieldColors.has(field)) {
      this.fieldColors.set(field, annotation.colors);
    }

    this.annotations.push(annotation);
    this._updateDisplay();

    // Reset selection
    this.selectedRange = null;
    window.getSelection().removeAllRanges();
  }

  /**
   * Handle skip tool (separator/Next)
   * @private
   */
  _onSkipTool(event) {
    if (!this.selectedRange) {
      ui.notifications.warn('Please select text first');
      return;
    }

    const annotation = {
      id: `ann-${Date.now()}`,
      start: this.selectedRange.start,
      end: this.selectedRange.end,
      skip: true,
      selectedText: this.selectedRange.text,
      colors: this.colorManager.getNextColor() // Use neutral gray for separators
    };

    this.annotations.push(annotation);
    this._updateDisplay();

    this.selectedRange = null;
    window.getSelection().removeAllRanges();
  }

  /**
   * Handle multiline tool
   * @private
   */
  _onMultilineTool(event) {
    if (!this.selectedRange) {
      ui.notifications.warn('Please select text first');
      return;
    }

    // Mark this annotation as multiline
    // The user will then select a field
    this._pendingMultiline = true;
    ui.notifications.info('Now click a field button to assign this multiline text');
  }

  /**
   * Handle construct tool
   * @private
   */
  _onConstructTool(event) {
    if (!this.selectedRange) {
      ui.notifications.warn('Please select text first');
      return;
    }

    // Open construct editor modal
    const modal = new ConstructEditorModal({
      text: this.selectedRange.text,
      callback: (constructData) => {
        // Store construct if reusable
        if (constructData.reusable) {
          this.constructs[constructData.id] = {
            pattern: constructData.pattern,
            fields: constructData.fields,
            description: constructData.description
          };
        }

        // Create annotation
        const annotation = {
          id: `ann-${Date.now()}`,
          start: this.selectedRange.start,
          end: this.selectedRange.end,
          constructId: constructData.id,
          construct: {
            pattern: constructData.pattern,
            fields: constructData.fields
          },
          selectedText: this.selectedRange.text
        };

        this.annotations.push(annotation);
        this._updateDisplay();

        this.selectedRange = null;
        window.getSelection().removeAllRanges();
      }
    });

    modal.render(true);
  }

  /**
   * Handle list tool
   * @private
   */
  _onListTool(event) {
    ui.notifications.info('List tool not yet implemented');
    // TODO: Implement list annotation
  }

  /**
   * Handle transform tool
   * @private
   */
  _onTransformTool(event) {
    if (this.annotations.length === 0) {
      ui.notifications.warn('Please create an annotation first');
      return;
    }

    // Show transform options for the last annotation
    const lastAnnotation = this.annotations[this.annotations.length - 1];

    const options = {
      transform: lastAnnotation.transform || [],
      callback: (transforms) => {
        lastAnnotation.transform = transforms;
        this._updateDisplay();
      }
    };

    // Simple dialog for now
    new Dialog({
      title: 'Transform Options',
      content: `
        <form>
          <div class="form-group">
            <label>Transformations (comma-separated):</label>
            <input type="text" name="transforms" value="${(lastAnnotation.transform || []).join(', ')}"
                   placeholder="number, trim, lowercase" />
            <p class="notes">Available: number, float, boolean, lowercase, uppercase, trim</p>
          </div>
        </form>
      `,
      buttons: {
        apply: {
          label: 'Apply',
          callback: (html) => {
            const value = html.find('[name="transforms"]').val();
            const transforms = value.split(',').map(t => t.trim()).filter(t => t);
            lastAnnotation.transform = transforms;
            this._updateDisplay();
          }
        },
        cancel: {
          label: 'Cancel'
        }
      },
      default: 'apply'
    }).render(true);
  }

  /**
   * Handle eraser tool
   * @private
   */
  _onEraserTool(event) {
    this.eraserMode = !this.eraserMode;
    const button = $(event.currentTarget);
    const window = this.element.find('.import-template-window');

    if (this.eraserMode) {
      button.addClass('active');
      window.addClass('eraser-mode');
      ui.notifications.info('Eraser mode: Click on a tag to delete it');
    } else {
      button.removeClass('active');
      window.removeClass('eraser-mode');
    }
  }

  /**
   * Handle template name change
   * @private
   */
  _onTemplateNameChange(event) {
    // Just track that name has changed - no action needed yet
    const newName = event.target.value;
    console.log('Template name changed to:', newName);
  }

  /**
   * Handle save template (simplified - direct save)
   * @private
   */
  async _onSaveTemplate(event) {
    if (this.annotations.length === 0) {
      ui.notifications.warn('Please create at least one annotation first');
      return;
    }

    // Get name from input field
    const name = this.element.find('#template-name').val().trim();

    if (!name) {
      ui.notifications.warn('Please enter a template name');
      return;
    }

    // If editing a global template, force "Save As" instead
    if (this.currentTemplate?.metadata?.isGlobal) {
      ui.notifications.warn('Cannot overwrite global templates. Use "Save As" instead.');
      return;
    }

    // Build metadata
    const metadata = {
      id: this.currentTemplate?.metadata?.id || this._generateTemplateId(name),
      name: name,
      system: this.currentSystem,
      compatibleSystems: [this.currentSystem],
      description: this.currentTemplate?.metadata?.description || ''
    };

    // If updating existing template, preserve created date
    if (this.currentTemplate) {
      metadata.created = this.currentTemplate.metadata.created;
    }

    // Convert to template
    const template = this._convertToTemplate(metadata);

    // Save
    await ImportTemplateManager.saveLocalTemplate(template);

    this.currentTemplate = template;

    ui.notifications.info(`Template "${name}" saved successfully`);

    // Refresh to update dropdown
    this.render();
  }

  /**
   * Handle save as template (create new copy)
   * @private
   */
  async _onSaveAsTemplate(event) {
    if (this.annotations.length === 0) {
      ui.notifications.warn('Please create at least one annotation first');
      return;
    }

    // Get name from input field
    const baseName = this.element.find('#template-name').val().trim() ||
                     this.currentTemplate?.metadata?.name ||
                     'New Template';

    // Open dialog to confirm/edit name
    new Dialog({
      title: 'Save Template As',
      content: `
        <form>
          <div class="form-group">
            <label>Template Name:</label>
            <input type="text" name="templateName" value="${baseName}" autofocus style="width: 100%;" />
          </div>
          <div class="form-group">
            <label>Description (optional):</label>
            <textarea name="description" rows="3" style="width: 100%;">${this.currentTemplate?.metadata?.description || ''}</textarea>
          </div>
        </form>
      `,
      buttons: {
        save: {
          label: 'Save',
          callback: async (html) => {
            const name = html.find('[name="templateName"]').val().trim();
            const description = html.find('[name="description"]').val().trim();

            if (!name) {
              ui.notifications.warn('Please enter a name');
              return;
            }

            // Build metadata (always new ID)
            const metadata = {
              id: this._generateTemplateId(name),
              name: name,
              system: this.currentSystem,
              compatibleSystems: [this.currentSystem],
              description: description
            };

            // Convert to template
            const template = this._convertToTemplate(metadata);

            // Save as new
            await ImportTemplateManager.saveLocalTemplate(template);

            this.currentTemplate = template;

            // Update name field
            this.element.find('#template-name').val(name);

            ui.notifications.info(`Template "${name}" saved successfully`);

            // Refresh
            this.render();
          }
        },
        cancel: {
          label: 'Cancel'
        }
      },
      default: 'save'
    }).render(true);
  }

  /**
   * Handle test template
   * @private
   */
  _onTestTemplate(event) {
    if (this.mode === 'create' && this.annotations.length === 0) {
      ui.notifications.warn('Please create annotations first');
      return;
    }

    if (this.mode === 'apply' && !this.currentTemplate) {
      ui.notifications.warn('Please select a template first');
      return;
    }

    if (!this.sourceText) {
      ui.notifications.warn('Please paste source text first');
      return;
    }

    try {
      // Convert annotations to template if in create mode
      const template = this.mode === 'create'
        ? this._convertToTemplate({id: 'test', system: this.currentSystem, name: 'Test'})
        : this.currentTemplate;

      // Parse the text
      const parser = new TemplateParser(template);
      const data = parser.parse(this.sourceText);

      // Show results in a dialog
      new Dialog({
        title: 'Parse Results',
        content: `
          <div class="parse-results">
            <h3>Extracted Data:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        `,
        buttons: {
          close: {
            label: 'Close'
          }
        }
      }).render(true);

      console.log('Parse results:', data);
    } catch (error) {
      ui.notifications.error(`Parse error: ${error.message}`);
      console.error('Parse error:', error);
    }
  }

  /**
   * Handle apply template
   * @private
   */
  async _onApplyTemplate(event) {
    if (!this.currentTemplate) {
      ui.notifications.warn('Please select a template first');
      return;
    }

    if (!this.sourceText) {
      ui.notifications.warn('Please paste source text first');
      return;
    }

    try {
      // Parse the text
      const parser = new TemplateParser(this.currentTemplate);
      const data = parser.parse(this.sourceText);

      // Create actor
      const actorData = {
        name: data.name || 'Unnamed',
        type: data.type || 'npc',
        system: data
      };

      const actor = await Actor.create(actorData);

      if (actor) {
        ui.notifications.info(`Actor "${actor.name}" created successfully`);
        actor.sheet.render(true);
      }
    } catch (error) {
      ui.notifications.error(`Failed to create actor: ${error.message}`);
      console.error('Create actor error:', error);
    }
  }

  /**
   * Handle export template
   * @private
   */
  _onExportTemplate(event) {
    if (!this.currentTemplate) {
      ui.notifications.warn('Please select a template first');
      return;
    }

    ImportTemplateManager.exportTemplate(this.currentTemplate);
  }

  /**
   * Handle import template
   * @private
   */
  _onImportTemplate(event) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const template = await ImportTemplateManager.importTemplate(file);
          this.currentTemplate = template;
          this.currentSystem = template.metadata.system;
          this.render();
        } catch (error) {
          // Error already shown by ImportTemplateManager
        }
      }
    };

    input.click();
  }

  /**
   * Handle delete template
   * @private
   */
  async _onDeleteTemplate(event) {
    if (!this.currentTemplate) {
      ui.notifications.warn('Please select a template first');
      return;
    }

    // Can't delete global templates
    if (this.currentTemplate.metadata.isGlobal) {
      ui.notifications.warn('Cannot delete global templates. Use "Save As" to create a local copy.');
      return;
    }

    const confirmed = await Dialog.confirm({
      title: 'Delete Template',
      content: `<p>Are you sure you want to delete the template "${this.currentTemplate.metadata.name}"?</p>`,
      defaultYes: false
    });

    if (confirmed) {
      await ImportTemplateManager.deleteLocalTemplate(this.currentTemplate.metadata.id);
      this.currentTemplate = null;
      this.render();
    }
  }

  /**
   * Handle tag click in annotated model
   * @private
   */
  _onTagClick(event) {
    event.preventDefault();
    const annotationId = $(event.currentTarget).data('id');

    // If eraser mode is active, delete the annotation
    if (this.eraserMode) {
      this._deleteAnnotation(annotationId);
      return;
    }

    const annotation = this.annotations.find(a => a.id === annotationId);

    if (annotation) {
      // Highlight the corresponding text in source
      this._highlightAnnotation(annotation);
    }
  }

  /**
   * Handle tag right-click
   * @private
   */
  _onTagRightClick(event) {
    event.preventDefault();
    const annotationId = $(event.currentTarget).data('id');

    const menu = [
      {
        name: 'Edit',
        icon: '<i class="fas fa-edit"></i>',
        callback: () => this._editAnnotation(annotationId)
      },
      {
        name: 'Delete',
        icon: '<i class="fas fa-trash"></i>',
        callback: () => this._deleteAnnotation(annotationId)
      }
    ];

    // Simple context menu
    // In a full implementation, use ContextMenu API
    console.log('Context menu for annotation:', annotationId, menu);
  }

  /**
   * Handle tag hover - display tooltip with annotation info
   * @private
   */
  _onTagHover(event) {
    const annotationId = $(event.currentTarget).data('id');
    const annotation = this.annotations.find(a => a.id === annotationId);

    if (!annotation) return;

    // Remove any existing tooltips
    $('.annotation-tooltip').remove();

    // Create tooltip content
    let content = '';

    if (annotation.skip) {
      content = `<strong>Type:</strong> Next (Separator)<br>`;
      content += `<strong>Text:</strong> "${this._escapeHtml(annotation.selectedText)}"`;
    } else if (annotation.constructId) {
      content = `<strong>Type:</strong> Construct<br>`;
      content += `<strong>ID:</strong> ${annotation.constructId}<br>`;
      content += `<strong>Text:</strong> "${this._escapeHtml(annotation.selectedText)}"`;
    } else {
      content = `<strong>Field:</strong> ${annotation.field}<br>`;

      if (annotation.mode) {
        const modeStr = typeof annotation.mode === 'string' ? annotation.mode : annotation.mode.mode;
        content += `<strong>Mode:</strong> ${modeStr}<br>`;
      }

      if (annotation.transform && annotation.transform.length > 0) {
        content += `<strong>Transform:</strong> ${annotation.transform.join(', ')}<br>`;
      }

      const isUnmapped = !this._fieldExistsInSystem(annotation.field);
      if (isUnmapped) {
        content += `<strong style="color: #ff6b6b;">Warning:</strong> Field not in system schema<br>`;
      }

      content += `<strong>Text:</strong> "${this._escapeHtml(annotation.selectedText)}"`;
    }

    // Create tooltip element
    const tooltip = $('<div class="annotation-tooltip"></div>');
    tooltip.html(content);

    // Position tooltip
    const rect = event.currentTarget.getBoundingClientRect();
    tooltip.css({
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 5) + 'px',
      zIndex: 10000
    });

    $('body').append(tooltip);
  }

  /**
   * Handle tag leave - remove tooltip
   * @private
   */
  _onTagLeave(event) {
    $('.annotation-tooltip').remove();
  }

  /**
   * Handle clear annotations
   * @private
   */
  _onClearAnnotations(event) {
    if (this.annotations.length === 0) {
      return;
    }

    Dialog.confirm({
      title: 'Clear Annotations',
      content: '<p>Are you sure you want to clear all annotations?</p>',
      yes: () => {
        this.annotations = [];
        this._updateDisplay();
      }
    });
  }

  /**
   * Detect parsing mode from selection
   * @private
   */
  _detectMode(range) {
    const nextChar = this.sourceText[range.end];

    if (range.text.includes('\n')) {
      return 'multiline';
    }

    if (nextChar === '\n') {
      return 'toNewline';
    }

    if (nextChar === ' ') {
      return 'toSpace';
    }

    if (nextChar && !nextChar.match(/\w/)) {
      return 'toChar';
    }

    return 'toNewline';
  }

  /**
   * Generate annotated HTML with colors
   * @private
   */
  _generateAnnotatedHtml() {
    if (!this.sourceText) {
      return '';
    }

    const sorted = [...this.annotations].sort((a, b) => a.start - b.start);

    let html = '';
    let lastPos = 0;

    for (const annot of sorted) {
      // Unannotated text
      if (annot.start > lastPos) {
        html += this._escapeHtml(this.sourceText.substring(lastPos, annot.start));
      }

      // Get colors for this annotation
      const colors = annot.colors || this.colorManager.getColor(annot.id) || {
        background: '#f0f0f0',
        border: '#ccc'
      };

      // Check if field is unmapped (will add italics later)
      const isUnmapped = annot.field && !this._fieldExistsInSystem(annot.field);
      const unmappedClass = isUnmapped ? ' field-unmapped' : '';
      const unmappedStyle = isUnmapped ? ' font-style: italic; opacity: 0.7;' : '';

      // Generate inline style
      const tagStyle = `background-color: ${colors.background}; border-left: 4px solid ${colors.border}; padding: 2px 6px; margin: 0 1px; border-radius: 3px;${unmappedStyle}`;
      const textStyle = `background-color: ${colors.background}; padding: 2px 4px; border-radius: 3px;${unmappedStyle}`;

      // Annotation with colors
      if (annot.skip) {
        html += `<span class="tag tag-skip${unmappedClass}" data-id="${annot.id}" data-field="Next" style="${tagStyle}">[Next]</span>`;
        html += `<span class="annotated-text" data-id="${annot.id}" style="${textStyle}">${this._escapeHtml(annot.selectedText)}</span>`;
        html += `<span class="tag-close" style="color: #999; font-size: 10px; margin-left: 2px;">[/]</span>`;
      } else if (annot.constructId) {
        html += `<span class="tag tag-construct${unmappedClass}" data-id="${annot.id}" data-field="Construct:${annot.constructId}" style="${tagStyle}">[Construct:${annot.constructId}]</span>`;
        html += `<span class="annotated-text" data-id="${annot.id}" style="${textStyle}">${this._escapeHtml(annot.selectedText)}</span>`;
        html += `<span class="tag-close" style="color: #999; font-size: 10px; margin-left: 2px;">[/]</span>`;
      } else {
        const modeStr = typeof annot.mode === 'string' ? annot.mode : annot.mode.mode;
        const modeLabel = modeStr !== 'toNewline' ? ':' + modeStr : '';
        html += `<span class="tag${unmappedClass}" data-id="${annot.id}" data-field="${annot.field}" data-mode="${modeStr}" style="${tagStyle}">[${annot.field}${modeLabel}]</span>`;
        html += `<span class="annotated-text" data-id="${annot.id}" style="${textStyle}">${this._escapeHtml(annot.selectedText)}</span>`;
        html += `<span class="tag-close" style="color: #999; font-size: 10px; margin-left: 2px;">[/${annot.field.split('.').pop()}]</span>`;
      }

      lastPos = annot.end;
    }

    // Remaining text
    if (lastPos < this.sourceText.length) {
      html += this._escapeHtml(this.sourceText.substring(lastPos));
    }

    return html;
  }

  /**
   * Update display (both panels)
   * @private
   */
  _updateDisplay() {
    // Ne pas modifier le source-text pour éviter les problèmes de sélection
    // Seul le panneau annoté est mis à jour
    this._updateAnnotatedView();
    this._updateFieldButtonColors();
  }

  /**
   * Highlight source text with annotations
   * DÉSACTIVÉ : Causait des problèmes de position de sélection
   * @private
   */
  _highlightSourceText() {
    // Désactivé - les highlights sont uniquement dans le panneau annoté
    // pour ne pas perturber la sélection de texte
  }

  /**
   * Update annotated view
   * @private
   */
  _updateAnnotatedView() {
    const container = this.element.find('#annotated-model');
    container.html(this._generateAnnotatedHtml());
  }

  /**
   * Update field button colors based on annotations
   * @private
   */
  _updateFieldButtonColors() {
    // Apply colors to field buttons based on fieldColors map
    for (const [field, colors] of this.fieldColors.entries()) {
      const button = this.element.find(`.field-btn[data-field="${field}"]`);

      if (button.length > 0) {
        button.css({
          'background-color': colors.background,
          'border-color': colors.border,
          'color': '#333' // Keep text dark for readability
        });
      }
    }
  }

  /**
   * Convert annotations to template
   * @private
   */
  _convertToTemplate(metadata) {
    const sorted = [...this.annotations].sort((a, b) => a.start - b.start);
    const tokens = [];
    let lastPos = 0;

    for (const annot of sorted) {
      // Skip between annotations
      if (annot.start > lastPos) {
        const skipped = this.sourceText.substring(lastPos, annot.start);
        if (skipped.trim()) {
          tokens.push({
            id: `tok-skip-${tokens.length}`,
            skip: skipped,
            mode: 'literal'
          });
        }
      }

      if (annot.skip) {
        tokens.push({
          id: `tok-skip-${tokens.length}`,
          skip: annot.selectedText,
          mode: 'literal'
        });
      } else if (annot.constructId) {
        tokens.push({
          id: `tok-${tokens.length}`,
          constructId: annot.constructId,
          mode: 'construct'
        });
      } else {
        const token = {
          id: `tok-${tokens.length}`,
          field: annot.field,
          mode: typeof annot.mode === 'string' ? annot.mode : annot.mode.mode
        };

        if (annot.mode?.endChar) token.endChar = annot.mode.endChar;
        if (annot.transform) token.transform = annot.transform;

        tokens.push(token);
      }

      lastPos = annot.end;
    }

    return {
      templateFormat: 'fvtt-import-v2',
      version: '2.0.0',
      metadata: {
        id: metadata.id || this._generateTemplateId(metadata.name),
        name: metadata.name || 'Unnamed Template',
        system: metadata.system || this.currentSystem,
        compatibleSystems: metadata.compatibleSystems || [metadata.system || this.currentSystem],
        author: metadata.author || game.user.name,
        description: metadata.description || '',
        created: metadata.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        isGlobal: false // Always false for user-created templates
      },
      annotations: this.annotations,
      constructs: this.constructs,
      tokens: tokens,
      mappings: [], // Will be populated by Phase 3
      colorData: this.colorManager.export()
    };
  }

  /**
   * Generate a template ID from name
   * @private
   */
  _generateTemplateId(name) {
    if (!name) return `template-${Date.now()}`;
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /**
   * Get text position from DOM node
   * @private
   */
  _getTextPosition(container, node, offset) {
    let pos = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return pos + offset;
      }
      pos += currentNode.textContent.length;
    }

    return pos;
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Highlight a specific annotation
   * @private
   */
  _highlightAnnotation(annotation) {
    // Add visual feedback
    console.log('Highlighting annotation:', annotation);
  }

  /**
   * Edit an annotation
   * @private
   */
  _editAnnotation(annotationId) {
    const annotation = this.annotations.find(a => a.id === annotationId);
    if (annotation) {
      // Open edit dialog
      console.log('Edit annotation:', annotation);
    }
  }

  /**
   * Delete an annotation
   * @private
   */
  _deleteAnnotation(annotationId) {
    const index = this.annotations.findIndex(a => a.id === annotationId);
    if (index !== -1) {
      this.annotations.splice(index, 1);
      this._updateDisplay();
    }
  }
}
