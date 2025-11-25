import { ImportTemplateManager } from './template-manager.mjs';
import { TemplateParser } from './template-parser.mjs';
import { ConstructEditorModal } from './modals/construct-editor-modal.mjs';
import { SaveTemplateModal } from './modals/save-template-modal.mjs';

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
    const systemTemplates = ImportTemplateManager.getTemplates(this.currentSystem);
    const templates = Object.entries(systemTemplates).map(([id, template]) => ({
      id,
      name: template.metadata.name
    }));

    return {
      mode: this.mode,
      currentSystem: this.currentSystem,
      templates: templates,
      currentTemplate: this.currentTemplate,
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

  activateListeners(html) {
    super.activateListeners(html);

    // Mode switching
    html.find('#mode-select').on('change', this._onModeChange.bind(this));
    html.find('#template-select').on('change', this._onTemplateSelect.bind(this));
    html.find('#system-select').on('change', this._onSystemChange.bind(this));

    // Text editing
    html.find('#paste-text').on('click', this._onPasteText.bind(this));
    html.find('#clear-text').on('click', this._onClearText.bind(this));
    html.find('#source-text').on('mouseup', this._onTextSelection.bind(this));

    // Field buttons
    html.find('.field-btn').on('click', this._onFieldButton.bind(this));

    // Tool buttons
    html.find('#tool-skip').on('click', this._onSkipTool.bind(this));
    html.find('#tool-multiline').on('click', this._onMultilineTool.bind(this));
    html.find('#tool-construct').on('click', this._onConstructTool.bind(this));
    html.find('#tool-list').on('click', this._onListTool.bind(this));
    html.find('#tool-transform').on('click', this._onTransformTool.bind(this));

    // Template actions
    html.find('#save-template').on('click', this._onSaveTemplate.bind(this));
    html.find('#test-template').on('click', this._onTestTemplate.bind(this));
    html.find('#apply-template').on('click', this._onApplyTemplate.bind(this));
    html.find('#export-template').on('click', this._onExportTemplate.bind(this));
    html.find('#import-template').on('click', this._onImportTemplate.bind(this));
    html.find('#delete-template').on('click', this._onDeleteTemplate.bind(this));

    // Annotated model interaction
    html.find('#annotated-model').on('click', '.tag', this._onTagClick.bind(this));
    html.find('#annotated-model').on('contextmenu', '.tag', this._onTagRightClick.bind(this));

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
    const templateId = event.target.value;

    if (!templateId) {
      this.currentTemplate = null;
      this.annotations = [];
      this.render();
      return;
    }

    const template = ImportTemplateManager.getTemplate(this.currentSystem, templateId);

    if (template) {
      this.currentTemplate = template;
      this.constructs = template.constructs || {};

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
   * Handle paste text
   * @private
   */
  async _onPasteText(event) {
    event.preventDefault();

    try {
      const text = await navigator.clipboard.readText();
      this.sourceText = text;
      this.element.find('#source-text').text(text);
      this._updateDisplay();
    } catch (error) {
      ui.notifications.error('Failed to read clipboard');
    }
  }

  /**
   * Handle clear text
   * @private
   */
  _onClearText(event) {
    event.preventDefault();
    this.sourceText = '';
    this.element.find('#source-text').text('');
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

    // Create annotation
    const annotation = {
      id: `ann-${Date.now()}`,
      start: this.selectedRange.start,
      end: this.selectedRange.end,
      field: field,
      selectedText: this.selectedRange.text,
      mode: this._detectMode(this.selectedRange)
    };

    this.annotations.push(annotation);
    this._updateDisplay();

    // Reset selection
    this.selectedRange = null;
    window.getSelection().removeAllRanges();
  }

  /**
   * Handle skip tool
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
      selectedText: this.selectedRange.text
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
   * Handle save template
   * @private
   */
  _onSaveTemplate(event) {
    if (this.annotations.length === 0) {
      ui.notifications.warn('Please create at least one annotation first');
      return;
    }

    const modal = new SaveTemplateModal({
      annotations: this.annotations,
      sourceText: this.sourceText,
      template: this.currentTemplate,
      callback: async (metadata, exportOnly) => {
        const template = this._convertToTemplate(metadata);

        if (exportOnly) {
          return template; // Return for export
        } else {
          await ImportTemplateManager.saveTemplate(
            template.metadata.system,
            template.metadata.id,
            template
          );
          this.currentTemplate = template;
          this.render();
        }
      }
    });

    modal.render(true);
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

    ImportTemplateManager.exportTemplate(
      this.currentTemplate.metadata.system,
      this.currentTemplate.metadata.id
    );
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

    const confirmed = await Dialog.confirm({
      title: 'Delete Template',
      content: `<p>Are you sure you want to delete the template "${this.currentTemplate.metadata.name}"?</p>`,
      defaultYes: false
    });

    if (confirmed) {
      await ImportTemplateManager.deleteTemplate(
        this.currentTemplate.metadata.system,
        this.currentTemplate.metadata.id
      );
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
   * Generate annotated HTML
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

      // Annotation
      if (annot.skip) {
        html += `<span class="tag tag-skip" data-id="${annot.id}">[&gt;&gt;&gt;]</span>`;
        html += this._escapeHtml(annot.selectedText);
        html += `<span class="tag-close">[/]</span>`;
      } else if (annot.constructId) {
        html += `<span class="tag tag-construct" data-id="${annot.id}">[construct:${annot.constructId}]</span>`;
        html += this._escapeHtml(annot.selectedText);
        html += `<span class="tag-close">[/]</span>`;
      } else {
        const modeStr = typeof annot.mode === 'string' ? annot.mode : annot.mode.mode;
        const modeLabel = modeStr !== 'toNewline' ? ':' + modeStr : '';
        html += `<span class="tag" data-id="${annot.id}">[${annot.field}${modeLabel}]</span>`;
        html += this._escapeHtml(annot.selectedText);
        html += `<span class="tag-close">[/${annot.field.split('.').pop()}]</span>`;
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
    this._highlightSourceText();
    this._updateAnnotatedView();
  }

  /**
   * Highlight source text with annotations
   * @private
   */
  _highlightSourceText() {
    const container = this.element.find('#source-text');
    const sorted = [...this.annotations].sort((a, b) => a.start - b.start);

    let html = '';
    let lastPos = 0;

    for (const annot of sorted) {
      if (annot.start > lastPos) {
        html += this._escapeHtml(this.sourceText.substring(lastPos, annot.start));
      }

      const className = annot.skip ? 'highlight-skip' : 'highlight';
      html += `<span class="${className}" data-id="${annot.id}">${this._escapeHtml(annot.selectedText)}</span>`;

      lastPos = annot.end;
    }

    if (lastPos < this.sourceText.length) {
      html += this._escapeHtml(this.sourceText.substring(lastPos));
    }

    container.html(html);
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
      templateFormat: 'fvtt-import-v1',
      metadata: {
        ...metadata,
        author: metadata.author || game.user.name,
        version: metadata.version || '1.0.0',
        created: metadata.created || new Date().toISOString(),
        updated: new Date().toISOString()
      },
      constructs: this.constructs,
      tokens: tokens
    };
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
