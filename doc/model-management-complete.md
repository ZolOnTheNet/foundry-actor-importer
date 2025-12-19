# Système de Gestion des Modèles - Implémentation Complète

**Date**: 2025-11-27
**Statut**: ✅ Implémenté et prêt pour tests

---

## Résumé des Fonctionnalités

Le système de gestion des modèles permet maintenant:

✅ **Sauvegarde locale** (dans le monde)
✅ **Chargement global** (depuis le module)
✅ **Édition du nom** directement dans l'UI
✅ **Save** - Sauvegarde directe
✅ **Save As** - Créer une copie
✅ **Export/Import** - Partage de templates
✅ **Delete** - Suppression (local uniquement)
✅ **Distinction visuelle** Global vs Local dans dropdown

---

## Interface Utilisateur

### Champs Ajoutés

```
┌─────────────────────────────────────────────────────┐
│ Mode: [Create ▼]  System: [Daggerheart ▼]          │
│ Template: [▼ New Template/Global/Local]            │
│ Name: [My Custom Template____________]             │
│ [💾] [📋] [▶] [📤] [📥] [🗑️]                        │
└─────────────────────────────────────────────────────┘
```

**Boutons**:
- **💾 Save** - Sauvegarde directe (utilise nom du champ)
- **📋 Save As** - Ouvre dialog pour nouveau nom
- **▶ Test** - Teste le parsing
- **📤 Export** - Exporte en JSON
- **📥 Import** - Importe depuis JSON
- **🗑️ Delete** - Supprime (si local)

### Dropdown Template

```
Template: ▼
├── New Template
├── Global Templates
│   ├── Daggerheart Standard (global)
│   └── Fabula Ultima FR (global)
└── Local Templates
    ├── My Custom Daggerheart
    └── Goblin Importer
```

---

## Workflow Utilisateur

### 1. Créer Nouveau Template

1. **Ouvrir** Template Creator
2. **Sélectionner** système (ex: Daggerheart)
3. **Coller** texte source
4. **Créer annotations** (sélectionner texte → cliquer champs)
5. **Saisir nom** dans champ "Name:"
6. **Cliquer** 💾 Save
7. → Template sauvegardé localement

**Résultat**: Template apparaît dans "Local Templates" du dropdown

### 2. Charger Template Existant

1. **Ouvrir** Template Creator
2. **Sélectionner** template dans dropdown
3. → Annotations rechargées automatiquement
4. → Couleurs restaurées
5. → Champ "Name:" rempli automatiquement

### 3. Modifier Template Global

⚠️ **Impossible de modifier directement**

**Procédure**:
1. **Sélectionner** template global
2. **Modifier** annotations si besoin
3. **Changer** nom dans champ "Name:"
4. **Cliquer** 📋 Save As
5. → Dialog s'ouvre avec nom prérempli
6. **Confirmer** → Sauvegardé comme local

### 4. Exporter/Partager Template

1. **Sélectionner** template (global ou local)
2. **Cliquer** 📤 Export
3. → Fichier `template-id.json` téléchargé
4. **Envoyer** fichier à autre utilisateur

### 5. Importer Template

1. **Cliquer** 📥 Import
2. **Sélectionner** fichier JSON
3. → Template importé comme local
4. → Nom unique généré si conflit
5. → Apparaît dans "Local Templates"

---

## Format Template v2

```json
{
  "templateFormat": "fvtt-import-v2",
  "version": "2.0.0",
  "metadata": {
    "id": "my-custom-template",
    "name": "My Custom Template",
    "system": "daggerheart",
    "compatibleSystems": ["daggerheart", "daggerheart-unofficial"],
    "author": "Player Name",
    "description": "Custom template for Daggerheart creatures",
    "created": "2025-11-27T10:00:00.000Z",
    "updated": "2025-11-27T12:30:00.000Z",
    "isGlobal": false
  },
  "annotations": [
    {
      "id": "ann-1234567890",
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
  "constructs": {},
  "tokens": [
    {
      "id": "tok-1",
      "field": "name",
      "mode": "toNewline"
    }
  ],
  "mappings": [],
  "colorData": {
    "ann-1234567890": {
      "background": "hsl(0, 70%, 85%)",
      "border": "hsl(0, 70%, 55%)"
    }
  }
}
```

### Différences v1 → v2

| Champ | v1 | v2 |
|-------|----|----|
| Format | `fvtt-import-v1` | `fvtt-import-v2` |
| Version | Dans metadata | Racine (`version: "2.0.0"`) |
| Compatible Systems | Pas supporté | `compatibleSystems: []` |
| Annotations | Pas sauvegardées | Array complet |
| Color Data | Pas sauvegardé | `colorData: {}` |
| Mappings | Pas supporté | `mappings: []` (Phase 3) |

