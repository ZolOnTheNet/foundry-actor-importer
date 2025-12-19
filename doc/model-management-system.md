# Système de Gestion des Modèles - Architecture

**Date**: 2025-11-27
**Priorité**: HAUTE
**Statut**: En implémentation

---

## Vue d'Ensemble

Le système de gestion des modèles permet de créer, sauvegarder, charger, exporter et importer des templates d'import d'acteurs.

### Deux Types de Modèles

1. **Modèles Globaux (Module)**
   - Stockés dans `models/` du module
   - Préfixés "(global)" dans l'UI
   - Non modifiables directement
   - Peuvent être sauvegardés sous un autre nom (devient local)
   - Chargés automatiquement si système compatible

2. **Modèles Locaux (Monde)**
   - Stockés dans world settings
   - Affichés sans préfixe
   - Modifiables et supprimables
   - Spécifiques au monde actuel

---

## Structure JSON des Modèles

### Format Template v2

```json
{
  "templateFormat": "fvtt-import-v2",
  "version": "2.0.0",
  "metadata": {
    "id": "daggerheart-standard",
    "name": "Daggerheart Standard",
    "system": "daggerheart",
    "compatibleSystems": ["daggerheart", "daggerheart-unofficial"],
    "author": "Actor Importer Module",
    "description": "Standard Daggerheart creature import template",
    "created": "2025-11-27T10:00:00.000Z",
    "updated": "2025-11-27T12:00:00.000Z",
    "isGlobal": true
  },
  "annotations": [
    {
      "id": "ann-1",
      "start": 0,
      "end": 10,
      "field": "name",
      "selectedText": "Goblin",
      "mode": "toNewline",
      "colors": {
        "background": "hsl(0, 70%, 85%)",
        "border": "hsl(0, 70%, 55%)"
      }
    }
  ],
  "constructs": {
    "feature-1": {
      "id": "feature-1",
      "name": "Feature Pattern",
      "pattern": "{{name}} ({{uses}}) - {{category}}: {{description}}",
      "fields": ["name", "uses", "category", "description"],
      "description": "Standard feature format",
      "itemType": "feature",
      "itemCategory": "Action"
    }
  },
  "tokens": [
    {
      "id": "tok-1",
      "field": "name",
      "mode": "toNewline"
    },
    {
      "id": "tok-skip-1",
      "skip": "|",
      "mode": "literal"
    }
  ],
  "mappings": [
    {
      "target": "system.health.max",
      "expression": "hp * 10",
      "comment": "HP multiplié par 10"
    }
  ],
  "colorData": {
    "ann-1": {
      "background": "hsl(0, 70%, 85%)",
      "border": "hsl(0, 70%, 55%)"
    }
  }
}
```

### Champs Importants

- **`templateFormat`**: Identifie le format ("fvtt-import-v2")
- **`version`**: Version du format (semantic versioning)
- **`metadata.compatibleSystems`**: Liste des systèmes compatibles (tableau)
- **`metadata.isGlobal`**: True si modèle global (module), false si local
- **`colorData`**: Map tokenId → colors (pour restaurer couleurs)

---

## Stockage World Settings

### Clés Game Settings

#### 1. Liste des Modèles Locaux

**Clé**: `actor-importer.localmodel`
**Type**: `Array<string>`
**Scope**: `world`

```json
[
  "my-custom-daggerheart",
  "goblin-importer",
  "fabula-villain-fr"
]
```

#### 2. Données de Chaque Modèle

**Clé**: `actor-importer.<modelId>`
**Type**: `Object` (structure JSON template)
**Scope**: `world`

Exemple: `actor-importer.my-custom-daggerheart`

```json
{
  "templateFormat": "fvtt-import-v2",
  "version": "2.0.0",
  "metadata": {
    "id": "my-custom-daggerheart",
    "name": "My Custom Daggerheart",
    ...
  },
  ...
}
```

### Enregistrement Settings

```javascript
// Dans actor-importer.mjs (init hook)
Hooks.once('init', () => {
  // Liste des modèles locaux
  game.settings.register('actor-importer', 'localmodel', {
    name: 'Local Templates List',
    hint: 'List of all local template IDs',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Note: Les modèles individuels sont enregistrés dynamiquement
  // via ImportTemplateManager.saveTemplate()
});
```

---

## Structure Répertoire Modèles Globaux

```
modules/actor-importer/
├── models/
│   ├── daggerheart-standard.json
│   ├── daggerheart-incredible-creatures.json
│   ├── fabula-ultima-fr.json
│   └── dnd5e-monster.json
├── scripts/
│   ├── template-manager.mjs  (gère chargement)
│   └── ...
```

### Chargement Automatique

