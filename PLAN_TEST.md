# Plan de Test - Actor Importer

## Vue d'ensemble

Ce plan de test couvre tous les cas d'import pour vérifier que l'architecture refactorisée fonctionne correctement :
- **Parsers** : extraient les données en conservant la langue source
- **Converters** : traduisent les codes système (FR→EN) tout en gardant les descriptions en langue source

---

## Prérequis

1. Ouvrir Foundry VTT v13+
2. Activer le module "Actor Importer"
3. Ouvrir la console développeur (F12)
4. Accéder à l'onglet "Actors"

---

## Test 1 : Daggerheart (Anglais) → Daggerheart

**Source** : Daggerheart LdB Anglais
**Target** : Daggerheart

### Données de test
```
Dire Wolf Tier 2
A large, fierce predator with matted gray fur and glowing yellow eyes.
Motives & Tactics: Hunt in packs, target the weakest prey.
Difficulty: 16  Thresholds: 10/18
HP: 10  Stress: 4
ATK: +2 | Bite: Very Close | 2d8+3 phy
Experience: Pack Hunter +2
FEATURES
Alpha Howl (2) - Action: Rally nearby wolves, granting them advantage on their next attack.
Tackle - Reaction: When an enemy moves away, knock them prone.
Keen Senses - Passive: Advantage on perception checks.
```

### Vérifications
- [ ] Nom : "Dire Wolf"
- [ ] Tier : 2 (visible dans la biographie)
- [ ] Biographie contient : "A large, fierce predator..." et "Motives & Tactics..."
- [ ] Difficulty (Evasion) : 16
- [ ] Thresholds : Major 10, Severe 18
- [ ] HP max : 10
- [ ] Stress max : 4
- [ ] Arme principale :
  - Nom : "Bite"
  - To-Hit : +2
  - Range : "Very Close"
  - Damage : 2d8 +3
  - Type : "phy"
- [ ] Items :
  - Experience "Pack Hunter" (rarity: 2)
  - Feature "Alpha Howl" (Action, uses: 2)
  - Feature "Tackle" (Reaction)
  - Feature "Keen Senses" (Passive)

### Console logs attendus
```
=== Daggerheart Parser - Début ===
  >> Tier extrait: 2
  >> Difficulty: 16
  >> Thresholds: { major: 10, severe: 18 }
  >> HP: 10
  >> Stress: 4
  >> Attaque: { name: "Bite", toHit: 2, range: "Very Close", ... }
  >> Experience: { name: "Pack Hunter", bonus: "+2" }
  >> Feature: Alpha Howl (Action)
  >> Feature: Tackle (Reaction)
  >> Feature: Keen Senses (Passive)
=== Daggerheart Parser - Fin ===
=== DaggerheartConverter - Début ===
  >> mapItems - début
  >> Experience: Pack Hunter (+2)
  >> Feature: Alpha Howl (Action → Action)
  >> Feature: Tackle (Reaction → Reaction)
  >> Feature: Keen Senses (Passive → Passive)
  >> mapItems - fin, 4 items créés
✓ Conversion terminée
=== DaggerheartConverter - Fin ===
```

---

## Test 2 : Daggerheart (Français) → Daggerheart

**Source** : Daggerheart LdB Français
**Target** : Daggerheart

### Données de test
```
Loup Sombre Niveau 2
Un grand prédateur féroce avec une fourrure grise emmêlée et des yeux jaunes brillants.
Motifs & Tactiques : Chasser en meute, cibler la proie la plus faible.
Difficulté: 16  Seuils: 10/18
PV: 10  Stress: 4
ATK: +2 | Morsure: Très Proche | 2d8+3 phy
Expérience: Chasseur de Meute +2
CAPACITÉS
Hurlement Alpha (2) - Action: Rallie les loups à proximité, leur donnant l'avantage à leur prochaine attaque.
Charge - Réaction: Quand un ennemi s'éloigne, le mettre à terre.
Sens Aiguisés - Passif: Avantage aux jets de perception.
```

### Vérifications
- [ ] Nom : "Loup Sombre"
- [ ] Tier : 2
- [ ] Biographie en FRANÇAIS : "Un grand prédateur féroce..." et "Motifs & Tactiques..."
- [ ] Difficulty : 16
- [ ] Thresholds : 10/18
- [ ] HP : 10, Stress : 4
- [ ] Arme "Morsure" : +2, Très Proche, 2d8+3 phy
- [ ] Items :
  - Experience "Chasseur de Meute" (nom en FRANÇAIS)
  - Feature "Hurlement Alpha" (Action - **traduit en anglais**, description en FRANÇAIS)
  - Feature "Charge" (Reaction - **traduit**, description en FRANÇAIS)
  - Feature "Sens Aiguisés" (Passive - **traduit**, description en FRANÇAIS)

### Console logs attendus
```
=== Daggerheart Parser - Début ===
  >> Feature: Hurlement Alpha (Action)
  >> Feature: Charge (Réaction)
  >> Feature: Sens Aiguisés (Passif)
=== DaggerheartConverter - Début ===
  >> Feature: Hurlement Alpha (Action → Action)
  >> Feature: Charge (Réaction → Reaction)
  >> Feature: Sens Aiguisés (Passif → Passive)
✓ Conversion terminée
```

