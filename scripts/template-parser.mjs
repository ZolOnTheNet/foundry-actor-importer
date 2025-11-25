/**
 * Template Parser
 * Parses source text using a template with tokens
 */
export class TemplateParser {
  constructor(template) {
    this.template = template;
    this.constructs = template.constructs || {};
  }

  /**
   * Parse source text using the template
   * @param {string} sourceText - The text to parse
   * @returns {Object} Parsed data object
   */
  parse(sourceText) {
    let pos = 0;
    const data = {};

    try {
      for (const token of this.template.tokens) {
        if (pos >= sourceText.length) {
          break;
        }

        if (token.skip) {
          // Mode literal: advance in text
          pos = this._handleSkip(sourceText, pos, token);
          continue;
        }

        if (token.mode === 'list') {
          // Mode list: repetitive parsing
          const listData = this.parseList(sourceText, pos, token);
          this._setNestedValue(data, token.field, listData.items);
          pos = listData.endPos;
          continue;
        }

        if (token.mode === 'construct') {
          // Mode construct: extraction by regex
          const result = this.parseConstruct(sourceText, pos, token);
          Object.assign(data, result.data);
          pos = result.endPos;
          continue;
        }

        // Simple modes
        const result = this._parseSimpleToken(sourceText, pos, token);
        if (result) {
          let value = result.value;

          // Apply transformations
          if (token.transform) {
            value = this._applyTransform(value, token.transform);
          }

          // Store the value
          this._setNestedValue(data, token.field, value);
          pos = result.endPos;
        }
      }
    } catch (error) {
      console.error('Error parsing template:', error);
      throw new Error(`Parse error at position ${pos}: ${error.message}`);
    }

    return data;
  }

  /**
   * Handle skip token
   * @private
   */
  _handleSkip(sourceText, pos, token) {
    const skipText = token.skip;
    const index = sourceText.indexOf(skipText, pos);

    if (index !== -1 && index - pos < 100) { // Allow some flexibility
      return index + skipText.length;
    }

    // If exact match not found, just skip the length
    return pos + skipText.length;
  }

  /**
   * Parse a simple token
   * @private
   */
  _parseSimpleToken(sourceText, pos, token) {
    let value;
    let endPos;

    switch (token.mode) {
      case 'toNewline':
        endPos = sourceText.indexOf('\n', pos);
        if (endPos === -1) endPos = sourceText.length;
        value = sourceText.substring(pos, endPos);
        pos = endPos + 1;
        break;

      case 'toSpace':
        endPos = sourceText.indexOf(' ', pos);
        if (endPos === -1) endPos = sourceText.indexOf('\n', pos);
        if (endPos === -1) endPos = sourceText.length;
        value = sourceText.substring(pos, endPos);
        pos = endPos + 1;
        break;

      case 'toChar':
        endPos = sourceText.indexOf(token.endChar, pos);
        if (endPos === -1) endPos = sourceText.length;
        value = sourceText.substring(pos, endPos);
        pos = endPos + token.endChar.length;
        break;

      case 'toToken':
        endPos = sourceText.indexOf(token.endToken, pos);
        if (endPos === -1) endPos = sourceText.length;
        value = sourceText.substring(pos, endPos);
        pos = endPos;
        break;

      case 'multiline':
        if (token.endToken) {
          endPos = sourceText.indexOf(token.endToken, pos);
          if (endPos === -1) endPos = sourceText.length;
        } else {
          // Until next token or end
          endPos = this._findNextToken(sourceText, pos);
        }
        value = sourceText.substring(pos, endPos);
        pos = endPos;
        break;

      case 'regex':
        const regex = new RegExp(token.pattern, token.flags || '');
        const match = sourceText.substring(pos).match(regex);
        if (match) {
          value = match[0];
          pos += match.index + value.length;
        } else {
          return null;
        }
        break;

      case 'literal':
        // Skip literal text
        if (token.skip) {
          const index = sourceText.indexOf(token.skip, pos);
          if (index !== -1) {
            pos = index + token.skip.length;
          }
        }
        return null;

      default:
        console.warn(`Unknown token mode: ${token.mode}`);
        return null;
    }

    return {value, endPos: pos};
  }

  /**
   * Parse a construct (pattern with capture groups)
   * @param {string} sourceText - Source text
   * @param {number} pos - Current position
   * @param {Object} token - Token with constructId
   * @returns {Object} {data, endPos}
   */
  parseConstruct(sourceText, pos, token) {
    const construct = this.constructs[token.constructId];

    if (!construct) {
      throw new Error(`Construct not found: ${token.constructId}`);
    }

    const regex = new RegExp(construct.pattern, construct.flags || '');
    const textFromPos = sourceText.substring(pos);
    const match = textFromPos.match(regex);

    if (!match) {
      console.warn(`Construct pattern not found: ${construct.pattern}`);
      return {data: {}, endPos: pos};
    }

    const data = {};
    construct.fields.forEach((field, index) => {
      if (match[index + 1] !== undefined) {
        this._setNestedValue(data, field, match[index + 1]);
      }
    });

    return {
      data,
      endPos: pos + match[0].length
    };
  }

