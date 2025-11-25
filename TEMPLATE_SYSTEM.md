# Système de Templates Configurables - Actor Importer

## Vue d'Ensemble

Le système de templates configurables permet de créer des modèles réutilisables pour importer des acteurs depuis n'importe quel format texte. Au lieu de coder un parseur pour chaque format, vous pouvez visuellement annoter un exemple de texte et créer un template qui pourra être appliqué à d'autres textes similaires.

## Accès au Créateur de Templates

### Via l'Interface
1. Ouvrez l'onglet **Actors** dans Foundry VTT
2. Cliquez sur le bouton **Templates** dans la barre d'en-tête
3. Le créateur de templates s'ouvre

### Via la Console
```javascript
game.ActorImporter.showTemplateCreator()
```

## Modes de Fonctionnement

### Mode Création
Utilisé pour créer ou modifier des templates en annotant visuellement un exemple de texte.

### Mode Application
Utilisé pour appliquer un template existant à un nouveau texte et créer un acteur.

## Workflow : Créer un Template

### 1. Préparer le Texte Source

Collez un exemple complet du format que vous souhaitez parser :

```
SAND SPRITE
Tier 1 Ranged
A small, fairy-like creature made of sand and dirt.
Motives & Tactics: Prank, torment, evade
Difficulty: 11 | Thresholds: 4/8 | HP: 4 | Stress: 3
ATK: +1 | Spit Sand: Far | 1d12+1 phy
Experience: Joke's on You +2
FEATURES
Flying - Passive: While flying, the Sand Sprite gains a +2
bonus to their Difficulty.
Spray Sand - Action: Spend a Fear to cover all targets
within Close range with fine sand.
```

### 2. Annoter le Texte

1. **Sélectionnez** une portion de texte (ex: "SAND SPRITE")
2. **Cliquez** sur un bouton de champ système (ex: `[name]`)
3. Le système détecte automatiquement le mode de parsing approprié
4. L'annotation apparaît dans le panneau droit

**Outils disponibles :**
- **Boutons de champs** : Assigner un champ système au texte sélectionné
- **>>> Skip** : Marquer du texte à ignorer (séparateurs, labels)
- **📄 Multi** : Texte multi-lignes
- **🔧 Construct** : Patterns avec regex (ex: "Name - Type:")
- **📋 Liste** : Zones répétitives (ex: liste de features)
- **🔄 Transform** : Transformations (number, trim, etc.)

### 3. Modes de Parsing

Le système détecte automatiquement le mode selon le contexte :

| Mode | Description | Exemple |
|------|-------------|---------|
| `toNewline` | Continue jusqu'au `\n` | Nom de créature |
| `toSpace` | Continue jusqu'à l'espace | Tier, difficulty |
| `toChar` | Continue jusqu'à un caractère spécifique | `threshold.major` jusqu'à "/" |
| `multiline` | Continue jusqu'au prochain token | Description longue |
| `literal` (skip) | Texte fixe à ignorer | "Tier ", "HP: " |
| `construct` | Pattern regex avec groupes | "Flying - Passive:" |
| `list` | Zone répétitive | Liste de features |

### 4. Utiliser les Constructs

Les constructs permettent d'extraire plusieurs champs depuis un pattern :

**Exemple** : Parser "Flying - Passive: Description"

1. Sélectionner "Flying - Passive: Description text"
2. Cliquer sur **🔧 Construct**
3. Le système détecte le pattern : `^(.+?) - (.+?):`
4. Mapper les groupes :
   - Groupe 1 → `item.name` ("Flying")
   - Groupe 2 → `item.type` ("Passive")
5. Cocher "Sauvegarder pour réutilisation" si ce pattern est réutilisable

### 5. Gérer les Listes

Pour les sections répétitives (features, attaques, etc.) :

1. Sélectionner le token de début (ex: "FEATURES\n") et cliquer **Skip**
2. Cliquer **📋 Liste**
3. Définir le construct des items (ex: "Name - Type:")
4. Annoter le premier item comme exemple
5. Le système appliquera le pattern aux items suivants

### 6. Appliquer des Transformations

Pour convertir automatiquement les valeurs :

1. Créer une annotation (ex: tier)
2. Cliquer **🔄 Transform**
3. Entrer les transformations : `number, trim`

**Transformations disponibles :**
- `number` : Convertir en entier
- `float` : Convertir en décimal
- `boolean` : Convertir en booléen
- `lowercase` : Minuscules
- `uppercase` : Majuscules
- `trim` : Supprimer les espaces

### 7. Sauvegarder le Template

1. Cliquer **💾 Sauvegarder**
2. Remplir les métadonnées :
   - **Nom** : "Adversaire Standard"
   - **Description** : "Créatures Daggerheart avec tier, features"
   - **Système** : "daggerheart"
   - **Auteur** : Votre nom
   - **Version** : "1.0.0"
3. Cliquer **Sauvegarder** ou **Exporter Uniquement**

## Workflow : Appliquer un Template

### 1. Charger le Template

