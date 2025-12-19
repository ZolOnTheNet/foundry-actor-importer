# Analyse de l'Implémentation Existante et Modifications Proposées

**Date**: 2025-11-27
**Fichier de référence**: Plan principal dans `visual-model-builder-plan.md`

---

## 1. État Actuel du Code

### Fichiers Existants

```
scripts/
├── template-app.mjs              ✓ Interface principale (980 lignes)
├── template-manager.mjs          ✓ Gestion des templates
├── template-parser.mjs           ✓ Parser pour templates
├── modals/
│   ├── construct-editor-modal.mjs    ✓ Modal pour constructs
│   └── save-template-modal.mjs       ✓ Modal pour sauvegarde
templates/
└── template-creator.html         ✓ Template HTML (145 lignes)
styles/
└── actor-importer.css            ✓ Styles existants
```

### Fonctionnalités Déjà Implémentées

#### ✅ Interface de Base
- Mode Create/Apply
- Sélection système (Daggerheart, D&D 5e, Project FU, PF2e, Other)
- Sélection de templates existants
- Panneau gauche: Source text (contenteditable)
- Panneau droit: Annotated model (preview)

#### ✅ Outils Basiques
- **Skip** (à renommer "Next") - ligne 110, 319-338
- **Multiline** - ligne 111, 343-354
- **Construct** - ligne 112, 359-401
- **List** - ligne 113, 406-410 (TODO: pas implémenté)
- **Transform** - ligne 114, 415-462
- **Eraser** - ligne 115, 467-481

#### ✅ Boutons de Champ
- Génération dynamique depuis `_getSystemFields()` - ligne 59-88
- Création d'annotations au clic - ligne 289-313

#### ✅ Système d'Annotations
- Structure d'annotation: `{id, start, end, field, selectedText, mode}`
- Génération HTML annoté: `_generateAnnotatedHtml()` - ligne 773-816
- Tags visuels: `[field]text[/field]`
- Gestion constructs: Modal ConstructEditorModal

#### ✅ Export/Import/Sauvegarde
- Format template JSON v1
- Export/Import templates
- Sauvegarde dans game settings

---

## 2. Problèmes Identifiés

### 2.1 Pas de Couleurs ❌

**Problème**: Les annotations ne sont pas colorées, seulement des tags `[field]text[/field]`

**Impact**:
- Difficile de voir visuellement la correspondance entre gauche et droite
- Pas de feedback visuel immédiat
- Impossible de distinguer rapidement les zones mappées

**Localisation**:
- `_generateAnnotatedHtml()` ligne 773-816
- CSS: Pas de classes pour couleurs de tokens

### 2.2 Pas de Hover Info ❌

**Problème**: Aucun tooltip n'affiche le codage sur survol

**Impact**:
- Utilisateur ne sait pas quel champ est mappé sans cliquer
- Pas d'info sur le type de transformation appliquée

**Localisation**:
- Pas de event listener `mouseover` sur les tags
- Pas de CSS pour tooltips

### 2.3 Outil "List" Non Implémenté ❌

**Problème**: `_onListTool()` affiche juste "not yet implemented" (ligne 407-410)

**Impact**:
- Impossible de marquer des listes répétitives
- Pas de détection automatique de patterns

### 2.4 Champs Non Exhaustifs ❌

**Problème**: `_getSystemFields()` a une liste limitée

**Exemple Daggerheart** (ligne 62-68):
```javascript
daggerheart: [
  'name', 'tier', 'type', 'description', 'motives',
  'difficulty', 'threshold.major', 'threshold.severe',
  'health.max', 'stress.max',
  'weapon.name', 'weapon.tohit', 'weapon.range', 'weapon.damage',
  'experience.name', 'experience.value'
]
```

**Manquants**:
- `weapon-main`, `weapon-secondary`
- `defenses.evasion`, `defenses.armor`
- Champs items: `items[].name`, `items[].system.*`

**Impact**:
- Utilisateur ne peut pas mapper certains champs
- Nécessite saisie manuelle (non implémenté)

### 2.5 Pas de Table de Mapping ❌

**Problème**: Aucun système pour définir calculs ou transformations complexes

**Impact**:
- Impossible de faire `hp * 10`
- Impossible de gérer fallback `value || default`
- Transformations limitées à la liste prédéfinie (number, trim, etc.)

### 2.6 Pas de Tooltips sur Outils ❌

