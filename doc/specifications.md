# Spécifications Détaillées - Visual Model Builder v2

**Date**: 2025-11-27
**Statut**: Validé par utilisateur - Implémentation en cours

---

## Décisions de Design Validées

### 1. Système de Couleurs

#### Couleurs pour Tokens (Champs et Zones)
- **12 couleurs HSL distinctes** (hue rotation de 30°)
- Saturation: 70%, Lightness: 85% (fond)
- Bordure: même teinte, lightness -30% (55%)
- **IMPORTANT**: Les couleurs sont pour les **valeurs** du texte, PAS pour les noms de champs

#### Couleurs pour Outils
- **Tous les outils en VERT** (même couleur)
- Next, List, Construct, Item, Multiline, Transform, Eraser → même vert
- Pas de distinction colorée entre outils
- Icônes différentes pour différencier visuellement

**Exemple**:
```css
.tool-btn {
  background: #4b9e4b; /* VERT pour TOUS */
  color: white;
}

.tool-btn:hover {
  background: #3d8b3d;
}
```

#### Couleurs pour Boutons de Champs
- **PAS de couleur verte**
- Couleur neutre/grise par défaut
- Couleur distinctive uniquement au hover
- Exemple: `background: #f0f0f0; border: 1px solid #ccc;`

---

### 2. Champs Sans Équivalent Acteur

#### Problème
Utilisateur crée un champ custom (ex: `myCustomField`) qui n'existe pas dans le schéma de l'acteur cible.

#### Solution
1. **Affichage en italique** dans la preview
2. **Vérification lors du mapping**:
   - Si champ utilisé dans mapping table → conservé
   - Si champ NON utilisé dans mapping table → ignoré silencieusement
3. **Feedback visuel**: Italique + couleur grisée légèrement

**Exemple CSS**:
```css
.tag.field-unmapped {
  font-style: italic;
  opacity: 0.7;
}

.annotated-text.field-unmapped {
  font-style: italic;
  opacity: 0.7;
  background-color: #e0e0e0 !important; /* Override couleur HSL */
}
```

**Logique de détection**:
```javascript
/**
 * Vérifie si un champ existe dans le schéma système
 * @param {string} field Chemin du champ (ex: "system.health.max")
 * @param {string} system Système cible (ex: "daggerheart")
 * @returns {boolean} true si existe
 */
_fieldExistsInSystem(field, system) {
  const knownFields = this._getSystemFields(); // Liste des champs connus

  // Vérifier si le champ est dans la liste
  if (knownFields.includes(field)) return true;

  // Vérifier si le champ est dans la mapping table (donc utilisé)
  const isMapped = this.mappingTable.mappings.some(m =>
    m.target === field || m.expression.includes(field)
  );

  return isMapped;
}
```

---

### 3. Détection de Patterns (Outil List)

#### Principe: Basé sur Tokens Existants

**Pattern = Suite de champs + next**

Exemple de pattern pour une feature Daggerheart:
```
[name] [uses:toChar] [category:toChar] [next] [description:toNewline]
```

Pattern reconnaissable:
- Début: champ `name`
- Suivi de: champ `uses` avec mode `toChar`
- Suivi de: champ `category` avec mode `toChar`
- Suivi de: token `next` (séparateur)
- Fin: champ `description` avec mode `toNewline`

#### Algorithme de Détection

