# Phase 1 Complétée - Système de Couleurs et Tooltips

**Date**: 2025-11-27
**Statut**: ✅ Implémentation terminée - Prêt pour tests

---

## Résumé des Modifications

La Phase 1 du Visual Model Builder v2 est maintenant complète. Le système de visualisation colorée et les tooltips interactifs ont été entièrement implémentés.

### Ce qui a été fait

#### 1. Nouveau Fichier Créé

**`scripts/visual-model/color-manager.mjs`** (189 lignes)
- Classe `ColorManager` pour gérer les couleurs HSL
- 12 couleurs distinctes (rotation de hue 30°)
- Saturation 70%, Lightness 85% pour fond
- Bordures plus foncées (lightness -30%)
- Couleurs spéciales pour "Next" (gris) et champs unmapped (gris fade)
- Méthodes: `assignColor()`, `getColor()`, `getDarkerShade()`, `export()`, `import()`

#### 2. Modifications dans `scripts/template-app.mjs`

**Import et Initialisation**:
- Ligne 5: Import `ColorManager`
- Ligne 23: Initialisation dans constructor `this.colorManager = new ColorManager()`

**Assignment de Couleurs**:
- Ligne 300-309: `_onFieldButton()` modifié pour assigner couleurs uniques
- Ligne 323-343: `_onSkipTool()` modifié pour utiliser couleur grise neutre

**Vérification Champs**:
- Ligne 92-106: Nouvelle méthode `_fieldExistsInSystem()`
  - Vérifie si un champ existe dans le schéma système
  - Utilisé pour détecter les champs unmapped (italiques)

**Génération HTML Coloré**:
- Ligne 775-836: `_generateAnnotatedHtml()` complètement refactoré
  - Styles inline avec couleurs HSL
  - Détection champs unmapped → italique + opacité 0.7
  - Tags avec bordure gauche colorée (4px)
  - Texte avec fond coloré
  - Data attributes pour hover: `data-id`, `data-field`, `data-mode`

**Event Listeners**:
- Ligne 148-149: Ajout hover listeners `mouseenter`/`mouseleave` sur `.tag` et `.annotated-text`

**Handlers de Tooltips**:
- Ligne 750-807: `_onTagHover()` - Crée et affiche tooltip avec info annotation
  - Affiche Field/Mode/Transform
  - Warning si champ unmapped
  - Position dynamique sous l'élément
- Ligne 809-815: `_onTagLeave()` - Retire tooltip

#### 3. Modifications dans `styles/actor-importer.css`

**Nouveau CSS ajouté** (lignes 147-369):

**Tooltips** (lignes 152-168):
- Fond noir 90% opacité
- Padding 8px, border-radius 4px
- Max-width 300px
- Box-shadow pour profondeur
- Strong labels en orange

**Tags et Annotations** (lignes 171-206):
- `.tag`: Display inline-block, cursor pointer, transition 0.2s
- `.tag:hover`: Opacité 0.8, scale 1.05
- `.annotated-text`: Display inline, cursor help
- `.field-unmapped`: Italique + opacité 0.7

**Boutons Outils - TOUS VERTS** (lignes 209-239):
- `.tool-btn`: Background #4b9e4b (vert)
- Hover: #3d8b3d avec box-shadow
- Active: Transform translateY(0)
- `.active`: Background plus foncé #2d6b2d

**Boutons Champs - GRIS NEUTRE** (lignes 242-262):
- `.field-btn`: Background #f0f0f0 (gris clair)
- Hover: #e0e0e0 avec bordure #999
- Active: #d0d0d0

**Styles de Window** (lignes 265-369):
- Layout flex pour panels
- Toolbar styling
- Eraser mode cursor

---

## Fonctionnalités Implémentées

### ✅ Système de Couleurs HSL
- 12 couleurs distinctes assignées automatiquement
- Chaque annotation reçoit une couleur unique
- Couleurs persistées dans l'annotation (`colors` property)
- Séparateurs "Next" en gris neutre
- Champs unmapped en gris fade + italique

### ✅ Tooltips Interactifs
- Affichage au hover sur tags ou texte annoté
- Info affichée: Field, Mode, Transform
- Warning visuel pour champs unmapped (rouge)
- Position dynamique sous l'élément
- Retire automatiquement au mouseleave

