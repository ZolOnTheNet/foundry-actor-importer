# Plan d'Action - Visual Model Builder v2

**Date**: 2025-11-27
**Objectif**: Améliorer l'interface de création de modèles d'import avec visualisation couleur, outils interactifs et mapping de variables

---

## 1. Vue d'Ensemble

### Problèmes Identifiés
1. ✅ Manque de feedback visuel entre tokens et preview
2. ✅ Outils peu intuitifs (pas de tooltips, noms peu clairs)
3. ✅ Certains champs système non visibles (ex: `weapon-main` vs `weapon`)
4. ✅ Pas de système pour gérer les listes et patterns répétitifs
5. ✅ Pas de mapping flexible pour calculs et transformations de champs
6. ✅ Problèmes d'encodage (tiers unicode) nécessitent variables custom

### Solution Proposée
Interface en 3 panneaux principaux:
- **Gauche**: Texte source avec tokens colorés
- **Centre**: Preview avec zones colorées correspondantes + hover info
- **Bas**: Table de mapping variables (3 colonnes)

---

## 2. Architecture des Composants

### 2.1 Système de Couleurs

```javascript
// Générateur de couleurs distinctes
class ColorManager {
  constructor() {
    this.colors = []; // Pool de couleurs HSL
    this.tokenColorMap = new Map(); // token → couleur
  }

  getColorForToken(tokenId) {
    // Génère couleur unique ou réutilise existante
  }
}
```

**Implémentation**:
- Utiliser HSL avec hue rotation (0°, 30°, 60°, etc.)
- Saturation: 70%, Lightness: 85% (fond) / 45% (texte)
- Bordure 2px avec version plus foncée de la couleur
- Maximum ~12 couleurs avant réutilisation

### 2.2 Système de Tokens Amélioré

**Structure de données**:
```javascript
{
  id: "token_1",
  type: "field|next|list|construct",
  text: "Tier",
  color: "#ffe5e5",
  targetPath: "system.tier", // ou null
  calculation: null, // ou expression
  comment: ""
}
```

**Nouveau type: `construct`**:
- Représente un pattern répétitif (item de liste)
- Contient une séquence de tokens enfants
- Permet détection automatique sur autres occurrences

### 2.3 Outils avec Tooltips

| Outil | Ancien | Nouveau | Tooltip | Icône |
|-------|--------|---------|---------|-------|
| **Field** | ✓ | ✓ | "Sélectionnez un mot/phrase et assignez-le à un champ de l'acteur (ex: nom, tier, HP)" | 📝 |
| **Next** | Skip | ✓ | "Mot-clé séparateur qui indique la fin d'une valeur et le début de la suivante (ex: '|', 'ATK:', 'HP:')" | ➡️ |
| **List** | ✗ | ✓ | "Sélectionnez l'ensemble du texte d'une liste répétitive (ex: toutes les features, toutes les armes)" | 📋 |
| **Construct** | ✗ | ✓ | "Après avoir défini champs et Next dans un élément, sélectionnez-le pour créer un modèle réutilisable" | 🏗️ |
| **Item** | ✗ | ✓ | "Marque un élément comme item Foundry (weapon, feature, etc.) - utilisé avec List/Construct" | 📦 |
| **Delete** | ✓ | ✓ | "Supprime le token sélectionné" | 🗑️ |
| **Clear All** | ✓ | ✓ | "Supprime tous les tokens et recommence" | 🔄 |

### 2.4 Workflow Utilisateur

#### Scénario 1: Champ Simple
1. Sélectionner texte "Tier 1" dans le preview
2. Cliquer "Field"
3. Choisir `system.tier` dans dropdown
4. → Texte devient coloré (ex: bleu clair)
5. → Preview montre fond bleu avec bordure

#### Scénario 2: Liste avec Construct
1. Sélectionner première feature complète:
   ```
   Claws (2) - Action: The creature attacks with claws. +2 damage.
   ```