---

## Stockage des Données

### World Settings

#### Clé: `actor-importer.localmodel`
**Type**: `Array<string>`

Liste des IDs de templates locaux:
```json
[
  "my-custom-template",
  "goblin-importer",
  "custom-fabula"
]
```

#### Clé: `actor-importer.<template-id>`
**Type**: `Object`

Données complètes d'un template:
```json
{
  "templateFormat": "fvtt-import-v2",
  "version": "2.0.0",
  "metadata": {...},
  "annotations": [...],
  "constructs": {...},
  "tokens": [...],
  "mappings": [],
  "colorData": {...}
}
```

### Répertoire Global

```
modules/actor-importer/
└── models/
    ├── .gitkeep
    ├── daggerheart-standard.json          (à créer)
    ├── daggerheart-incredible-creatures.json  (à créer)
    └── fabula-ultima-fr.json              (à créer)
```

**Chargement**: Au démarrage (`init` hook), lecture de tous les JSON dans `models/`

**Filtrage**: Seuls les templates compatibles avec le système actuel sont chargés

---

## Code Modifié

### 1. template-manager.mjs (417 lignes) - Refactoré complet

**Nouvelles méthodes**:
- `initialize()` - Charge global + local (async)
- `loadGlobalTemplates()` - Fetch depuis `models/`
- `loadLocalTemplates()` - Lit depuis world settings
- `getAllTemplates()` - Retourne {global, local}
- `getTemplatesForSystem(system)` - Filtre par compatibilité
- `getTemplate(id, isGlobal)` - Récupère un template
- `saveLocalTemplate(template)` - Sauvegarde dans world
- `deleteLocalTemplate(id)` - Supprime du world
- `exportTemplate(template)` - Télécharge JSON
- `importTemplate(file)` - Parse et sauvegarde
- `duplicateTemplate(sourceTemplate, newName)` - Clone
- `validateTemplate(template)` - Validation format
- `migrateV1ToV2(oldTemplate)` - Migration

### 2. template-app.mjs

**Modifications getData()**:
```javascript
getData() {
  const allTemplates = ImportTemplateManager.getTemplatesForSystem(this.currentSystem);

  return {
    globalTemplates: allTemplates.global.map(t => ({
      id: `global:${t.metadata.id}`,
      name: `${t.metadata.name} (global)`
    })),
    localTemplates: allTemplates.local.map(t => ({
      id: `local:${t.metadata.id}`,
      name: t.metadata.name
    })),
    currentTemplateName: this.currentTemplate?.metadata?.name?.replace(' (global)', '') || '',
    isGlobalTemplate: this.currentTemplate?.metadata?.isGlobal || false,
    ...
  };
}
```

**Nouvelles méthodes**:
- `_onTemplateNameChange(event)` - Track nom changé
- `_onSaveTemplate(event)` - Sauvegarde directe (async)
- `_onSaveAsTemplate(event)` - Dialog + nouvelle copie
- `_generateTemplateId(name)` - Génère ID depuis nom

**Modifiées**:
- `_onTemplateSelect()` - Parse "global:id" / "local:id"
- `_onDeleteTemplate()` - Vérifie isGlobal
- `_onExportTemplate()` - Passe template entier
- `_convertToTemplate()` - Format v2 avec colorData

### 3. template-creator.html

**Ajouts**:
```html
<div class="control-group">
  <label for="template-name">Name:</label>
  <input type="text" id="template-name"
         placeholder="Enter template name"
         value="{{currentTemplateName}}" />
</div>

<button id="save-as-template" class="icon-button">
  <i class="fas fa-copy"></i>
</button>
```

**Modifié**: Select template avec optgroups

### 4. actor-importer.mjs

**Async initialization**:
```javascript
Hooks.once('init', async () => {
  await ActorImporter.initialize();
});

static async initialize() {
  await this.registerSettings();
  ...
}

static async registerSettings() {
  await ImportTemplateManager.initialize(); // Charge templates
  ...
}
```

### 5. actor-importer.css

**Ajout styles**:
- `.window-header .control-group` - Layout flex
- `.control-group input[type="text"]` - Style input nom
- Focus state avec bordure verte

---

## Tests à Effectuer

### Test 1: Sauvegarder Nouveau Template

1. ✅ Ouvrir Template Creator
2. ✅ Créer 2-3 annotations
3. ✅ Saisir nom: "Test Template 1"
4. ✅ Cliquer Save
5. ✅ **Attendu**: Notification "Template saved"
6. ✅ **Attendu**: Template apparaît dans dropdown "Local Templates"

### Test 2: Charger Template Sauvegardé