```javascript
/**
 * Détecte les occurrences d'un construct dans le texte
 * @param {object} construct Construct avec tokens
 * @param {string} text Texte à analyser
 * @returns {array} Liste de matches avec positions
 */
detectConstructOccurrences(construct, text) {
  const matches = [];
  const tokenSequence = construct.tokens; // [{field: 'name', mode: 'toSpace'}, {next: true}, ...]

  let searchPos = 0;

  while (searchPos < text.length) {
    const match = this._tryMatchSequence(tokenSequence, text, searchPos);

    if (match) {
      matches.push({
        start: match.start,
        end: match.end,
        extractedValues: match.values, // {name: "Claws", uses: "(2)", ...}
        itemNumber: matches.length + 1
      });
      searchPos = match.end;
    } else {
      searchPos++;
    }
  }

  return matches;
}

/**
 * Essaie de matcher une séquence de tokens à partir d'une position
 * @private
 */
_tryMatchSequence(tokenSequence, text, startPos) {
  let currentPos = startPos;
  const extractedValues = {};

  for (const token of tokenSequence) {
    if (token.next) {
      // Chercher séparateur
      const separator = token.text || this._detectSeparator(text, currentPos);
      const sepIndex = text.indexOf(separator, currentPos);
      if (sepIndex === -1) return null;
      currentPos = sepIndex + separator.length;

    } else if (token.field) {
      // Extraire valeur selon mode
      const value = this._extractValue(text, currentPos, token.mode);
      if (!value) return null;
      extractedValues[token.field] = value.text;
      currentPos = value.end;
    }
  }

  return {
    start: startPos,
    end: currentPos,
    values: extractedValues
  };
}
```

#### Exemple Concret

**Texte source**:
```
FEATURES
Claws (2) - Action: The creature attacks with claws. +2 damage.
Bite (1) - Action: The creature bites. +3 damage, apply poison.
Roar - Reaction: When hit, the creature roars to frighten enemies.
```

**Construct défini** (sur première feature):
- `name` → "Claws"
- `uses` (toChar ':') → "(2)"
- `category` (toChar ':') → "Action"
- `next` → ":"
- `description` (toNewline) → "The creature attacks..."

**Détection automatique**:
1. Cherche "Claws" (début de pattern)
2. Cherche "(2)" après (mode toChar)
3. Cherche "Action" après
4. Cherche ":" (next)
5. Cherche description jusqu'à newline
6. **Match trouvé** → Feature 1/3

Répète pour "Bite" et "Roar" → 3 features détectées automatiquement.

---

### 4. Bouton "Rafraîchir Calcul"

#### Fonction
Recalcule et détecte automatiquement:
1. **Tous les séparateurs "Next"** dans le texte
2. **Constructs répétés** (patterns identiques)
3. **Numérotation automatique** des items (1/5, 2/5, etc.)

#### Emplacement
Dans la toolbar, après les outils principaux.

**HTML**:
```html
<div class="toolbar-section">
  <h4>{{localize "ACTOR_IMPORTER.Tools"}}</h4>
  <div class="tool-buttons">
    <!-- Outils existants -->
    <button class="tool-btn" id="tool-next">...</button>
    <button class="tool-btn" id="tool-multiline">...</button>
    <button class="tool-btn" id="tool-item">...</button>
    <button class="tool-btn" id="tool-construct">...</button>
    <button class="tool-btn" id="tool-list">...</button>
    <button class="tool-btn" id="tool-transform">...</button>
    <button class="tool-btn" id="tool-eraser">...</button>

    <!-- NOUVEAU -->
    <div class="toolbar-divider"></div>
    <button class="tool-btn tool-btn-refresh" id="tool-refresh-calc"
            title="Refresh calculations: Re-detect Next separators and repeated construct patterns">
      <i class="fas fa-sync-alt"></i> Refresh
    </button>
  </div>
</div>
```

#### Comportement