### ✅ Distinction Visuelle Outils vs Champs
- **Tous les boutons outils**: Vert (#4b9e4b)
- **Tous les boutons champs**: Gris neutre (#f0f0f0)
- Pas de confusion possible

### ✅ Champs Unmapped
- Détection automatique via `_fieldExistsInSystem()`
- Style italique + opacité réduite
- Warning dans tooltip
- Préparation pour ignorer si non utilisés dans mapping table (Phase 3)

---

## Exemple Visuel

### Avant (Phase 0)
```
[name]Goblin[/name] | [tier:toChar]1[/tier] | [hp]10[/hp]
```
Tout en texte brut, pas de couleurs, pas d'info au hover.

### Après (Phase 1)
```
[name] (fond bleu clair, bordure bleue) Goblin (fond bleu clair) [/]
[Next] (fond gris) | (fond gris) [/]
[tier] (fond vert clair, bordure verte) 1 (fond vert clair) [/]
[Next] (fond gris) | (fond gris) [/]
[hp] (fond rouge clair, bordure rouge) 10 (fond rouge clair) [/]
```

**Au hover sur `[name]`**:
```
┌──────────────────────┐
│ Field: name          │
│ Mode: toSpace        │
│ Text: "Goblin"       │
└──────────────────────┘
```

**Si champ custom non mappé** (ex: `[myField]`):
```
[myField] (italique, opacité 0.7, fond gris) Value [/]
```

**Tooltip avec warning**:
```
┌──────────────────────────────────┐
│ Field: myField                   │
│ Mode: toNewline                  │
│ Warning: Field not in system     │ (en rouge)
│ schema                           │
│ Text: "Value"                    │
└──────────────────────────────────┘
```

---

## Tests à Effectuer

### Test 1: Couleurs Basiques
1. Ouvrir Foundry VTT
2. Console: `game.modules.get('actor-importer').api.showTemplateCreator()`
3. Coller texte dans panneau gauche:
   ```
   Goblin Tier 1
   HP: 10  Stress: 5
   ATK: +2 | Sword: Close | 1d8 Physical
   ```
4. Sélectionner "Goblin" → Cliquer champ `name`
5. Sélectionner "1" → Cliquer champ `tier`
6. Sélectionner "10" → Cliquer champ `health.max`

**Résultat attendu**:
- Panneau droit affiche texte avec 3 couleurs distinctes
- Chaque champ a fond coloré + bordure plus foncée
- Les trois couleurs sont différentes (bleu, vert, rouge ou similaire)

### Test 2: Tooltips
1. Hover sur tag `[name]` dans panneau droit
2. **Attendu**: Tooltip apparaît sous le tag avec:
   - "Field: name"
   - "Mode: toSpace" (ou autre mode détecté)
   - "Text: \"Goblin\""
3. Move souris away
4. **Attendu**: Tooltip disparaît

### Test 3: Séparateurs "Next"
1. Sélectionner " | " entre deux champs
2. Cliquer outil "Skip"
3. **Attendu**: Tag `[Next]` avec fond gris neutre (pas coloré HSL)

### Test 4: Champs Unmapped
1. Sélectionner texte
2. Console: Créer field button custom
   ```javascript
   $('<button class="field-btn" data-field="customField123">customField123</button>')
     .appendTo('#system-fields')
     .on('click', (e) => { /* trigger field button handler */ });
   ```
3. Cliquer ce bouton custom
4. **Attendu**:
   - Texte annoté en italique
   - Opacité réduite
   - Hover tooltip affiche "Warning: Field not in system schema" en rouge

### Test 5: Couleurs Outils vs Champs
1. Observer toolbar
2. **Attendu**:
   - Skip, Multiline, Construct, List, Transform, Eraser: TOUS VERTS
   - Champs (name, tier, hp, etc.): TOUS GRIS
3. Hover sur outils
4. **Attendu**: Vert devient plus foncé avec shadow

---

## Problèmes Connus / À Tester

### ⚠️ Performance avec Grands Textes
Si le texte source contient 1000+ lignes:
- Génération HTML peut être lente
- Tooltips peuvent avoir delay
- **Solution future**: Virtualisation (Phase 5)

### ⚠️ Chevauchement de Sélections
Si deux annotations se chevauchent (start/end overlap):
- Comportement non défini
- **À tester**: Créer deux annotations qui se chevauchent

### ⚠️ Escape HTML
La méthode `_escapeHtml()` existante est utilisée:
- Si texte contient `<`, `>`, `&`, ils sont escaped
- **À vérifier**: Texte avec caractères spéciaux

---

## Prochaines Étapes

### Phase 2: Outils Améliorés (1-2h)
- [ ] Renommer "Skip" → "Next" dans HTML
- [ ] Ajouter tooltips à tous les boutons outils
- [ ] Créer outil "Item"
- [ ] Mettre à jour icônes si nécessaire

### Phase 3: Mapping Table (3-4h)
- [ ] Créer `MappingTable` component
- [ ] Intégrer UI en bas de l'interface
- [ ] Évaluateur d'expressions simples
- [ ] Auto-populate depuis annotations

### Phase 4: Bouton Refresh + List (2-3h)
- [ ] Bouton "Rafraîchir Calcul"
- [ ] Auto-détection Next separators
- [ ] Détection constructs répétés
- [ ] Numérotation items (1/5, 2/5, etc.)

---

## Fichiers Modifiés - Résumé

```
Nouveaux fichiers:
+ scripts/visual-model/color-manager.mjs (189 lignes)
+ doc/specifications.md (590 lignes)
+ doc/phase1-complete.md (ce fichier)

Fichiers modifiés:
M scripts/template-app.mjs (+75 lignes, refactor _generateAnnotatedHtml)
M styles/actor-importer.css (+225 lignes CSS)

Total ajouté: ~1079 lignes
Total modifié: ~300 lignes
```

---

## Commandes Git

```bash
# Voir les changements
git status
git diff scripts/template-app.mjs
git diff styles/actor-importer.css

# Commiter (si validé par tests)
git add scripts/visual-model/color-manager.mjs
git add scripts/template-app.mjs
git add styles/actor-importer.css
git add doc/

git commit -m "Phase 1: Implement color system and hover tooltips

- Add ColorManager with HSL color generation (12 distinct colors)
- Modify _generateAnnotatedHtml() for colored display with inline styles
- Add hover tooltips showing field/mode/transform info
- Implement unmapped field detection (italic + faded)
- Update CSS: all tool buttons green, all field buttons gray
- Add comprehensive tooltip styling
- Update documentation with specs and implementation details"
```

---

**Phase 1**: ✅ **TERMINÉE**
**Prochaine phase**: Phase 2 - Outils Améliorés
**Temps estimé Phase 2**: 1-2 heures