2. Marquer les parties:
   - "Claws" → Field → `name`
   - "(2)" → Field → `system.uses`
   - "Action" → Field → `system.category`
   - ":" → Next
   - "The creature..." → Field → `system.description`

3. Sélectionner toute la feature marquée → "Construct"
4. Système enregistre le pattern
5. Sélectionner toutes les features → "List"
6. → Détection auto applique construct sur chaque feature

#### Scénario 3: Calcul de Variable
1. Dans table mapping (bas écran):
   - Colonne 1: `system.health.max`
   - Colonne 2: `hp * 10 + tier * 5`
   - Colonne 3: "HP max = HP de base × 10 + bonus de tier"

---

## 3. Table de Mapping Variables

### Structure UI

```
┌─────────────────────────┬──────────────────────────┬─────────────────────────────────┐
│ Champ Cible (Actor/Item)│ Expression/Variable      │ Commentaire                     │
├─────────────────────────┼──────────────────────────┼─────────────────────────────────┤
│ name                    │ name                     │ (identique)                     │
│ system.tier             │ tier                     │ (identique)                     │
│ system.health.max       │ hp * 10                  │ HP multiplié par 10             │
│ system.defenses.evasion │ evasion || (12 + tier)   │ Si absent, calculer par défaut  │
│ items[].name            │ featureName              │ Nom de la feature               │
└─────────────────────────┴──────────────────────────┴─────────────────────────────────┘
```

### Fonctionnalités

1. **Auto-remplissage**: Champs identiques créés automatiquement (ex: `name` → `name`)
2. **Opérateurs supportés**:
   - Arithmétique: `+`, `-`, `*`, `/`, `%`
   - Chaînes: `+` (concaténation)
   - Logique: `||` (fallback), `&&`
   - Ternaire: `condition ? valTrue : valFalse`
3. **Boutons d'action**:
   - ➕ Ajouter ligne
   - 🗑️ Supprimer ligne
   - 💾 Sauvegarder mapping (dans template)

### Exemple Concret: Problème Tiers Unicode

**Problème**: Dans livre de base, "Tier" peut être encodé avec caractères unicode 58689-58692

**Solution**:
```
Champ Cible              | Expression              | Commentaire
-------------------------|-------------------------|---------------------------
system.tier              | tierRaw                 | Variable brute du texte
system.tierNormalized    | normalizeTier(tierRaw)  | Convertit unicode → 1-4
```

Avec fonction custom:
```javascript
function normalizeTier(value) {
  const unicodeMap = {58689: 1, 58690: 2, 58691: 3, 58692: 4};
  return unicodeMap[value.charCodeAt(0)] || parseInt(value);
}
```

---

## 4. Gestion des Listes et Items

### Types de Listes

1. **Liste simple**: Séquence de valeurs séparées (ex: tags)
   ```
   Tags: Fire, Beast, Large
   ```

2. **Liste structurée**: Éléments avec pattern répétitif (ex: features)
   ```
   FEATURES
   Feature 1 (X) - Type: Description
   Feature 2 (Y) - Type: Description
   ```

3. **Liste imbriquée**: Liste dans liste (ex: armes avec propriétés)
   ```
   ATK: +2 | Sword: Close | 1d8+2 Physical, Bleed
   ATK: +3 | Bow: Far | 1d6 Physical
   ```

### Outil "Item"

- **Fonction**: Marque un construct comme devant créer un item Foundry
- **Configuration**:
  - Type d'item: `weapon`, `feature`, `spell`, etc.
  - Catégorie (si applicable): `Action`, `Reaction`, `Passive`
- **Résultat**: Au lieu de créer `system.featureName`, crée un item dans `items[]`

### Outil "List"

- **Fonction**: Applique un construct à une zone de texte
- **Détection auto**:
  1. Cherche pattern du construct
  2. Extrait chaque occurrence
  3. Crée array ou items séparés
- **Indicateurs visuels**:
  - Numérotation: "Feature 1/3", "Feature 2/3"
  - Couleur alternée par élément (bleu clair → bleu foncé → bleu clair)