1. ✅ Fermer et réouvrir Template Creator
2. ✅ Sélectionner "Test Template 1" dans dropdown
3. ✅ **Attendu**: Annotations rechargées
4. ✅ **Attendu**: Champ "Name:" contient "Test Template 1"
5. ✅ **Attendu**: Couleurs des boutons restaurées

### Test 3: Modifier et Re-sauvegarder

1. ✅ Charger template existant
2. ✅ Ajouter nouvelle annotation
3. ✅ Cliquer Save (même nom)
4. ✅ **Attendu**: Template mis à jour
5. ✅ Recharger template
6. ✅ **Attendu**: Nouvelle annotation présente

### Test 4: Save As (Copie)

1. ✅ Charger template
2. ✅ Modifier nom: "Test Template 2"
3. ✅ Cliquer Save As
4. ✅ Confirmer nom dans dialog
5. ✅ **Attendu**: 2 templates dans dropdown

### Test 5: Export/Import

1. ✅ Sélectionner template
2. ✅ Cliquer Export
3. ✅ **Attendu**: Fichier JSON téléchargé
4. ✅ Cliquer Import
5. ✅ Sélectionner fichier
6. ✅ **Attendu**: Template importé (peut-être avec -1 si conflit)

### Test 6: Delete

1. ✅ Sélectionner template local
2. ✅ Cliquer Delete
3. ✅ Confirmer
4. ✅ **Attendu**: Template disparu du dropdown
5. ✅ **Attendu**: Données supprimées

### Test 7: Global Template (Quand créés)

1. ⬜ Créer `models/test-global.json`
2. ⬜ Recharger Foundry
3. ⬜ **Attendu**: Apparaît dans "Global Templates"
4. ⬜ Sélectionner global
5. ⬜ Cliquer Save
6. ⬜ **Attendu**: Warning "Cannot overwrite global"
7. ⬜ Cliquer Save As
8. ⬜ **Attendu**: Copie locale créée

---

## Points d'Attention

### ⚠️ Couleurs des Champs

**Comportement actuel**:
- Boutons de champs commencent en **gris neutre**
- Quand utilisé, prennent la **couleur HSL** de l'annotation (bleu, rouge, jaune, orange, etc.)
- **Jamais vert** - Le vert est réservé aux outils (Next, Multi, Construct, etc.)

**Si problème**: Les couleurs HSL ne doivent pas inclure de vert (hue ~120°). Vérifier ColorManager.generateColor().

### ⚠️ Persistence

**World Settings** sont automatiquement sauvegardés par Foundry.

**Si templates disparaissent**:
1. Console: `game.settings.get('actor-importer', 'localmodel')`
2. Vérifier que l'array contient les IDs
3. Pour chaque ID: `game.settings.get('actor-importer', 'the-id')`

**Debug**:
```javascript
// Lister tous les templates locaux
console.log('Local templates:', ImportTemplateManager.localTemplates);

// Lister tous les templates globaux
console.log('Global templates:', ImportTemplateManager.globalTemplates);

// Forcer rechargement
await ImportTemplateManager.initialize();
```

---

## Prochaines Étapes

### Templates Globaux à Créer

1. **`models/daggerheart-standard.json`**
   - Format standard du livre de base
   - Compatible: daggerheart, daggerheart-unofficial

2. **`models/daggerheart-incredible-creatures.json`**
   - Format Incredible Creatures
   - Tier sur ligne séparée
   - Compatible: daggerheart, daggerheart-unofficial

3. **`models/fabula-ultima-fr.json`**
   - Format livre français
   - Compatible: projectfu

### Phase 3: Mapping Table (En attente)

- Créer `scripts/visual-model/mapping-table.mjs`
- Ajouter UI 3 colonnes (Target / Expression / Comment)
- Évaluateur d'expressions simples
- Bouton "Auto-fill" depuis annotations

### Phase 4: Bouton "Refresh Calculations" (En attente)

- Auto-détection séparateurs "Next"
- Détection constructs répétés
- Numérotation items (1/5, 2/5, etc.)

---

## Logs de Debug

Pour activer les logs complets:

```javascript
// Dans console Foundry
CONFIG.debug.hooks = true;
```

**Logs importants**:
- `Actor Importer | Initializing` - Démarrage
- `Loaded global template: ...` - Template global chargé
- `Loaded local template: ...` - Template local chargé
- `Saved local template: ... (id)` - Sauvegarde réussie
- `Deleted local template: ... (id)` - Suppression réussie

---

**Dernière mise à jour**: 2025-11-27
**Statut**: ✅ Implémentation complète - Prêt pour tests utilisateur
**Prochaine phase**: Création templates globaux + tests complets