Au démarrage du module (`init` hook):
1. Lire tous les fichiers JSON dans `models/`
2. Parser chaque JSON
3. Vérifier `compatibleSystems` contient système actuel
4. Si compatible, copier dans world settings (si pas déjà existant)
5. Marquer comme global (`isGlobal: true`)

---

## Interface Utilisateur

### Modification Template Header

**Actuel**:
```html
<select id="template-select">
  <option value="">New Template</option>
  <option value="template1">Template 1</option>
</select>
```

**Nouveau**:
```html
<div class="template-controls">
  <!-- Selector -->
  <select id="template-select">
    <option value="">New Template</option>
    <optgroup label="Global Templates">
      <option value="global:daggerheart-standard">Daggerheart Standard (global)</option>
      <option value="global:daggerheart-incredible">Daggerheart Incredible Creatures (global)</option>
    </optgroup>
    <optgroup label="Local Templates">
      <option value="local:my-custom">My Custom Daggerheart</option>
      <option value="local:goblin-import">Goblin Importer</option>
    </optgroup>
  </select>

  <!-- Editable name -->
  <input type="text" id="template-name" placeholder="Template name" value="" />

  <!-- Save button -->
  <button id="save-template-btn" class="icon-button" title="Save template">
    <i class="fas fa-save"></i>
  </button>

  <!-- Save As button -->
  <button id="save-as-template-btn" class="icon-button" title="Save as new template">
    <i class="fas fa-copy"></i> Save As
  </button>

  <!-- Export button -->
  <button id="export-template-btn" class="icon-button" title="Export template to file">
    <i class="fas fa-file-export"></i>
  </button>

  <!-- Import button -->
  <button id="import-template-btn" class="icon-button" title="Import template from file">
    <i class="fas fa-file-import"></i>
  </button>

  <!-- Delete button (only for local) -->
  <button id="delete-template-btn" class="icon-button danger" title="Delete template" disabled>
    <i class="fas fa-trash"></i>
  </button>
</div>
```

### Comportement UI

#### Champ Nom Template

- **Nouveau template**: Vide, placeholder "Template name"
- **Template global sélectionné**: Affiche nom **sans** "(global)"
- **Template local sélectionné**: Affiche nom, éditable
- **Modification du nom**: Active bouton "Save As" automatiquement

#### Bouton Save

- **Nouveau template**: Devient "Save As" (crée nouveau)
- **Template local**: Sauvegarde sur template existant
- **Template global**: Désactivé (seulement "Save As")

#### Bouton Save As

- Toujours actif
- Ouvre dialog pour saisir nouveau nom
- Crée copie locale

#### Bouton Delete

- Activé seulement si template local sélectionné
- Désactivé si nouveau ou global
- Confirmation avant suppression

---

## Flux de Travail Utilisateur

### Scénario 1: Créer Nouveau Modèle Local

1. Ouvrir Template Creator
2. Combobox sur "New Template"
3. Créer annotations, constructs, etc.
4. Saisir nom dans champ: "My Goblin Importer"
5. Cliquer "Save" ou "Save As"
6. → Sauvegardé comme `local:my-goblin-importer` dans world settings
7. → Apparaît dans combobox section "Local Templates"

### Scénario 2: Modifier Modèle Global

1. Sélectionner "Daggerheart Standard (global)"
2. Champ nom affiche: "Daggerheart Standard"
3. Modifier annotations
4. Bouton "Save" désactivé
5. Bouton "Save As" actif
6. Cliquer "Save As" → Dialog "Save as: Daggerheart Standard Copy"
7. → Sauvegardé comme local, peut maintenant modifier

### Scénario 3: Exporter pour Partage

1. Sélectionner template local
2. Cliquer "Export"
3. → Télécharge `my-goblin-importer.json`
4. Envoyer fichier à autre utilisateur

### Scénario 4: Importer depuis Communauté

1. Cliquer "Import"
2. Sélectionner fichier `community-template.json`
3. → Parse JSON, valide format
4. → Sauvegarde comme local avec ID unique
5. → Affiche notification "Template imported: Community Template"

---

## Implémentation Code

### 1. Modifier ImportTemplateManager

**Fichier**: `scripts/template-manager.mjs`