---

## 5. Visualisation Améliorée

### Panel Gauche: Tokens Colorés

```html
<div class="token-container">
  <span class="token field" style="background: #ffe5e5; border-color: #ff9999">
    Tier
    <div class="token-info">
      <small>Field: system.tier</small>
    </div>
  </span>
  <span class="token-text"> 1</span>
  <span class="token next" style="background: #e5f3ff;">|</span>
</div>
```

**Interactions**:
- Click: Sélectionner token (bordure épaisse)
- Hover: Afficher tooltip avec type et target
- Double-click: Éditer mapping

### Panel Centre: Preview Coloré

```html
<div class="preview-pane">
  <div class="preview-line">
    <span class="preview-field"
          data-token-id="token_1"
          style="background: #ffe5e5; border-left: 4px solid #ff9999">
      Tier
    </span>
    <span class="preview-value" data-token-id="token_2">1</span>
  </div>
</div>
```

**Hover Behavior**:
```
┌─────────────────────────┐
│ Tier                    │ ← Hover ici
│ ┌─────────────────────┐ │
│ │ Field: system.tier  │ │ ← Tooltip apparaît
│ │ Type: Number        │ │
│ │ Source: "Tier"      │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Synchronisation

- Hover sur token → Highlight preview correspondant
- Hover sur preview → Highlight token correspondant
- Sélection token → Scroll vers preview
- Classes CSS: `.highlighted`, `.selected`

---

## 6. Structure du Code

### Nouveaux Fichiers

```
scripts/
├── visual-model/
│   ├── color-manager.js          # Gestion couleurs
│   ├── token-manager.js          # CRUD tokens
│   ├── construct-detector.js     # Détection patterns
│   ├── mapping-table.js          # Table 3 colonnes
│   ├── preview-renderer.js       # Rendu preview coloré
│   └── expression-evaluator.js   # Évaluation calculs
```

### Classes Principales

```javascript
// color-manager.js
export class ColorManager {
  generateColor(index)
  getTokenColor(tokenId)
  getDarkerShade(color)
}

// token-manager.js
export class TokenManager {
  tokens = []
  addToken(type, text, start, end)
  removeToken(id)
  getTokenAt(position)
  serialize() // → JSON pour template
}

// construct-detector.js
export class ConstructDetector {
  detectPattern(construct, text)
  applyConstructToList(construct, listText)
  extractVariables(text, pattern)
}