1. Passer en **Mode Application**
2. Sélectionner le template dans la liste déroulante

### 2. Coller le Texte

Coller un nouveau texte au même format :

```
IRON GOLEM
Tier 3 Bruiser
A massive construct of animated metal and magic.
Motives & Tactics: Crush, endure, protect
Difficulty: 15 | Thresholds: 10/18 | HP: 8 | Stress: 5
ATK: +3 | Metal Fist: Melee | 2d10+5 phy
Experience: Unstoppable +3
FEATURES
Metal Body - Passive: The Golem has armor 3.
Earthquake Slam - Action: Spend a Fear to slam the ground.
```

### 3. Créer l'Acteur

1. Cliquer **▶️ Tester** pour voir le résultat du parsing
2. Si tout est correct, cliquer **✓ Créer Acteur**
3. L'acteur est créé et sa fiche s'ouvre

## Format de Template

Les templates sont stockés au format JSON :

```json
{
  "templateFormat": "fvtt-import-v1",
  "metadata": {
    "id": "daggerheart-adversary-std",
    "system": "daggerheart",
    "name": "Adversaire Standard",
    "description": "Créatures avec tier, features",
    "author": "Olivier",
    "version": "1.0.0",
    "created": "2025-01-15T10:30:00Z",
    "updated": "2025-01-15T10:30:00Z"
  },
  "constructs": {
    "featureHeader": {
      "pattern": "^(.+?) - (.+?):",
      "fields": ["item.name", "item.type"]
    }
  },
  "tokens": [
    {
      "id": "tok-1",
      "field": "name",
      "mode": "toNewline"
    },
    {
      "id": "tok-2",
      "skip": "Tier ",
      "mode": "literal"
    },
    {
      "id": "tok-3",
      "field": "tier",
      "mode": "toSpace",
      "transform": "number"
    }
  ]
}
```

## Import/Export

### Exporter un Template
1. Sélectionner le template
2. Cliquer **📤 Exporter**
3. Le fichier `.fvtt-template.json` est téléchargé

### Importer un Template
1. Cliquer **📥 Importer**
2. Sélectionner un fichier `.fvtt-template.json`
3. Le template est ajouté à la bibliothèque

## Champs Système par Défaut

### Daggerheart
- `name`, `tier`, `type`, `description`, `motives`
- `difficulty`, `threshold.major`, `threshold.severe`
- `health.max`, `stress.max`
- `weapon.name`, `weapon.tohit`, `weapon.range`, `weapon.damage`
- `experience.name`, `experience.value`

### D&D 5e
- `name`, `type`, `size`, `alignment`
- `ac`, `hp`, `speed`
- `str`, `dex`, `con`, `int`, `wis`, `cha`
- `cr`, `xp`

### Project FU (Fabula Ultima)
- `name`, `species`, `level`, `traits`
- `dex`, `ins`, `mig`, `wlp`
- `hp.max`, `mp.max`, `ip.max`
- `defense`, `mdef`

## Conseils et Astuces

### Bonne Pratique
- Commencer par les champs simples (nom, tier)
- Utiliser Skip pour les labels fixes ("HP: ", "Difficulty: ")
- Tester régulièrement avec le bouton **▶️**
- Sauvegarder les constructs réutilisables

### Dépannage
- **Le parsing échoue** : Vérifier que tous les séparateurs sont marqués Skip
- **Valeurs incorrectes** : Ajouter des transformations (`trim`, `number`)
- **Liste ne fonctionne pas** : S'assurer que le construct est bien défini

## API Programmation

### Créer un Template par Code

```javascript
import { ImportTemplateManager } from './scripts/template-manager.mjs';

const template = {
  templateFormat: 'fvtt-import-v1',
  metadata: {
    id: 'my-template',
    system: 'daggerheart',
    name: 'Mon Template',
    description: 'Description',
    author: game.user.name,
    version: '1.0.0'
  },
  constructs: {},
  tokens: [
    { id: 'tok-1', field: 'name', mode: 'toNewline' }
  ]
};

await ImportTemplateManager.saveTemplate('daggerheart', 'my-template', template);
```

### Parser avec un Template

```javascript
import { TemplateParser } from './scripts/template-parser.mjs';

const template = ImportTemplateManager.getTemplate('daggerheart', 'adversary-std');
const parser = new TemplateParser(template);
const data = parser.parse(sourceText);

console.log(data); // Données extraites
```

## Limitations Connues

- Les templates ne gèrent pas (encore) les formats tabulaires complexes
- Les regex très complexes peuvent causer des problèmes de performance
- Limite de taille de template : 1 MB

## Ressources

- [Documentation Foundry VTT](https://foundryvtt.com/api/)
- [Regex JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [Format JSON](https://www.json.org/)

## Support

Pour signaler un bug ou demander une fonctionnalité :
- GitHub Issues: [actor-importer/issues](https://github.com/anthropics/claude-code/issues)
- Discord : Foundry VTT Community

---

**Version** : 2.0.0
**Dernière mise à jour** : 2025-01-25
