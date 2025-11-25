/**
 * Construct Editor Modal
 * Modal for creating and editing construct patterns
 */
export class ConstructEditorModal extends FormApplication {
  constructor(options) {
    super({}, options);
    this.text = options.text;
    this.callback = options.callback;
    this.detectedPattern = this._detectPattern(this.text);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'construct-editor',
      classes: ['actor-importer', 'construct-editor-modal'],
      template: 'modules/actor-importer/templates/construct-modal.html',
      width: 600,
      height: 'auto',
      title: game.i18n.localize('ACTOR_IMPORTER.ConstructEditor.Title'),
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    });
  }

  getData() {
    return {
      text: this.text,
      pattern: this.detectedPattern.pattern,
      groups: this.detectedPattern.groups,
      availableFields: this._getAvailableFields()
    };
  }

  /**
   * Detect pattern from selected text
   * @private
   */
  _detectPattern(text) {
    // Common patterns to try
    const patterns = [
      {
        pattern: '^(.+?)\\s*-\\s*(.+?):\\s*',
        description: 'Name - Type:',
        labels: ['name', 'type']
      },
      {
        pattern: '^(.+?)\\s*\\((.+?)\\)\\s*-\\s*(.+?):\\s*',
        description: 'Name (Count) - Type:',
        labels: ['name', 'count', 'type']
      },
      {
        pattern: '^(.+?)\\s*\\((.+?)\\)',
        description: 'Name (Details)',
        labels: ['name', 'details']
      },
      {
        pattern: '^\\[(.+?)\\]\\s+(.+)',
        description: '[Category] Name',
        labels: ['category', 'name']
      },
      {
        pattern: '^(.+?):\\s*(.+)',
        description: 'Label: Value',
        labels: ['label', 'value']
      }
    ];

    for (const p of patterns) {
      const regex = new RegExp(p.pattern);
      const match = text.match(regex);

      if (match) {
        return {
          pattern: p.pattern,
          description: p.description,
          groups: p.labels.map((label, i) => ({
            index: i + 1,
            value: match[i + 1] || '',
            field: `item.${label}`,
            label: label
          }))
        };
      }
    }

    // No pattern matched - suggest a generic one
    return {
      pattern: '^(.+)',
      description: 'Generic (entire line)',
      groups: [{
        index: 1,
        value: text,
        field: 'item.text',
        label: 'text'
      }]
    };
  }

  /**
   * Get available fields for mapping
   * @private
   */
  _getAvailableFields() {
    return [
      {value: 'item.name', label: 'Name'},
      {value: 'item.type', label: 'Type'},
      {value: 'item.subtype', label: 'Subtype'},
      {value: 'item.description', label: 'Description'},
      {value: 'item.category', label: 'Category'},
      {value: 'item.count', label: 'Count'},
      {value: 'item.value', label: 'Value'},
      {value: 'item.range', label: 'Range'},
      {value: 'item.damage', label: 'Damage'},
      {value: 'item.text', label: 'Text'}
    ];
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Update group previews when pattern changes
    html.find('#construct-pattern').on('input', this._onPatternChange.bind(this));

    // Test pattern button
    html.find('#test-pattern').on('click', this._onTestPattern.bind(this));
  }

  /**
   * Handle pattern change
   * @private
   */
  _onPatternChange(event) {
    const pattern = event.target.value;
    this._updateGroupPreviews(pattern);
  }

  /**
   * Update group previews based on pattern
   * @private
   */
  _updateGroupPreviews(pattern) {
    try {
      const regex = new RegExp(pattern);
      const match = this.text.match(regex);

      const groupInputs = this.element.find('.group-preview');
      groupInputs.each((i, input) => {
        const value = match && match[i + 1] ? match[i + 1] : '';
        $(input).val(value);
      });
    } catch (error) {
      // Invalid regex - ignore
      console.warn('Invalid regex pattern:', error);
    }
  }

  /**
   * Test the pattern
   * @private
   */
  _onTestPattern(event) {
    event.preventDefault();

    const pattern = this.element.find('#construct-pattern').val();

    try {
      const regex = new RegExp(pattern);
      const match = this.text.match(regex);

      if (match) {
        let message = `Pattern matched! Found ${match.length - 1} group(s):\n`;
        for (let i = 1; i < match.length; i++) {
          message += `Group ${i}: "${match[i]}"\n`;
        }
        ui.notifications.info(message);
      } else {
        ui.notifications.warn('Pattern did not match the text');
      }
    } catch (error) {
      ui.notifications.error(`Invalid regex: ${error.message}`);
    }
  }

  async _updateObject(event, formData) {
    const pattern = formData.pattern;
    const saveReusable = formData.saveReusable;
    const constructName = formData.constructName || `construct-${Date.now()}`;

    // Extract field mappings
    const fields = [];
    let i = 0;
    while (formData[`group-${i}-field`]) {
      fields.push(formData[`group-${i}-field`]);
      i++;
    }

    const constructData = {
      id: constructName,
      pattern: pattern,
      fields: fields,
      description: formData.description || '',
      reusable: saveReusable
    };

    // Validate pattern
    try {
      new RegExp(pattern);
    } catch (error) {
      ui.notifications.error(`Invalid regex pattern: ${error.message}`);
      return;
    }

    // Call the callback
    if (this.callback) {
      this.callback(constructData);
    }
  }
}
