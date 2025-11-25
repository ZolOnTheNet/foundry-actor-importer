# Actor Importer

Module universel pour Foundry VTT permettant l'import d'acteurs depuis n'importe quelle source (copier-coller PDF, CSV, JSON) vers n'importe quel système de jeu.

## Objectifs du Projet

L'objectif principal d'Actor Importer est de **faciliter l'import massif d'acteurs** dans Foundry VTT en éliminant la saisie manuelle fastidieuse. Le module vise à :

- **Importer depuis n'importe quelle source** : Copiez un bloc de texte depuis un PDF, un site web, ou importez depuis CSV/JSON
- **Convertir vers n'importe quel système** : Architecture modulaire permettant d'ajouter facilement de nouveaux formats source et systèmes de destination
- **Affectation automatique d'images** : Système intelligent de correspondance entre noms d'acteurs et images
- **Multilingue** : Support de plusieurs langues (anglais, français) pour les sources et l'interface

### Architecture Pipeline Source → Cible

Le module utilise une architecture en deux phases :
1. **Parser la source** → Format intermédiaire normalisé
2. **Convertir vers le système cible** → Structure spécifique au système Foundry

Cette approche permet d'avoir **M sources × N systèmes** avec seulement **M+N** implémentations au lieu de M×N.

## Systèmes Actuellement Supportés

### Sources d'Import
- **Daggerheart LdB Anglais** : Blocs de statistiques depuis le livre de base Daggerheart (format standard et Incredible Creatures)
- **Daggerheart demo FR** : Format français du livre de règles Daggerheart
- **Fabula Ultima FR LdB** : Créatures et PNJ depuis les livres français de Fabula Ultima

### Systèmes de Destination
- **Daggerheart** (système officiel)
- **Daggerheart UO** (Unofficial Overhaul)
- **Project FU** (Fabula Ultima)
- **Autres** (format générique)

## Installation

### Méthode Manuelle
1. Téléchargez la dernière version depuis GitHub
2. Décompressez dans votre dossier `Data/modules/`
3. Activez le module dans Foundry VTT

### Méthode via Manifest URL
```
https://github.com/ZolOnTheNet/foundry-actor-importer/releases/latest/download/module.json
```

## Utilisation

### Import Basique

1. **Ouvrir le dialogue d'import** :
   - Cliquez sur le bouton "Importer un Acteur" dans la barre latérale des Acteurs (onglet Actors)
   - Ou utilisez la console : `game.ActorImporter.show()`
   - Ou faites clic-droit sur un dossier d'acteurs → "Importer un Acteur"