```javascript
export class ImportTemplateManager {
  static globalTemplates = {}; // Modèles globaux chargés depuis module
  static localTemplates = {};  // Modèles locaux depuis world settings

  /**
   * Initialize - charge global et local templates
   */
  static async initialize() {
    await this.loadGlobalTemplates();
    await this.loadLocalTemplates();
  }

  /**
   * Charge modèles globaux depuis models/
   */
  static async loadGlobalTemplates() {
    const modelFiles = [
      'daggerheart-standard.json',
      'daggerheart-incredible-creatures.json',
      'fabula-ultima-fr.json'
    ];

    for (const file of modelFiles) {
      try {
        const response = await fetch(`modules/actor-importer/models/${file}`);
        if (!response.ok) continue;

        const template = await response.json();

        // Valider compatibilité système
        const compatibleSystems = template.metadata?.compatibleSystems || [];
        if (!compatibleSystems.includes(game.system.id)) {
          console.log(`Skipping ${file}: not compatible with ${game.system.id}`);
          continue;
        }

        // Marquer comme global
        template.metadata.isGlobal = true;

        // Stocker
        this.globalTemplates[template.metadata.id] = template;

        console.log(`Loaded global template: ${template.metadata.name}`);
      } catch (error) {
        console.error(`Failed to load global template ${file}:`, error);
      }
    }
  }

  /**
   * Charge modèles locaux depuis world settings
   */
  static async loadLocalTemplates() {
    // Récupérer liste des IDs
    const localIds = game.settings.get('actor-importer', 'localmodel') || [];

    for (const id of localIds) {
      try {
        // Récupérer données modèle
        const template = game.settings.get('actor-importer', id);

        if (template) {
          this.localTemplates[id] = template;
          console.log(`Loaded local template: ${template.metadata.name}`);
        }
      } catch (error) {
        console.error(`Failed to load local template ${id}:`, error);
      }
    }
  }

  /**
   * Get all templates (global + local) for combobox
   */
  static getAllTemplates() {
    return {
      global: Object.values(this.globalTemplates),
      local: Object.values(this.localTemplates)
    };
  }

  /**
   * Get template by ID (checks both global and local)
   */
  static getTemplate(id, isGlobal = false) {
    if (isGlobal) {
      return this.globalTemplates[id];
    } else {
      return this.localTemplates[id];
    }
  }

  /**
   * Save local template to world settings
   */
  static async saveLocalTemplate(template) {
    const id = template.metadata.id;

    // Ensure not global
    template.metadata.isGlobal = false;

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
  }

  /**
   * Delete local template
   */
  static async deleteLocalTemplate(id) {
    // Remove from localmodel list
    let localIds = game.settings.get('actor-importer', 'localmodel') || [];
    localIds = localIds.filter(i => i !== id);
    await game.settings.set('actor-importer', 'localmodel', localIds);

    // Remove template data (can't unregister, but can clear)
    try {
      await game.settings.set('actor-importer', id, null);
    } catch (e) {
      // Ignore error if setting doesn't exist
    }

    // Remove from cache
    delete this.localTemplates[id];

    ui.notifications.info('Template deleted');
  }

  /**
   * Export template to JSON file
   */
  static exportTemplate(template) {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.metadata.id}.json`;
    a.click();

    URL.revokeObjectURL(url);

    ui.notifications.info('Template exported');
  }

  /**
   * Import template from file
   */
  static async importTemplate(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const template = JSON.parse(event.target.result);

          // Validate format
          if (template.templateFormat !== 'fvtt-import-v2') {
            throw new Error('Invalid template format');
          }

          // Generate unique ID if conflicts
          let id = template.metadata.id;
          let counter = 1;
          while (this.localTemplates[id] || this.globalTemplates[id]) {
            id = `${template.metadata.id}-${counter}`;
            counter++;
          }
          template.metadata.id = id;

          // Mark as local
          template.metadata.isGlobal = false;
          template.metadata.imported = true;
          template.metadata.updated = new Date().toISOString();

          // Save
          await this.saveLocalTemplate(template);

          ui.notifications.info(`Template imported: ${template.metadata.name}`);
          resolve(template);
        } catch (error) {
          ui.notifications.error(`Import failed: ${error.message}`);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }
}
```

### 2. Modifier ImportTemplateApp

**Fichier**: `scripts/template-app.mjs`

Ajouter dans `getData()`:

```javascript
getData() {
  const allTemplates = ImportTemplateManager.getAllTemplates();

  return {
    mode: this.mode,
    currentSystem: this.currentSystem,
    globalTemplates: allTemplates.global,
    localTemplates: allTemplates.local,
    currentTemplate: this.currentTemplate,
    currentTemplateName: this.currentTemplate?.metadata?.name?.replace(' (global)', '') || '',
    isGlobalTemplate: this.currentTemplate?.metadata?.isGlobal || false,
    sourceText: this.sourceText,
    annotatedHtml: this._generateAnnotatedHtml(),
    systemFields: this._getSystemFields(),
    hasAnnotations: this.annotations.length > 0
  };
}
```

Ajouter handlers:

```javascript
activateListeners(html) {
  // ... existing ...

  // Template name editing
  html.find('#template-name').on('input', this._onTemplateNameChange.bind(this));

  // Save buttons
  html.find('#save-template-btn').on('click', this._onSaveTemplate.bind(this));
  html.find('#save-as-template-btn').on('click', this._onSaveAsTemplate.bind(this));
  html.find('#export-template-btn').on('click', this._onExportTemplate.bind(this));
  html.find('#import-template-btn').on('click', this._onImportTemplate.bind(this));
  html.find('#delete-template-btn').on('click', this._onDeleteTemplate.bind(this));
}