**Problème**: Boutons outils sans tooltip explicatif (sauf Eraser qui a `data-tooltip`)

**Localisation**:
- Template HTML ligne 122-139
- Seulement Eraser a un attribut `data-tooltip`

### 2.7 Preview Non Coloré ❌

**Problème**: Le panneau de droite montre du texte brut avec des tags, pas de zones colorées

**Impact**:
- Pas de visualisation claire des zones mappées
- Difficile de voir la structure du modèle

---

## 3. Modifications Concrètes à Apporter

### Phase 1: Système de Couleurs (Priorité Haute)

#### 3.1 Créer ColorManager

**Nouveau fichier**: `scripts/visual-model/color-manager.mjs`

```javascript
export class ColorManager {
  constructor() {
    this.colorIndex = 0;
    this.tokenColors = new Map(); // tokenId → color
  }

  /**
   * Génère couleur HSL unique
   * @param {number} index Index de couleur (0-11)
   * @returns {string} Couleur HSL
   */
  generateColor(index) {
    const hue = (index * 30) % 360; // 12 couleurs max
    const saturation = 70;
    const lightness = 85; // Clair pour fond
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Obtient couleur plus foncée pour bordure
   * @param {string} hslColor Couleur HSL
   * @returns {string} Couleur plus foncée
   */
  getDarkerShade(hslColor) {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const [, h, s, l] = match;
      return `hsl(${h}, ${s}%, ${Math.max(0, parseInt(l) - 30)}%)`;
    }
    return hslColor;
  }

  /**
   * Assigne couleur à un token
   * @param {string} tokenId ID du token
   * @returns {object} {background, border}
   */
  assignColor(tokenId) {
    if (this.tokenColors.has(tokenId)) {
      return this.tokenColors.get(tokenId);
    }

    const bgColor = this.generateColor(this.colorIndex);
    const borderColor = this.getDarkerShade(bgColor);

    const colors = { background: bgColor, border: borderColor };
    this.tokenColors.set(tokenId, colors);
    this.colorIndex++;

    return colors;
  }

  /**
   * Obtient couleur d'un token
   * @param {string} tokenId ID du token
   * @returns {object|null} {background, border} ou null
   */
  getColor(tokenId) {
    return this.tokenColors.get(tokenId) || null;
  }

  /**
   * Réinitialise toutes les couleurs
   */
  reset() {
    this.colorIndex = 0;
    this.tokenColors.clear();
  }
}
```

#### 3.2 Intégrer ColorManager dans ImportTemplateApp

**Modifier**: `scripts/template-app.mjs`

```javascript
import { ColorManager } from './visual-model/color-manager.mjs';

export class ImportTemplateApp extends Application {
  constructor(options = {}) {
    super(options);
    // ... existant ...
    this.colorManager = new ColorManager(); // NOUVEAU
  }

  // Modifier _onFieldButton (ligne 289-313)
  _onFieldButton(event) {
    const field = $(event.currentTarget).data('field');

    if (!this.selectedRange) {
      ui.notifications.warn('Please select text first');
      return;
    }

    const annotation = {
      id: `ann-${Date.now()}`,
      start: this.selectedRange.start,
      end: this.selectedRange.end,
      field: field,
      selectedText: this.selectedRange.text,
      mode: this._detectMode(this.selectedRange),
      colors: this.colorManager.assignColor(`ann-${Date.now()}`) // NOUVEAU
    };

    this.annotations.push(annotation);
    this._updateDisplay();

    this.selectedRange = null;
    window.getSelection().removeAllRanges();
  }

  // Modifier _generateAnnotatedHtml (ligne 773-816)
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

      // Génerer style inline avec couleurs
      const colors = annot.colors || this.colorManager.getColor(annot.id) || {background: '#f0f0f0', border: '#ccc'};
      const style = `background-color: ${colors.background}; border-left: 4px solid ${colors.border}; padding: 2px 4px; margin: 0 1px;`;

      // Annotation avec couleur
      if (annot.skip) {
        html += `<span class="tag tag-skip" data-id="${annot.id}" style="${style}" data-field="Skip">[&gt;&gt;&gt;]</span>`;
        html += this._escapeHtml(annot.selectedText);
        html += `<span class="tag-close">[/]</span>`;
      } else if (annot.constructId) {
        html += `<span class="tag tag-construct" data-id="${annot.id}" style="${style}" data-field="Construct:${annot.constructId}">[construct:${annot.constructId}]</span>`;
        html += this._escapeHtml(annot.selectedText);
        html += `<span class="tag-close">[/]</span>`;
      } else {
        const modeStr = typeof annot.mode === 'string' ? annot.mode : annot.mode.mode;
        const modeLabel = modeStr !== 'toNewline' ? ':' + modeStr : '';
        html += `<span class="tag" data-id="${annot.id}" style="${style}" data-field="${annot.field}" data-mode="${modeStr}">[${annot.field}${modeLabel}]</span>`;

        // Texte avec fond coloré AUSSI
        html += `<span class="annotated-text" data-id="${annot.id}" style="${style}">${this._escapeHtml(annot.selectedText)}</span>`;

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
}
```