2. **Sélectionner la source et la cible** :
   - Choisissez le format source (d'où viennent vos données)
   - Choisissez le système de destination (vers quel système Foundry convertir)

3. **Coller vos données** :
   - Copiez le texte depuis votre PDF ou site web
   - Collez dans la zone de texte du dialogue
   - Cliquez sur "Importer"

4. **L'acteur est créé !** :
   - La fiche de l'acteur s'ouvre automatiquement
   - Toutes les statistiques, armes, et capacités sont pré-remplies

### Exemple : Import Daggerheart

Copiez un bloc de texte comme celui-ci depuis un PDF :

```
Bandit Tier 1
A common thief looking for easy marks.
Motives & Tactics: Steal valuables, avoid direct combat
Difficulty: 12  Thresholds: 10/5
HP: 3  Stress: 3
Evasion: 12  Major: 14  Severe: 16
ATK: +1 | Dagger: Very Close | 1d6 phy
Experience: Stealth +2
FEATURES
Quick Escape (2) - Reaction: Move to Close range when attacked
Sneak Attack - Passive: +1d6 damage when target is surprised
```

Le module détectera automatiquement le format et créera l'acteur complet avec toutes ses caractéristiques.

## Gestion Automatique des Images

Le module peut **automatiquement associer des images** aux acteurs importés en cherchant des correspondances de noms dans un dossier d'images.

### Configuration du Chemin d'Images

1. **Accédez aux paramètres du module** :
   - Menu Foundry → Configuration → Paramètres des Modules
   - Trouvez "Actor Importer"
   - Configurez "Chemin des Images d'Acteurs"

2. **Entrez un chemin de dossier** :
   - Exemple : `worlds/mon-monde/images/creatures`
   - Exemple : `modules/mon-module/assets/tokens`
   - Le chemin doit être relatif à votre dossier Data de Foundry

3. **Rafraîchir le cache d'images** :
   - Le cache se rafraîchit automatiquement toutes les 10 minutes
   - Rafraîchissement manuel : `game.ActorImporter.refreshImageCache()`

### Comment Fonctionne la Correspondance

Le module recherche des images dont le nom correspond au nom de l'acteur :

- **Correspondance exacte** : `Bandit.png` → acteur "Bandit"
- **Correspondance partielle** : `Bandit_token.webp` → acteur "Bandit"
- **Insensible à la casse** : `BANDIT.jpg` → acteur "bandit"
- **Extensions supportées** : `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`

#### Règles de Correspondance

1. **Normalisation des noms** :
   - Suppression des accents : "Créature" → "creature"
   - Conversion en minuscules
   - Suppression des caractères spéciaux

2. **Algorithme de recherche** :
   - Recherche d'abord une correspondance exacte du nom
   - Puis recherche si le nom de l'image contient le nom de l'acteur
   - Puis recherche si le nom de l'acteur contient le nom de l'image

3. **Priorité** :
   - Les correspondances exactes sont prioritaires
   - En cas de multiples correspondances, la première trouvée est utilisée

### Exemple d'Organisation d'Images

```
Data/worlds/mon-monde/images/creatures/
├── bandit.png           # Correspond à "Bandit"
├── goblin_warrior.webp  # Correspond à "Goblin Warrior"
├── dragon_rouge.jpg     # Correspond à "Dragon Rouge"
└── troll/
    └── troll_caverne.png  # Correspond à "Troll" ou "Troll Caverne"
```

### Conseils pour l'Organisation des Images

- **Nommage cohérent** : Utilisez des noms simples et descriptifs
- **Sous-dossiers** : Le module scanne récursivement tous les sous-dossiers (limite : 1500 fichiers)
- **Performance** : Le cache évite de scanner le système de fichiers à chaque import
- **Debug** : Vérifiez le cache avec `game.ActorImporter.imageCache.files`

## Formats d'Import Supportés

### Import Texte (Copier-Coller)
Le format le plus flexible - copiez directement depuis vos PDFs ou sites web. Le module détecte automatiquement le format source.

### Import CSV
Format tabulaire pour imports en masse. Structure :
```csv
name,type,hp,evasion,major,severe,description
Bandit,npc,3,12,14,16,A common thief
```

### Import JSON
Pour imports programmatiques ou exports depuis d'autres outils :
```json
{
  "name": "Bandit",
  "type": "npc",
  "system": {
    "health": {"value": 3, "max": 3}
  }
}
```

## Extension du Module

### Ajouter un Nouveau Format Source

1. Ajoutez une entrée dans `SOURCES` (actor-importer.mjs)
2. Créez une méthode de parsing (ex: `parseMonSysteme()`)
3. Retournez un format intermédiaire normalisé
4. Ajoutez les textes d'aide dans les fichiers de langue

### Ajouter un Nouveau Système de Destination

1. Créez un nouveau converter dans `scripts/converters/` (ex: `monsysteme-converter.mjs`)
2. Étendez la classe `BaseConverter`
3. Implémentez la méthode `convert()` pour mapper le format intermédiaire
4. Ajoutez l'entrée dans `TARGET_SYSTEMS`
5. Importez et utilisez dans `convertToTargetSystem()`

Voir le fichier [CLAUDE.md](CLAUDE.md) pour plus de détails sur l'architecture interne.

## Compatibilité

- **Foundry VTT** : Version 13+ (minimum 13.0.0, vérifié sur 13.346)
- **Systèmes de jeu** : Agnostique - fonctionne avec n'importe quel système
- **Navigateurs** : Tous les navigateurs supportés par Foundry VTT

## Développement et Contribution

### Structure du Projet
```
actor-importer/
├── scripts/
│   ├── actor-importer.mjs           # Orchestrateur principal
│   └── converters/                  # Convertisseurs système-spécifiques
│       ├── base-converter.mjs       # Classe de base
│       ├── daggerheart-converter.mjs
│       ├── daggerheart-unofficial-converter.mjs
│       └── projectfu-converter.mjs
├── styles/actor-importer.css        # Styles du dialogue
├── lang/                            # Fichiers de traduction
├── templates/import-dialog.html     # Template du dialogue
└── module.json                      # Manifeste du module
```

### Contributions

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le repository
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/ma-fonctionnalite`)
3. Committez vos changements (`git commit -m 'Ajout de ma fonctionnalité'`)
4. Pushez vers la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request

### Roadmap

- [ ] Support de nouveaux systèmes (D&D 5e, Pathfinder, etc.)
- [ ] Import depuis URL directe
- [ ] Import en masse (plusieurs acteurs à la fois)
- [ ] Interface d'édition pré-import
- [ ] Export vers différents formats
- [ ] Templates personnalisables de parsing

## License

Ce module est distribué sous licence [MIT](LICENSE).

## Auteurs

- **ZolOnTheNet** - Développeur principal

## Support et Questions

- **Issues** : [GitHub Issues](https://github.com/ZolOnTheNet/foundry-actor-importer/issues)
- **Discussions** : [GitHub Discussions](https://github.com/ZolOnTheNet/foundry-actor-importer/discussions)

## Changelog

### Version 2.0.0
- Gestion automatique des images avec système de cache
- Support du format Incredible Creatures pour Daggerheart
- Corrections pour Daggerheart UO
- Architecture modulaire avec converters

### Version 1.0.0
- Version initiale
- Support Daggerheart et Fabula Ultima
- Import depuis texte, CSV, JSON