_onTemplateNameChange(event) {
  const newName = event.target.value;
  // Enable "Save As" if name changed
  if (this.currentTemplate && newName !== this.currentTemplate.metadata.name) {
    this.element.find('#save-as-template-btn').removeClass('disabled');
  }
}

async _onSaveTemplate(event) {
  // If global, force "Save As"
  if (this.currentTemplate?.metadata?.isGlobal) {
    return this._onSaveAsTemplate(event);
  }

  // Get name from input
  const name = this.element.find('#template-name').val().trim();
  if (!name) {
    ui.notifications.warn('Please enter a template name');
    return;
  }

  // Build template
  const template = this._buildTemplate(name);

  // Save
  await ImportTemplateManager.saveLocalTemplate(template);

  this.currentTemplate = template;
  this.render();
}

async _onSaveAsTemplate(event) {
  // Open dialog for name
  new Dialog({
    title: 'Save Template As',
    content: `
      <form>
        <div class="form-group">
          <label>Template Name:</label>
          <input type="text" name="templateName" value="${this.currentTemplate?.metadata?.name || ''}" autofocus />
        </div>
        <div class="form-group">
          <label>Description:</label>
          <textarea name="description" rows="3">${this.currentTemplate?.metadata?.description || ''}</textarea>
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

          // Build template with new name
          const template = this._buildTemplate(name, description);

          // Save
          await ImportTemplateManager.saveLocalTemplate(template);

          this.currentTemplate = template;
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

_buildTemplate(name, description = '') {
  // Generate unique ID
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const template = {
    templateFormat: 'fvtt-import-v2',
    version: '2.0.0',
    metadata: {
      id: id,
      name: name,
      system: this.currentSystem,
      compatibleSystems: [this.currentSystem],
      author: game.user.name,
      description: description,
      created: this.currentTemplate?.metadata?.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      isGlobal: false
    },
    annotations: this.annotations,
    constructs: this.constructs,
    tokens: this._convertToTokens(),
    mappings: [], // Will be populated by Phase 3
    colorData: this.colorManager.export()
  };

  return template;
}

async _onExportTemplate(event) {
  if (!this.currentTemplate) {
    ui.notifications.warn('No template to export');
    return;
  }

  ImportTemplateManager.exportTemplate(this.currentTemplate);
}

async _onImportTemplate(event) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const template = await ImportTemplateManager.importTemplate(file);
        this.currentTemplate = template;
        this.render();
      } catch (error) {
        // Error already shown by manager
      }
    }
  };

  input.click();
}

async _onDeleteTemplate(event) {
  if (!this.currentTemplate || this.currentTemplate.metadata.isGlobal) {
    return;
  }

  const confirmed = await Dialog.confirm({
    title: 'Delete Template',
    content: `<p>Are you sure you want to delete "${this.currentTemplate.metadata.name}"?</p>`,
    defaultYes: false
  });

  if (confirmed) {
    await ImportTemplateManager.deleteLocalTemplate(this.currentTemplate.metadata.id);
    this.currentTemplate = null;
    this.render();
  }
}
```

---

## Migration de Données

### Modèles v1 → v2

Si templates v1 existent:

```javascript
static migrateV1ToV2(oldTemplate) {
  return {
    templateFormat: 'fvtt-import-v2',
    version: '2.0.0',
    metadata: {
      id: oldTemplate.id || 'migrated-template',
      name: oldTemplate.name || 'Migrated Template',
      system: oldTemplate.system || 'other',
      compatibleSystems: [oldTemplate.system || 'other'],
      author: oldTemplate.author || 'Unknown',
      description: 'Migrated from v1',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      isGlobal: false
    },
    annotations: [], // Convert from old format
    constructs: oldTemplate.constructs || {},
    tokens: oldTemplate.tokens || [],
    mappings: [],
    colorData: {}
  };
}
```

---

## Tests à Effectuer

### Test 1: Charger Modèles Globaux
1. Créer `models/test-template.json`
2. Recharger Foundry
3. Vérifier template apparaît avec "(global)"

### Test 2: Créer Modèle Local
1. Créer nouveau template
2. Saisir nom "My Test"
3. Cliquer Save
4. Vérifier apparaît dans combobox

### Test 3: Save As depuis Global
1. Charger template global
2. Modifier
3. Cliquer Save As
4. Vérifier copie locale créée

### Test 4: Export/Import
1. Exporter template local
2. Supprimer template
3. Importer fichier JSON
4. Vérifier template restauré

---

**Prochaine étape**: Implémenter code dans template-manager.mjs et template-app.mjs