**Point clé** : Les types d'action "Réaction" et "Passif" doivent être traduits en "Reaction" et "Passive" dans `system.category`.

---

## Test 3 : Fabula Ultima (Français) → Project FU

**Source** : Fabula Ultima FR LdB
**Target** : Project FU

### Données de test
```
CHAUVE-SOURIS VAMPIRE Niv. 5 w BÊTE
Une petite chauve-souris aux yeux rouges luisants qui se nourrit de sang.
Traits typiques : Nocturne, volant
DEX d10 INT d8 PUI d6 VOL d8 PV 50 w 25 PM 45 Init. 9
DEF +0 DEF M. +0 ' a VU b a E RS f i l b RS
ATTAQUES DE BASE
$ Morsure w [DEX + DEX] w 10 w dégâts physiques
$ Cri Sonique w [INT + VOL] w 15 w dégâts d'air
RÈGLES SPÉCIALES
Vol w Peut voler et planer.
Drain de Sang w Restaure 5 PV en attaquant une cible vivante.
```

### Vérifications
- [ ] Nom : "CHAUVE-SOURIS VAMPIRE"
- [ ] Niveau : 5
- [ ] Espèce : "beast" (traduit de "bête")
- [ ] Description en FRANÇAIS : "Une petite chauve-souris..."
- [ ] Traits en FRANÇAIS : "Nocturne, volant"
- [ ] Attributs **traduits** :
  - DEX : d10 (8 base)
  - INS : d8 (traduit de INT, 8 base)
  - MIG : d6 (traduit de PUI, 6 base)
  - WLP : d8 (traduit de VOL, 8 base)
- [ ] PV : max 50, bonus = 50 - [(5×6) + (2×5)] = 50 - 40 = **10**
- [ ] PM : max 45, bonus = 45 - [(5×8) + (2×5)] = 45 - 50 = **-5**
- [ ] Init : 9
- [ ] DEF : 0, MDEF : 0
- [ ] Affinités **traduites** :
  - Physical (de "physiques") : VU (-1)
  - Air : RS (1)
  - Bolt (de "foudre") : normal (0)
  - Dark (de "ténèbres") : RS (1)
  - Earth (de "terre") : normal (0)
  - Fire (de "feu") : normal (0)
  - Ice (de "glace") : normal (0)
  - Light (de "lumière") : normal (0)
  - Poison : RS (1)
- [ ] Attaques :
  - "Morsure" : DEX+DEX (traduit), 10 dégâts, type "physical" (traduit de "physiques")
  - "Cri Sonique" : INS+WLP (traduit de INT+VOL), 15 dégâts, type "air" (traduit de "d'air")
- [ ] Règles :
  - "Vol" (nom en FRANÇAIS, description en FRANÇAIS)
  - "Drain de Sang" (nom en FRANÇAIS, description en FRANÇAIS)

### Console logs attendus
```
=== Fabula Ultima Parser - Début ===
Espèce (FR): bête
  >> mapAttributes - source: { dex: {base: 10}, int: {base: 8}, pui: {base: 6}, vol: {base: 8} }
  >> Calcul: base = (5×PUI:6) + (2×Niv:5) = 40, bonus = 10
  >> Calcul: base = (5×VOL:8) + (2×Niv:5) = 50, bonus = -5
  >> parseFabulaAffinities - début
  >> Token[0]: "'" = physiques → valeur "VU" = -1
  >> Token[2]: "a" = air → pas de valeur, défaut = 0
  >> Token[3]: "VU" est une valeur sans symbole d'affinité, ignoré
  >> Token[4]: "b" = foudre → pas de valeur, défaut = 0
  ...
=== Fabula Ultima Parser - Fin ===
=== ProjectFUConverter - Début ===
  >> mapSpecies - source: bête
  >> mapSpecies - traduit: beast
  >> mapAttributes - source: { dex: {base: 10}, int: {base: 8}, pui: {base: 6}, vol: {base: 8} }
  >> mapAffinities - source: { physiques: {base: -1}, air: {base: 0}, foudre: {base: 0}, ... }
  >> mapAffinities - résultat: { physical: {base: -1}, air: {base: 0}, bolt: {base: 0}, ... }
  >> mapItems - 4 items à mapper
  >> Item "Morsure": damageType physiques → physical, attrs dex/dex → dex/dex
  >> Item "Cri Sonique": damageType d'air → air, attrs int/vol → ins/wlp
✓ Conversion terminée
=== ProjectFUConverter - Fin ===
```

**Points clés** :
- Espèce : `bête` → `beast`
- Attributs : `int` → `ins`, `pui` → `mig`, `vol` → `wlp`
- Affinités : `physiques` → `physical`, `foudre` → `bolt`, etc.
- Types de dégâts : `physiques` → `physical`, `d'air` → `air`
- **Descriptions et noms restent en FRANÇAIS**

---

## Test 4 : Daggerheart (Anglais) → Daggerheart UO