#### 3.3 Ajouter Hover Tooltips

**Modifier**: `scripts/template-app.mjs` - méthode `activateListeners()`

```javascript
activateListeners(html) {
  super.activateListeners(html);

  // ... existant ...

  // NOUVEAU: Hover sur tags pour afficher info
  html.find('#annotated-model').on('mouseenter', '.tag, .annotated-text', this._onTagHover.bind(this));
  html.find('#annotated-model').on('mouseleave', '.tag, .annotated-text', this._onTagLeave.bind(this));
}

/**
 * Handle tag hover - affiche tooltip
 * @private
 */
_onTagHover(event) {
  const annotationId = $(event.currentTarget).data('id');
  const annotation = this.annotations.find(a => a.id === annotationId);

  if (!annotation) return;

  // Créer tooltip
  const tooltip = $('<div class="annotation-tooltip"></div>');

  let content = `<strong>Field:</strong> ${annotation.field || 'Skip'}<br>`;

  if (annotation.mode) {
    const modeStr = typeof annotation.mode === 'string' ? annotation.mode : annotation.mode.mode;
    content += `<strong>Mode:</strong> ${modeStr}<br>`;
  }

  if (annotation.transform && annotation.transform.length > 0) {
    content += `<strong>Transform:</strong> ${annotation.transform.join(', ')}<br>`;
  }

  content += `<strong>Text:</strong> "${annotation.selectedText}"`;

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
 * Handle tag leave - retire tooltip
 * @private
 */
_onTagLeave(event) {
  $('.annotation-tooltip').remove();
}
```

**Ajouter CSS**: `styles/actor-importer.css`

```css
/* Tooltips pour annotations */
.annotation-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 300px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  line-height: 1.4;
}

.annotation-tooltip strong {
  color: #ffa500;
  font-weight: bold;
}

/* Style pour texte annoté */
.annotated-text {
  display: inline;
  border-radius: 3px;
  cursor: help;
  transition: opacity 0.2s;
}

.annotated-text:hover {
  opacity: 0.8;
}

/* Tags avec couleurs */
.tag {
  display: inline-block;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.2s;
}

.tag:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.tag-close {
  color: #999;
  font-size: 10px;
  font-family: monospace;
  margin-left: 2px;
}
```

---

### Phase 2: Renommer et Améliorer Outils (Priorité Haute)

#### 3.4 Renommer "Skip" → "Next"

**Modifier**: `templates/template-creator.html` ligne 122-124

```html
<button class="tool-btn" id="tool-next" title="Mark separator keyword (e.g. '|', 'ATK:', 'HP:') that indicates the end of one value and start of next">
  <i class="fas fa-arrow-right"></i> Next
</button>
```

**Modifier**: `scripts/template-app.mjs` ligne 110, 319-338

```javascript
// Ligne 110
html.find('#tool-next').on('click', this._onNextTool.bind(this));

// Renommer méthode (ligne 319)
_onNextTool(event) {
  if (!this.selectedRange) {
    ui.notifications.warn('Please select text first');
    return;
  }

  const annotation = {
    id: `ann-${Date.now()}`,
    start: this.selectedRange.start,
    end: this.selectedRange.end,
    next: true, // Renommer skip → next
    selectedText: this.selectedRange.text,
    colors: this.colorManager.assignColor(`ann-${Date.now()}`)
  };

  this.annotations.push(annotation);
  this._updateDisplay();

  this.selectedRange = null;
  window.getSelection().removeAllRanges();
}
```

#### 3.5 Ajouter Tooltips à Tous les Outils

**Modifier**: `templates/template-creator.html` ligne 120-141