  /**
   * Parse a list of items
   * @param {string} sourceText - Source text
   * @param {number} pos - Current position
   * @param {Object} token - List token
   * @returns {Object} {items: Array, endPos: number}
   */
  parseList(sourceText, pos, token) {
    const items = [];

    // Find list start
    if (token.startToken) {
      const startIndex = sourceText.indexOf(token.startToken, pos);
      if (startIndex === -1) {
        return {items: [], endPos: pos};
      }
      pos = startIndex + token.startToken.length;
    }

    // Parse items
    let iteration = 0;
    const maxIterations = 1000; // Safety limit

    while (pos < sourceText.length && iteration < maxIterations) {
      iteration++;

      // Check if we reached end of list
      if (token.endToken && sourceText.substring(pos).startsWith(token.endToken)) {
        pos += token.endToken.length;
        break;
      }

      // Parse one item
      const itemData = {};
      let itemPos = pos;

      // Parse construct if defined
      if (token.itemTemplate?.construct) {
        const constructId = token.itemTemplate.construct.constructId;
        const construct = this.constructs[constructId];

        if (construct) {
          const regex = new RegExp(construct.pattern, construct.flags || '');
          const match = sourceText.substring(itemPos).match(regex);

          if (!match) {
            // No more items matching pattern
            break;
          }

          construct.fields.forEach((field, index) => {
            if (match[index + 1] !== undefined) {
              this._setNestedValue(itemData, field, match[index + 1]);
            }
          });

          itemPos += match[0].length;
        }
      }

      // Parse item tokens
      if (token.itemTemplate?.tokens) {
        for (const itemToken of token.itemTemplate.tokens) {
          if (itemToken.mode === 'multiline' && itemToken.endToken === 'nextConstruct') {
            // Find next construct
            const nextConstructPos = this._findNextConstruct(
              sourceText,
              itemPos,
              token.itemTemplate.construct?.constructId
            );
            const value = sourceText.substring(itemPos, nextConstructPos).trim();
            this._setNestedValue(itemData, itemToken.field, value);
            itemPos = nextConstructPos;
            break;
          } else {
            const result = this._parseSimpleToken(sourceText, itemPos, itemToken);
            if (result) {
              let value = result.value;
              if (itemToken.transform) {
                value = this._applyTransform(value, itemToken.transform);
              }
              this._setNestedValue(itemData, itemToken.field, value);
              itemPos = result.endPos;
            }
          }
        }
      }

      // Only add item if it has data
      if (Object.keys(itemData).length > 0) {
        items.push(itemData);
      }

      pos = itemPos;

      // Check if there's another item
      if (token.itemTemplate?.construct) {
        const hasNext = this._hasNextConstruct(
          sourceText,
          pos,
          token.itemTemplate.construct.constructId
        );
        if (!hasNext) {
          break;
        }
      } else {
        // For lists without construct, break after one item
        // (needs better logic for detecting list continuation)
        break;
      }
    }

    return {items, endPos: pos};
  }

  /**
   * Find the next construct occurrence
   * @private
   */
  _findNextConstruct(sourceText, pos, constructId) {
    if (!constructId) {
      return sourceText.length;
    }

    const construct = this.constructs[constructId];
    if (!construct) {
      return sourceText.length;
    }

    const regex = new RegExp(construct.pattern, 'gm');
    regex.lastIndex = pos;
    const match = regex.exec(sourceText);

    return match ? match.index : sourceText.length;
  }

  /**
   * Check if there's another construct ahead
   * @private
   */
  _hasNextConstruct(sourceText, pos, constructId) {
    const nextPos = this._findNextConstruct(sourceText, pos, constructId);
    return nextPos < sourceText.length;
  }

  /**
   * Find next token position
   * @private
   */
  _findNextToken(sourceText, pos) {
    // Simplified: return end of text
    // In a full implementation, this would look for the next annotated token
    return sourceText.length;
  }

  /**
   * Apply transformation to a value
   * @private
   */
  _applyTransform(value, transform) {
    const transforms = Array.isArray(transform) ? transform : [transform];

    for (const t of transforms) {
      switch (t) {
        case 'number':
          value = parseInt(value.replace(/[^\d-]/g, ''), 10);
          if (isNaN(value)) value = 0;
          break;

        case 'float':
          value = parseFloat(value.replace(/[^\d.-]/g, ''));
          if (isNaN(value)) value = 0;
          break;

        case 'boolean':
          value = ['true', 'yes', '1', 'on', 'oui'].includes(value.toLowerCase());
          break;

        case 'lowercase':
          value = value.toLowerCase();
          break;

        case 'uppercase':
          value = value.toUpperCase();
          break;

        case 'trim':
          value = value.trim();
          break;

        default:
          console.warn(`Unknown transform: ${t}`);
      }
    }

    return value;
  }

  /**
   * Set a nested value in an object using dot notation
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }
}
