# Documentation du Visual Model Builder v2

Ce répertoire contient la documentation pour les améliorations majeures du système de création de modèles d'import.

## Documents

### 1. [visual-model-builder-plan.md](./visual-model-builder-plan.md)
**Plan complet** avec architecture, spécifications techniques et roadmap détaillée.

- Vue d'ensemble des fonctionnalités
- Architecture des composants
- Format de sauvegarde JSON
- Tests à effectuer
- Documentation utilisateur
- 14 sections couvrant tous les aspects

### 2. [implementation-analysis.md](./implementation-analysis.md)
**Analyse détaillée** du code existant et modifications concrètes à apporter.

- État actuel du code (fichiers, fonctionnalités)
- 7 problèmes identifiés avec localisation dans le code
- Code complet pour chaque modification (copier-coller ready)
- 5 phases d'implémentation avec estimation temps
- Fichiers à créer/modifier listés

## Résumé Exécutif

### Problèmes Principaux Résolus

1. **Pas de visualisation couleur** → Système HSL avec 12 couleurs
2. **Outils peu clairs** → Renommage + tooltips détaillés
3. **Pas de mapping flexible** → Table 3 colonnes avec expressions
4. **Champs manquants** → Bouton "Custom Field"
5. **Outil List non implémenté** → Détection pattern + construct
6. **Pas de hover info** → Tooltips avec field/mode/transform

### Architecture Nouvelle

```
scripts/visual-model/
├── color-manager.mjs        # Gestion couleurs HSL
├── mapping-table.mjs        # Table mapping + eval expressions
├── construct-detector.mjs   # Détection patterns (Phase 4)
└── expression-evaluator.mjs # Évaluation calculs (Phase 3)
```

### Workflow Utilisateur Final

1. **Coller texte** dans panneau gauche
2. **Sélectionner mots** → Cliquer champ → **Texte coloré**
3. **Marquer séparateurs** avec "Next"
4. **Créer construct** pour pattern répétitif
5. **Appliquer à liste** avec "List"
6. **Définir calculs** dans table mapping
7. **Sauvegarder template**

### Estimation Totale

- **Phase 1** (Couleurs): 2-3h
- **Phase 2** (Outils): 1-2h
- **Phase 3** (Mapping): 3-4h
- **Phase 4** (List): 2h
- **Phase 5** (Custom): 1h

**Total: 9-12 heures**

## Prochaines Étapes

### Option A: Tout Implémenter
Suivre les 5 phases dans l'ordre, vérifier à chaque étape.

### Option B: MVP d'abord
Phases 1-2 uniquement (visualisation + tooltips), tester, puis décider de continuer.

### Option C: Feature Spécifique
Choisir une fonctionnalité précise (ex: mapping table uniquement).

## Commandes Utiles

```bash
# Voir la structure actuelle
ls -R scripts/

# Chercher références à "skip"
grep -r "skip" scripts/

# Tester dans Foundry
# 1. Ouvrir Foundry
# 2. Console: game.ActorImporter.showTemplateCreator()
```

## Contacts & Feedback

Pour questions ou modifications du plan:
- Ouvrir issue sur le repo
- Consulter CLAUDE.md pour contexte général
- Lire implementation-analysis.md pour détails code

---

**Dernière mise à jour**: 2025-11-27
**Version**: 2.0 (planification)
**Statut**: Prêt pour implémentation