```javascript
/**
 * Handle refresh calculations
 * @private
 */
async _onRefreshCalculations(event) {
  ui.notifications.info('Refreshing calculations...');

  const stats = {
    nextDetected: 0,
    constructsFound: 0,
    itemsNumbered: 0
  };

  // 1. Détecter tous les "Next" potentiels
  stats.nextDetected = this._autoDetectNextSeparators();

  // 2. Pour chaque construct, chercher occurrences répétées
  for (const [constructId, construct] of Object.entries(this.constructs)) {
    const occurrences = this.detectConstructOccurrences(construct, this.sourceText);

    if (occurrences.length > 1) {
      stats.constructsFound++;
      stats.itemsNumbered += occurrences.length;

      // Ajouter numérotation
      occurrences.forEach((match, index) => {
        const annotation = this.annotations.find(a =>
          a.start === match.start && a.end === match.end
        );

        if (annotation) {
          annotation.itemNumber = index + 1;
          annotation.itemTotal = occurrences.length;
        }
      });
    }
  }

  // 3. Mettre à jour affichage
  this._updateDisplay();

  // 4. Feedback
  ui.notifications.info(
    `Refresh complete: ${stats.nextDetected} separators, ` +
    `${stats.constructsFound} patterns, ` +
    `${stats.itemsNumbered} items numbered`
  );
}

/**
 * Auto-détecte les séparateurs "Next" courants
 * @private
 * @returns {number} Nombre de next détectés
 */
_autoDetectNextSeparators() {
  const commonSeparators = ['|', ':', '-', '/', '•', '→'];
  let count = 0;

  // Chercher séparateurs entre annotations existantes
  const sorted = [...this.annotations].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const between = this.sourceText.substring(current.end, next.start).trim();

    if (commonSeparators.includes(between) && between.length <= 2) {
      // Créer annotation Next si pas déjà existante
      const exists = this.annotations.some(a =>
        a.next && a.start === current.end && a.end === next.start
      );

      if (!exists) {
        this.annotations.push({
          id: `ann-${Date.now()}-${count}`,
          start: current.end,
          end: next.start,
          next: true,
          selectedText: between,
          colors: this.colorManager.assignColor(`next-${count}`)
        });
        count++;
      }
    }
  }

  return count;
}
```

---

### 5. Calculs Simples (Mapping Table)

#### Opérateurs Supportés

**Arithmétique**:
- `+` : Addition
- `-` : Soustraction
- `*` : Multiplication
- `/` : Division
- `%` : Modulo

**Chaînes**:
- `+` : Concaténation (auto-détecté si opérande est string)

**Logique**:
- `||` : Fallback (si null/undefined, prendre valeur de droite)
- `&&` : Et logique
- `? :` : Ternaire

**Fonctions Mathématiques**:
- `Math.floor()`, `Math.ceil()`, `Math.round()`
- `Math.min()`, `Math.max()`
- `Math.abs()`

#### Exemples Valides

```javascript
// Arithmétique simple
hp * 10                          // 5 * 10 = 50
tier + difficulty                // 1 + 3 = 4
(hp + stress) / 2                // (10 + 5) / 2 = 7.5

// Chaînes
name + " (Tier " + tier + ")"    // "Goblin (Tier 1)"
"Level " + level                 // "Level 5"

// Fallback
evasion || 12                    // Si evasion absent, utiliser 12
damage || "1d6"                  // Si damage absent, "1d6"

// Ternaire
tier > 2 ? "Boss" : "Minion"     // Si tier > 2, "Boss", sinon "Minion"
hp > 0 ? "Alive" : "Dead"        // Conditionnel

// Fonctions Math
Math.floor(hp * 1.5)             // 10 * 1.5 = 15.0 → 15
Math.max(tier, 1)                // Au moins 1
```

#### Exemples Invalides (Non Supportés pour v2)

```javascript
// Fonctions custom
normalizeTier(tierRaw)           // ❌ Pas de fonctions custom
customTransform(value)           // ❌

// Regex
value.replace(/\d+/, "")         // ❌ Pas de regex

// Méthodes complexes
value.split(",").map(x => x.trim()) // ❌ Pas d'array methods

// Boucles
for (let i = 0; i < 10; i++) ... // ❌
```

**Note**: Pour v3, on pourra ajouter une bibliothèque de fonctions prédéfinies.

#### Évaluateur Simplifié