**Source** : Daggerheart LdB Anglais
**Target** : Daggerheart UO (Unofficial)

### Données de test
```
Shadow Wraith Tier 3
A spectral entity shrouded in darkness, emanating cold dread.
Motives & Tactics: Drain life force from the living, avoid light sources.
Difficulty: 18  Thresholds: 12/20
HP: 12  Stress: 5
ATK: +3 | Shadow Touch: Close | 2d10+2 mag
Experience: Ethereal Movement +3
FEATURES
Phase Shift (1) - Action: Become incorporeal for one round, immune to physical damage.
Life Drain - Reaction: When hitting a target, heal 1d6 HP.
Shadow Form - Passive: Resistance to non-magical damage.
```

### Vérifications
- [ ] Acteur créé dans le système "Daggerheart UO"
- [ ] Même structure que Test 1 (les deux systèmes Daggerheart utilisent le même converter)
- [ ] Vérifier que le converter utilisé est bien `DaggerheartConverter` (même pour UO)

---

## Test 5 : Vérification des erreurs (edge cases)

### Test 5.1 : Données manquantes (Fabula Ultima)
```
SLIME Niv. 3 w MONSTRE
Un petit slime gélatineux.
DEX d6 INT d6 PUI d6 VOL d6
```

**Vérifications** :
- [ ] Pas d'erreur dans la console
- [ ] Valeurs par défaut utilisées : PV 40, PM 40, Init 0, DEF 0, MDEF 0
- [ ] Affinités toutes à 0
- [ ] Aucune attaque ni règle

### Test 5.2 : Caractères spéciaux Tier (Daggerheart)
```
Dragon Tier
A massive dragon with crimson scales.
Difficulty: 20  Thresholds: 15/25
HP: 20  Stress: 6
ATK: +4 | Claws: Very Close | 3d12+5 phy
FEATURES
```

**Note** : Le caractère  est le code unicode 58692 pour Tier 4

**Vérifications** :
- [ ] Tier correctement détecté comme 4
- [ ] Pas d'erreur de parsing

### Test 5.3 : Affinités complexes (Fabula Ultima)
```
GOLEM Niv. 7 w CONSTRUCT
Un golem de pierre animé.
DEX d6 INT d6 PUI d12 VOL d10 PV 80 w 40 PM 20
DEF +2 DEF M. +1 ' AB a IM b RS E VU f g h i
```

**Vérifications** :
- [ ] Physical : AB (3)
- [ ] Air : IM (2)
- [ ] Bolt : RS (1)
- [ ] Dark : VU (-1)
- [ ] Earth à Poison : 0 (pas de valeur fournie)

---

## Test 6 : CSV Import (format générique)

### Données de test
```
name,hp,stress,evasion,description
Test NPC,15,5,17,A generic test character
```

**Vérifications** :
- [ ] Acteur "Test NPC" créé
- [ ] HP max : 15
- [ ] Stress max : 5
- [ ] Evasion : 17
- [ ] Biography : "A generic test character"

---

## Test 7 : JSON Import (format direct)

### Données de test
```json
{
  "name": "JSON Test Actor",
  "type": "npc",
  "system": {
    "health": { "value": 0, "max": 20 },
    "stress": { "value": 0, "max": 6 }
  }
}
```

**Vérifications** :
- [ ] Acteur créé avec les données exactes du JSON
- [ ] Pas de conversion appliquée (format direct)

---

## Checklist de validation globale

### Architecture
- [ ] Tous les parsers retournent un format intermédiaire avec données en langue SOURCE
- [ ] Tous les converters traduisent les codes système (FR→EN) uniquement
- [ ] Les descriptions, noms de features, biographies restent en langue SOURCE

### Logs console
- [ ] Pas d'erreurs JavaScript
- [ ] Logs structurés visibles pour chaque étape (Parser → Converter)
- [ ] Valeurs calculées affichées (bonus HP/MP pour Fabula Ultima)

### Données acteur
- [ ] Toutes les stats numériques correctes
- [ ] Tous les items créés avec bonnes catégories
- [ ] Traductions appliquées uniquement aux champs système (`category`, `damageType`, `attributes`)
- [ ] Textes descriptifs préservés en langue source

---

## Commandes utiles

### Ouvrir le dialogue d'import
```javascript
game.ActorImporter.show()
```

### Vérifier un acteur créé
```javascript
// Lister tous les acteurs
game.actors.map(a => `${a.name} (${a.type})`)

// Inspector un acteur
const actor = game.actors.getName("CHAUVE-SOURIS VAMPIRE")
console.log(actor)
console.log(actor.system)
console.log(actor.items.map(i => ({ name: i.name, type: i.type, category: i.system.category })))
```

### Vérifier les affinités (Project FU)
```javascript
const actor = game.actors.getName("CHAUVE-SOURIS VAMPIRE")
console.log(actor.system.affinities)
```

---

## Résultats attendus

Si tous les tests passent :
✅ L'architecture parsers/converters fonctionne correctement
✅ La séparation langue source / traduction système est respectée
✅ Toutes les combinaisons source→target fonctionnent
✅ Les données sont correctement mappées et traduites