```html
<div class="toolbar-section">
  <h4>{{localize "ACTOR_IMPORTER.Tools"}}</h4>
  <div class="tool-buttons">
    <button class="tool-btn" id="tool-next"
            title="Mark separator keyword that indicates the end of one value and start of next (e.g. '|', 'ATK:', 'HP:')">
      <i class="fas fa-arrow-right"></i> Next
    </button>

    <button class="tool-btn" id="tool-multiline"
            title="Mark selected text as multiline field (preserves line breaks)">
      <i class="fas fa-align-left"></i> Multi
    </button>

    <button class="tool-btn" id="tool-item"
            title="Mark this construct as a Foundry item (weapon, feature, spell, etc.)">
      <i class="fas fa-cube"></i> Item
    </button>

    <button class="tool-btn" id="tool-construct"
            title="After defining fields and Next tokens in an element, select it to create a reusable pattern">
      <i class="fas fa-tools"></i> Construct
    </button>

    <button class="tool-btn" id="tool-list"
            title="Select the entire text of a repetitive list (e.g. all features, all weapons) to apply a construct pattern">
      <i class="fas fa-list"></i> List
    </button>

    <button class="tool-btn" id="tool-transform"
            title="Add transformations to the last annotation (number, trim, lowercase, etc.)">
      <i class="fas fa-exchange-alt"></i> Transform
    </button>

    <button class="tool-btn" id="tool-eraser"
            title="Click on a tag to delete it">
      <i class="fas fa-eraser"></i> Eraser
    </button>
  </div>
</div>
```

#### 3.6 Ajouter Outil "Item"

**Modifier**: `templates/template-creator.html` - ajouter après multiline

```html
<button class="tool-btn" id="tool-item"
        title="Mark this construct as a Foundry item (weapon, feature, spell, etc.)">
  <i class="fas fa-cube"></i> Item
</button>
```

**Modifier**: `scripts/template-app.mjs` - ajouter event listener et handler

```javascript
// Dans activateListeners()
html.find('#tool-item').on('click', this._onItemTool.bind(this));

/**
 * Handle item tool - marque annotation comme item Foundry
 * @private
 */
_onItemTool(event) {
  if (this.annotations.length === 0) {
    ui.notifications.warn('Please create a construct annotation first');
    return;
  }

  // Marquer la dernière annotation comme item
  const lastAnnotation = this.annotations[this.annotations.length - 1];

  if (!lastAnnotation.constructId && !lastAnnotation.construct) {
    ui.notifications.warn('Item marker can only be applied to construct annotations');
    return;
  }

  // Ouvrir dialog pour choisir type d'item
  new Dialog({
    title: 'Item Configuration',
    content: `
      <form>
        <div class="form-group">
          <label>Item Type:</label>
          <select name="itemType">
            <option value="weapon">Weapon</option>
            <option value="feature">Feature</option>
            <option value="spell">Spell</option>
            <option value="equipment">Equipment</option>
            <option value="consumable">Consumable</option>
          </select>
        </div>
        <div class="form-group">
          <label>Category (if applicable):</label>
          <input type="text" name="category" placeholder="e.g. Action, Reaction, Passive" />
        </div>
      </form>
    `,
    buttons: {
      apply: {
        label: 'Apply',
        callback: (html) => {
          const itemType = html.find('[name="itemType"]').val();
          const category = html.find('[name="category"]').val();

          lastAnnotation.itemType = itemType;
          if (category) lastAnnotation.itemCategory = category;

          this._updateDisplay();
          ui.notifications.info(`Marked as ${itemType} item`);
        }
      },
      cancel: {
        label: 'Cancel'
      }
    },
    default: 'apply'
  }).render(true);
}
```

---

### Phase 3: Table de Mapping Variables (Priorité Moyenne)

#### 3.7 Créer MappingTable Component

**Nouveau fichier**: `scripts/visual-model/mapping-table.mjs`