```javascript
/**
 * Évalue une expression simple avec contexte
 * @param {string} expression Expression à évaluer
 * @param {object} context Variables disponibles {hp: 10, tier: 1, ...}
 * @returns {any} Résultat ou null si erreur
 */
evaluateSimple(expression, context) {
  try {
    // 1. Whitelist de caractères autorisés
    const allowedPattern = /^[a-zA-Z0-9_\s\+\-\*\/\%\(\)\|\&\?\:\.\[\]"']+$/;
    if (!allowedPattern.test(expression)) {
      console.warn('Expression contains invalid characters:', expression);
      return null;
    }

    // 2. Whitelist de mots-clés autorisés (éviter code malicieux)
    const forbiddenKeywords = ['eval', 'Function', 'setTimeout', 'setInterval', 'import', 'require'];
    for (const keyword of forbiddenKeywords) {
      if (expression.includes(keyword)) {
        console.warn('Expression contains forbidden keyword:', keyword);
        return null;
      }
    }

    // 3. Remplacer variables par valeurs
    let code = expression;

    // Créer contexte sécurisé
    const safeContext = {};
    for (const [key, value] of Object.entries(context)) {
      safeContext[key] = value;
    }

    // Ajouter Math
    safeContext.Math = Math;

    // 4. Évaluer dans scope isolé
    const func = new Function(...Object.keys(safeContext), `return ${code};`);
    const result = func(...Object.values(safeContext));

    return result;

  } catch (error) {
    console.error('Expression evaluation error:', error);
    return null;
  }
}
```

**Usage**:
```javascript
const context = {hp: 10, tier: 2, name: "Goblin"};

evaluateSimple("hp * 10", context);                    // 100
evaluateSimple("name + ' Tier ' + tier", context);     // "Goblin Tier 2"
evaluateSimple("tier > 1 ? 'Boss' : 'Minion'", context); // "Boss"
evaluateSimple("Math.floor(hp * 1.5)", context);       // 15
```

---

### 6. Affichage de la Numérotation

Quand plusieurs items sont détectés (via List + Construct), afficher:

**Dans le preview**:
```html
<div class="construct-item" data-item="1/3">
  <span class="item-badge">1/3</span>
  <span class="tag">[name]</span>Claws<span class="tag-close">[/name]</span>
  ...
</div>
```

**CSS**:
```css
.construct-item {
  position: relative;
  margin-bottom: 10px;
  padding: 5px;
  border-left: 3px solid #4b9e4b; /* Vert */
}

.item-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #4b9e4b;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}

/* Alternance de couleurs pour items */
.construct-item:nth-child(odd) {
  background: rgba(75, 158, 75, 0.05);
}

.construct-item:nth-child(even) {
  background: rgba(75, 158, 75, 0.1);
}
```

---

## Récapitulatif des Modifications

### Fichiers à Créer
1. ✅ `doc/specifications.md` (ce fichier)
2. ⬜ `scripts/visual-model/color-manager.mjs`
3. ⬜ `scripts/visual-model/mapping-table.mjs`
4. ⬜ `scripts/visual-model/pattern-detector.mjs`

### Fichiers à Modifier
1. ⬜ `scripts/template-app.mjs`
   - Intégrer ColorManager
   - Modifier couleurs outils (tous verts)
   - Ajouter détection champs unmapped (italique)
   - Ajouter bouton Refresh Calculations
   - Intégrer MappingTable avec évaluateur simple

2. ⬜ `templates/template-creator.html`
   - Changer couleurs boutons outils
   - Ajouter bouton Refresh
   - Ajouter divider dans toolbar

3. ⬜ `styles/actor-importer.css`
   - Tous les outils en vert (même couleur)
   - Champs en gris neutre
   - Style italique pour champs unmapped
   - Style numérotation items

### Priorités
1. **Phase 1a**: Couleurs (tokens HSL, outils verts, champs gris)
2. **Phase 1b**: Hover tooltips
3. **Phase 1c**: Champs unmapped en italique
4. **Phase 2**: Bouton Refresh Calculations
5. **Phase 3**: Mapping Table (calculs simples)
6. **Phase 4**: Détection patterns basée tokens

---

**Dernière mise à jour**: 2025-11-27
**Statut**: Spécifications validées - Implémentation démarrée