// mapping-table.js
export class MappingTable {
  mappings = []
  addMapping(target, expression, comment)
  evaluate(expression, context)
  validate(expression)
}
```

---

## 7. Format de Sauvegarde (Template JSON)

```json
{
  "name": "Daggerheart Standard v2",
  "version": 2,
  "tokens": [
    {
      "id": "t1",
      "type": "field",
      "text": "Tier",
      "position": {"start": 0, "end": 4},
      "targetPath": "system.tier",
      "color": "#ffe5e5"
    },
    {
      "id": "t2",
      "type": "next",
      "text": "|",
      "position": {"start": 6, "end": 7}
    }
  ],
  "constructs": [
    {
      "id": "c1",
      "name": "Feature",
      "itemType": "feature",
      "tokens": ["t10", "t11", "t12", "t13"],
      "pattern": "{{name}} ({{uses}}) - {{category}}: {{description}}"
    }
  ],
  "lists": [
    {
      "id": "l1",
      "construct": "c1",
      "startMarker": "FEATURES",
      "endMarker": null
    }
  ],
  "mappings": [
    {
      "target": "name",
      "expression": "name",
      "comment": "Identique"
    },
    {
      "target": "system.tier",
      "expression": "normalizeTier(tier)",
      "comment": "Convertit unicode"
    }
  ],
  "functions": {
    "normalizeTier": "function(v) { const m = {58689:1,58690:2,58691:3,58692:4}; return m[v.charCodeAt(0)] || parseInt(v); }"
  }
}
```

---

## 8. Plan d'Implémentation par Phases

### Phase 1: Fondations (Priorité Haute)
- [x] Créer structure doc/
- [ ] Créer ColorManager
- [ ] Refactorer TokenManager avec types étendus
- [ ] Ajouter couleurs aux tokens existants
- [ ] Implémenter preview coloré synchronisé

**Estimation**: 2-3 heures
**Fichiers**: `color-manager.js`, modifications `actor-importer.js`

---

### Phase 2: Outils Améliorés (Priorité Haute)
- [ ] Renommer "Skip" → "Next"
- [ ] Ajouter tooltips à tous les boutons
- [ ] Créer outil "List"
- [ ] Créer outil "Item"
- [ ] Créer outil "Construct"

**Estimation**: 3-4 heures
**Fichiers**: Modifications `actor-importer.js`, nouveau CSS

---

### Phase 3: Table de Mapping (Priorité Moyenne)
- [ ] Créer MappingTable UI (3 colonnes)
- [ ] Implémenter auto-fill pour champs identiques
- [ ] Créer ExpressionEvaluator
- [ ] Ajouter validation expressions
- [ ] Tester calculs arithmétiques et chaînes

**Estimation**: 4-5 heures
**Fichiers**: `mapping-table.js`, `expression-evaluator.js`

---

### Phase 4: Détection de Patterns (Priorité Moyenne)
- [ ] Créer ConstructDetector
- [ ] Implémenter reconnaissance de pattern
- [ ] Ajouter numérotation items détectés
- [ ] Tester sur features Daggerheart

**Estimation**: 3-4 heures
**Fichiers**: `construct-detector.js`

---

### Phase 5: Hover et Interactions (Priorité Basse)
- [ ] Implémenter hover synchronisé
- [ ] Tooltips preview avec info codage
- [ ] Animation transitions
- [ ] Accessibilité clavier

**Estimation**: 2-3 heures
**Fichiers**: CSS, event handlers

---

### Phase 6: Sauvegarde et Export (Priorité Basse)
- [ ] Définir format JSON v2
- [ ] Implémenter serialize/deserialize
- [ ] Migration templates v1 → v2
- [ ] Export/Import templates

**Estimation**: 2-3 heures
**Fichiers**: Modifications `actor-importer.js`

---

## 9. Problèmes Techniques à Résoudre

### 9.1 Champs Non Visibles

**Symptôme**: `weapon` visible mais pas `weapon-main`

**Causes possibles**:
1. Schéma système incomplet dans code
2. Filtrage trop restrictif des champs
3. Champs générés dynamiquement non capturés

**Solution**:
- Ajouter bouton "➕ Champ Custom" dans dropdown
- Permettre saisie libre `system.custom.path`
- Valider existence au runtime (optionnel)

### 9.2 Encodage Unicode Tiers

**Problème**: Caractères 58689-58692 au lieu de "1", "2", "3", "4"

**Solution immédiate** (Phase 3):
```javascript
// Dans mapping table
{
  target: "system.tier",
  expression: "tierRaw.charCodeAt(0) >= 58689 ? tierRaw.charCodeAt(0) - 58688 : parseInt(tierRaw)"
}
```

**Solution long-terme** (Phase 6):
- Fonctions custom dans templates
- Bibliothèque de helpers (normalizeTier, parseRange, etc.)

### 9.3 Performance avec Grands Textes

**Scénario**: Stat block 1000+ lignes avec 50+ features

**Optimisations**:
- Virtualisation liste tokens (render only visible)
- Debounce sur sélection texte (300ms)
- Web Workers pour pattern detection
- Cache résultats construct matching

---

## 10. Tests à Effectuer

### Tests Unitaires (Manuel)

1. **Couleurs**:
   - [ ] 10 tokens → 10 couleurs distinctes
   - [ ] Hover token → Preview highlight
   - [ ] Hover preview → Token highlight

2. **Outils**:
   - [ ] Next sépare correctement valeurs
   - [ ] List détecte 5/5 features
   - [ ] Construct pattern match 100%
   - [ ] Item crée bien item Foundry

3. **Mapping**:
   - [ ] `hp * 10` calcule correctement
   - [ ] `name + " the " + type` concatène
   - [ ] `value || default` fallback fonctionne
   - [ ] Champs custom sauvegardés

### Tests d'Intégration

1. **Workflow complet Daggerheart**:
   - [ ] Importer stat block Tier 1
   - [ ] Appliquer couleurs
   - [ ] Définir construct feature
   - [ ] Détecter 3 features automatiquement
   - [ ] Sauvegarder template
   - [ ] Réutiliser template sur autre creature

2. **Cross-system**:
   - [ ] Template Daggerheart → Actor Daggerheart UO
   - [ ] Mappings custom préservés
   - [ ] Items créés correctement

---

## 11. Documentation Utilisateur

### Guide Rapide (à créer: `doc/user-guide.md`)

1. **Démarrage**:
   - Ouvrir Visual Model Builder
   - Coller stat block dans preview
   - Sélectionner system cible

2. **Création Modèle**:
   - Marquer champs simples (nom, tier, HP)
   - Définir séparateurs (Next)
   - Créer construct pour features
   - Appliquer à liste complète

3. **Mapping Avancé**:
   - Ouvrir table en bas
   - Ajouter calculs si nécessaire
   - Sauvegarder template

4. **Réutilisation**:
   - Charger template existant
   - Coller nouveau stat block
   - Vérifier détection auto
   - Exporter acteur

### Vidéo Tutorial (futur)
- Screencast 5-10 min
- Démonstration workflow complet
- Tips & tricks

---

## 12. Ressources et Références

### Technologies
- **Couleurs**: HSL color space, [Accessible color palette generator](https://coolors.co/)
- **Expression parsing**: [math.js](https://mathjs.org/) ou custom parser
- **Tooltips**: CSS `:hover` + `::after` ou [Tippy.js](https://atomiks.github.io/tippyjs/)

### Inspirations
- **VS Code**: Token highlighting
- **Regex101**: Pattern visualization
- **Postman**: Variable mapping UI

---

## 13. Questions en Suspens

1. **Imbrication de constructs**: Supporter construct dans construct ?
   - Ex: Feature avec liste de conditions
   - Complexité: Élevée
   - Utilité: Moyenne
   - **Décision**: Postpone à v3

2. **Import/Export templates**: Format propriétaire ou standard ?
   - Option A: JSON custom (contrôle total)
   - Option B: Dériver de JSON Schema
   - **Décision**: JSON custom pour v2, Schema pour v3

3. **Multi-langue**: Interface en FR/EN ?
   - Fichiers lang/ existent déjà
   - Ajouter clés pour nouveaux tooltips
   - **Décision**: Oui, utiliser système existant

4. **Validation temps réel**: Afficher erreurs inline ?
   - Ex: Expression invalide → bordure rouge
   - Console errors → User-friendly messages
   - **Décision**: Oui, Phase 3

---

## 14. Notes de Migration

### Pour utilisateurs existants

Si templates v1 existent:
1. Backup automatique → `templates_v1_backup.json`
2. Migration auto → Détection patterns → Reconstruction tokens
3. Validation manuelle recommandée

**Breaking changes**:
- Format JSON incompatible
- Certains champs renommés
- Constructs non rétro-compatibles

### Compatibilité

- ✅ Foundry v13+
- ✅ Tous systèmes supportés actuellement
- ✅ Pas de dépendances externes requises (phase 1-4)
- ⚠️ math.js optionnel (Phase 3, fallback custom parser)

---

## Prochaines Étapes Immédiates

1. ✅ Créer ce document
2. [ ] Valider plan avec utilisateur
3. [ ] Créer `color-manager.js` (Phase 1)
4. [ ] Implémenter système couleurs de base
5. [ ] Tester avec stat block existant

---

**Dernière mise à jour**: 2025-11-27
**Statut**: 📝 En planification
**Prochaine révision**: Après Phase 1