```javascript
export class MappingTable {
  constructor(parentApp) {
    this.parentApp = parentApp;
    this.mappings = [];
  }

  /**
   * Génère HTML pour la table
   * @returns {string} HTML
   */
  render() {
    let html = `
      <div class="mapping-table-container">
        <div class="mapping-table-header">
          <h4>Field Mapping & Calculations</h4>
          <button class="add-mapping-btn" title="Add new mapping">
            <i class="fas fa-plus"></i> Add
          </button>
        </div>
        <table class="mapping-table">
          <thead>
            <tr>
              <th style="width: 30%">Target Field (Actor/Item)</th>
              <th style="width: 30%">Expression/Variable</th>
              <th style="width: 35%">Comment</th>
              <th style="width: 5%"></th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const mapping of this.mappings) {
      html += this._renderMappingRow(mapping);
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Génère HTML pour une ligne de mapping
   * @private
   */
  _renderMappingRow(mapping) {
    return `
      <tr data-mapping-id="${mapping.id}">
        <td>
          <input type="text" class="mapping-target"
                 value="${mapping.target || ''}"
                 placeholder="e.g. system.health.max" />
        </td>
        <td>
          <input type="text" class="mapping-expression"
                 value="${mapping.expression || ''}"
                 placeholder="e.g. hp * 10 + tier * 5" />
        </td>
        <td>
          <input type="text" class="mapping-comment"
                 value="${mapping.comment || ''}"
                 placeholder="Optional comment" />
        </td>
        <td>
          <button class="delete-mapping-btn" data-id="${mapping.id}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  /**
   * Ajoute mapping automatique depuis annotations
   */
  autoPopulate(annotations) {
    // Extraire champs uniques
    const fields = new Set();
    for (const annot of annotations) {
      if (annot.field) {
        fields.add(annot.field);
      }
    }

    // Créer mappings identiques par défaut
    for (const field of fields) {
      const varName = field.split('.').pop(); // "health.max" → "max"
      this.addMapping({
        target: field,
        expression: varName,
        comment: '(auto-generated, identical)'
      });
    }
  }

  /**
   * Ajoute un mapping
   */
  addMapping(data = {}) {
    const mapping = {
      id: `map-${Date.now()}`,
      target: data.target || '',
      expression: data.expression || '',
      comment: data.comment || ''
    };
    this.mappings.push(mapping);
    return mapping;
  }

  /**
   * Supprime un mapping
   */
  deleteMapping(id) {
    const index = this.mappings.findIndex(m => m.id === id);
    if (index !== -1) {
      this.mappings.splice(index, 1);
    }
  }

  /**
   * Évalue une expression avec contexte
   * @param {string} expression Expression à évaluer
   * @param {object} context Variables disponibles
   * @returns {any} Résultat
   */
  evaluate(expression, context) {
    // Simple evaluator - peut être remplacé par math.js
    try {
      // Remplacer variables par context[var]
      let code = expression;
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        const safeValue = typeof value === 'string' ? `"${value}"` : value;
        code = code.replace(regex, safeValue);
      }

      // Évaluer (ATTENTION: eval est dangereux, à sécuriser)
      return eval(code);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return null;
    }
  }

  /**
   * Valide une expression
   * @param {string} expression Expression à valider
   * @returns {boolean} Valide ou non
   */
  validate(expression) {
    // Vérifier syntaxe basique
    const allowedChars = /^[a-zA-Z0-9_\s\+\-\*\/\(\)\|\&\?\:\.\[\]"']+$/;
    return allowedChars.test(expression);
  }

  /**
   * Exporte les mappings au format template
   */
  export() {
    return this.mappings.map(m => ({
      target: m.target,
      expression: m.expression,
      comment: m.comment
    }));
  }

  /**
   * Importe des mappings depuis template
   */
  import(mappings) {
    this.mappings = [];
    for (const m of mappings) {
      this.addMapping(m);
    }
  }
}
```

#### 3.8 Intégrer MappingTable dans Template

**Modifier**: `templates/template-creator.html` - ajouter après toolbar

```html
<!-- Mapping Table (visible uniquement en mode create) -->
{{#if (eq mode "create")}}
  <div class="mapping-section">
    <div id="mapping-table-container"></div>
  </div>
{{/if}}
```

**Modifier**: `scripts/template-app.mjs`

```javascript
import { MappingTable } from './visual-model/mapping-table.mjs';

export class ImportTemplateApp extends Application {
  constructor(options = {}) {
    super(options);
    // ... existant ...
    this.mappingTable = new MappingTable(this); // NOUVEAU
  }

  getData() {
    return {
      // ... existant ...
      mappingTableHtml: this.mappingTable.render() // NOUVEAU
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    // ... existant ...

    // NOUVEAU: Mapping table events
    html.find('.add-mapping-btn').on('click', this._onAddMapping.bind(this));
    html.find('.delete-mapping-btn').on('click', this._onDeleteMapping.bind(this));
    html.find('.mapping-target, .mapping-expression, .mapping-comment').on('change', this._onMappingChange.bind(this));
  }

  _onAddMapping(event) {
    this.mappingTable.addMapping();
    this._updateMappingTable();
  }

  _onDeleteMapping(event) {
    const id = $(event.currentTarget).data('id');
    this.mappingTable.deleteMapping(id);
    this._updateMappingTable();
  }

  _onMappingChange(event) {
    const row = $(event.currentTarget).closest('tr');
    const id = row.data('mapping-id');
    const mapping = this.mappingTable.mappings.find(m => m.id === id);

    if (mapping) {
      mapping.target = row.find('.mapping-target').val();
      mapping.expression = row.find('.mapping-expression').val();
      mapping.comment = row.find('.mapping-comment').val();
    }
  }

  _updateMappingTable() {
    const container = this.element.find('#mapping-table-container');
    container.html(this.mappingTable.render());
    this.activateListeners(this.element);
  }
}
```

**Ajouter CSS**: `styles/actor-importer.css`

```css
/* Mapping Table */
.mapping-section {
  border-top: 2px solid #7a7971;
  padding-top: 10px;
  margin-top: 10px;
}

.mapping-table-container {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 10px;
}

.mapping-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.mapping-table-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: bold;
}

.add-mapping-btn {
  background: #4b9e4b;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.add-mapping-btn:hover {
  background: #3d8b3d;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.mapping-table th {
  background: #e0e0e0;
  padding: 8px;
  text-align: left;
  font-size: 12px;
  font-weight: bold;
  border-bottom: 2px solid #ccc;
}

.mapping-table td {
  padding: 5px;
  border-bottom: 1px solid #ddd;
}

.mapping-table input[type="text"] {
  width: 100%;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
}

.mapping-table input[type="text"]:focus {
  outline: none;
  border-color: #4b9e4b;
  box-shadow: 0 0 3px rgba(75, 158, 75, 0.5);
}

.delete-mapping-btn {
  background: #d9534f;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.delete-mapping-btn:hover {
  background: #c9302c;
}
```

---

### Phase 4: Implémenter Outil List (Priorité Moyenne)

#### 3.9 Compléter _onListTool

**Modifier**: `scripts/template-app.mjs` ligne 406-410

```javascript
/**
 * Handle list tool - applique construct à une liste
 * @private
 */
_onListTool(event) {
  if (!this.selectedRange) {
    ui.notifications.warn('Please select the entire list text first');
    return;
  }

  // Chercher constructs disponibles
  const constructIds = Object.keys(this.constructs);

  if (constructIds.length === 0) {
    ui.notifications.warn('Please create a construct first using the Construct tool');
    return;
  }

  // Dialog pour choisir construct
  let optionsHtml = '';
  for (const id of constructIds) {
    const construct = this.constructs[id];
    optionsHtml += `<option value="${id}">${construct.description || id}</option>`;
  }

  new Dialog({
    title: 'Apply Construct to List',
    content: `
      <form>
        <div class="form-group">
          <label>Select Construct Pattern:</label>
          <select name="constructId">
            ${optionsHtml}
          </select>
        </div>
        <p class="notes">The selected construct will be applied to detect all items in the selected list.</p>
      </form>
    `,
    buttons: {
      apply: {
        label: 'Apply',
        callback: (html) => {
          const constructId = html.find('[name="constructId"]').val();
          this._applyConstructToList(constructId, this.selectedRange);
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
 * Applique construct à une zone de texte (détection auto)
 * @private
 */
_applyConstructToList(constructId, range) {
  const construct = this.constructs[constructId];
  if (!construct) return;

  const listText = range.text;

  // TODO: Implémenter détection de pattern
  // Pour l'instant, créer une annotation de liste simple
  const annotation = {
    id: `ann-${Date.now()}`,
    start: range.start,
    end: range.end,
    listId: `list-${Date.now()}`,
    constructId: constructId,
    selectedText: listText,
    colors: this.colorManager.assignColor(`ann-${Date.now()}`)
  };

  this.annotations.push(annotation);
  this._updateDisplay();

  this.selectedRange = null;
  window.getSelection().removeAllRanges();

  ui.notifications.info(`List annotation created with construct ${constructId}`);
}
```

---

### Phase 5: Ajouter Champs Custom (Priorité Basse)

#### 3.10 Bouton "Custom Field"

**Modifier**: `templates/template-creator.html` après field-buttons

```html
<div class="field-buttons" id="system-fields">
  {{#each systemFields}}
    <button class="field-btn" data-field="{{this}}">{{this}}</button>
  {{/each}}

  <!-- NOUVEAU -->
  <button class="field-btn field-btn-custom" id="add-custom-field">
    <i class="fas fa-plus"></i> Custom Field
  </button>
</div>
```

**Modifier**: `scripts/template-app.mjs`

```javascript
activateListeners(html) {
  super.activateListeners(html);
  // ... existant ...

  // NOUVEAU: Custom field
  html.find('#add-custom-field').on('click', this._onAddCustomField.bind(this));
}

/**
 * Handle add custom field
 * @private
 */
_onAddCustomField(event) {
  if (!this.selectedRange) {
    ui.notifications.warn('Please select text first');
    return;
  }

  new Dialog({
    title: 'Add Custom Field',
    content: `
      <form>
        <div class="form-group">
          <label>Field Path:</label>
          <input type="text" name="fieldPath" placeholder="e.g. system.custom.myfield" autofocus />
          <p class="notes">Enter the full path to the field in the actor data structure.</p>
        </div>
      </form>
    `,
    buttons: {
      add: {
        label: 'Add',
        callback: (html) => {
          const fieldPath = html.find('[name="fieldPath"]').val().trim();

          if (!fieldPath) {
            ui.notifications.warn('Please enter a field path');
            return;
          }

          // Créer annotation avec champ custom
          const annotation = {
            id: `ann-${Date.now()}`,
            start: this.selectedRange.start,
            end: this.selectedRange.end,
            field: fieldPath,
            selectedText: this.selectedRange.text,
            mode: this._detectMode(this.selectedRange),
            colors: this.colorManager.assignColor(`ann-${Date.now()}`)
          };

          this.annotations.push(annotation);
          this._updateDisplay();

          this.selectedRange = null;
          window.getSelection().removeAllRanges();

          ui.notifications.info(`Custom field "${fieldPath}" added`);
        }
      },
      cancel: {
        label: 'Cancel'
      }
    },
    default: 'add'
  }).render(true);
}
```

---

## 4. Résumé des Changements

### Fichiers à Créer

1. ✅ `doc/visual-model-builder-plan.md` (ce document)
2. ✅ `doc/implementation-analysis.md` (analyse détaillée)
3. ⬜ `scripts/visual-model/color-manager.mjs` (Phase 1)
4. ⬜ `scripts/visual-model/mapping-table.mjs` (Phase 3)

### Fichiers à Modifier

1. ⬜ `scripts/template-app.mjs`
   - Intégrer ColorManager
   - Modifier `_generateAnnotatedHtml()` pour couleurs
   - Ajouter hover events et tooltips
   - Renommer Skip → Next
   - Ajouter outil Item
   - Compléter outil List
   - Ajouter custom fields
   - Intégrer MappingTable

2. ⬜ `templates/template-creator.html`
   - Renommer bouton Skip → Next
   - Ajouter tooltips à tous les outils
   - Ajouter bouton Item
   - Ajouter bouton Custom Field
   - Ajouter section MappingTable

3. ⬜ `styles/actor-importer.css`
   - Styles tooltips annotations
   - Styles texte coloré
   - Styles mapping table
   - Styles boutons custom

### Ordre d'Implémentation Recommandé

1. **Phase 1** (2-3h): ColorManager + couleurs basiques
2. **Phase 2** (1-2h): Renommer outils + tooltips + Item
3. **Phase 3** (3-4h): MappingTable complète
4. **Phase 4** (2h): Outil List fonctionnel
5. **Phase 5** (1h): Custom fields

**Total estimé**: 9-12 heures de développement

---

## 5. Questions pour Validation

1. **Couleurs**: Le système de 12 couleurs HSL est-il suffisant ou faut-il plus ?
2. **Mapping Table**: Faut-il supporter des fonctions custom (ex: `normalizeTier()`) dès maintenant ?
3. **Outil List**: La détection automatique de pattern doit-elle être regex-based ou basée sur les tokens existants ?
4. **Custom Fields**: Faut-il une validation des chemins ou accepter n'importe quoi ?
5. **Performance**: À partir de combien d'annotations faut-il virtualiser l'affichage ?

---

**Prochaine étape**: Valider ce plan avec l'utilisateur avant de commencer l'implémentation de Phase 1.
