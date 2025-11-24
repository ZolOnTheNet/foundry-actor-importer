// Import converters - chemins absolus depuis la racine de Foundry
import { BaseConverter } from './converters/base-converter.mjs';
import { DaggerheartConverter } from './converters/daggerheart-converter.mjs';
import { DaggerheartUnofficialConverter } from './converters/daggerheart-unofficial-converter.mjs';
import { ProjectFUConverter } from './converters/projectfu-converter.mjs';

class ActorImporter {
  static ID = 'actor-importer';

  static FLAGS = {
    IMPORTED: 'imported'
  };

  static TEMPLATES = {
    DIALOG: `modules/${this.ID}/templates/import-dialog.html`
  };

  // Cache pour les images (max 1500 fichiers)
  static imageCache = {
    files: [],           // Liste des fichiers avec chemins
    lastScan: null,      // Date du dernier scan
    maxFiles: 1500       // Limite de fichiers en cache
  };

  // Configuration des sources disponibles
  static SOURCES = {
    'daggerheart-en': {
      id: 'daggerheart-en',
      name: 'Daggerheart LdB Anglais',
      targetSystems: ['daggerheart', 'daggerheart-unofficial'],
      parser: 'parseDaggerheartEN'
    },
    'daggerheart-fr': {
      id: 'daggerheart-fr',
      name: 'Daggerheart demo FR',
      targetSystems: ['daggerheart', 'daggerheart-unofficial'],
      parser: 'parseDaggerheartFR'
    },
    'fabula-ultima-fr': {
      id: 'fabula-ultima-fr',
      name: 'Fabula Ultima FR LdB',
      targetSystems: ['projectfu'],
      parser: 'parseFabulaUltimaFR'
    }
  };

  // Configuration des systèmes de destination
  static TARGET_SYSTEMS = {
    'daggerheart': {
      id: 'daggerheart',
      name: 'Daggerheart',
      adapter: 'convertToDaggerheart'
    },
    'daggerheart-unofficial': {
      id: 'daggerheart-unofficial',
      name: 'Daggerheart UO',
      adapter: 'convertToDaggerheartUO'
    },
    'projectfu': {
      id: 'projectfu',
      name: 'Project FU',
      adapter: 'convertToProjectFU'
    },
    'other': {
      id: 'other',
      name: 'Autres',
      adapter: 'convertToGeneric'
    }
  };

  static initialize() {
    console.log('Actor Importer | Initializing');

    // Enregistrer les paramètres du module
    this.registerSettings();

    // Ajouter une macro globale pour faciliter l'accès
    Hooks.once('ready', () => {
      console.log('Actor Importer | Ready hook');

      // Créer une macro globale
      if (game.user.isGM) {
        game.ActorImporter = {
          show: () => this.showImportDialog(),
          refreshImageCache: () => this.refreshImageCache(),
          getImageForActor: (name) => this.getImageForActor(name),
          imageCache: this.imageCache  // Pour debug
        };

        console.log('Actor Importer | Available via game.ActorImporter.show()');
        ui.notifications.info('Module Actor Importer chargé. Utilisez game.ActorImporter.show() ou cherchez le bouton Importer.');

        // Initialiser le cache d'images si un chemin est configuré
        const imagePath = game.settings.get(this.ID, 'imagePath');
        if (imagePath) {
          console.log('Actor Importer | Auto-refreshing image cache on ready...');
          this.refreshImageCache();
        }
      }
    });

    this.setupUI();
  }

  static registerSettings() {
    // Sauvegarder la dernière source sélectionnée
    game.settings.register(this.ID, 'lastSource', {
      name: 'Last Source',
      scope: 'world',
      config: false,
      type: String,
      default: 'daggerheart-en'
    });

    // Sauvegarder le dernier système de destination
    game.settings.register(this.ID, 'lastTargetSystem', {
      name: 'Last Target System',
      scope: 'world',
      config: false,
      type: String,
      default: 'daggerheart'
    });

    // Sauvegarder le dernier format d'import
    game.settings.register(this.ID, 'lastFormat', {
      name: 'Last Format',
      scope: 'world',
      config: false,
      type: String,
      default: 'text'
    });

    // Sauvegarder le dernier type d'acteur
    game.settings.register(this.ID, 'lastActorType', {
      name: 'Last Actor Type',
      scope: 'world',
      config: false,
      type: String,
      default: 'npc'
    });

    // Chemin du répertoire d'images
    game.settings.register(this.ID, 'imagePath', {
      name: game.i18n.localize('ACTOR_IMPORTER.Settings.ImagePath.Name'),
      hint: game.i18n.localize('ACTOR_IMPORTER.Settings.ImagePath.Hint'),
      scope: 'world',
      config: true,
      type: String,
      default: ''
    });

    // Seuil commun minimum pour les noms génériques
    game.settings.register(this.ID, 'commonThreshold', {
      name: game.i18n.localize('ACTOR_IMPORTER.Settings.CommonThreshold.Name'),
      hint: game.i18n.localize('ACTOR_IMPORTER.Settings.CommonThreshold.Hint'),
      scope: 'world',
      config: true,
      type: Number,
      default: 2,
      range: {
        min: 1,
        max: 10,
        step: 1
      }
    });
  }

  /**
   * Scanner le répertoire d'images et mettre en cache les fichiers trouvés
   * @returns {Promise<void>}
   */
  static async refreshImageCache() {
    const imagePath = game.settings.get(this.ID, 'imagePath');
    if (!imagePath) {
      console.log('Actor Importer | No image path configured, skipping cache refresh');
      return;
    }

    console.log('Actor Importer | Refreshing image cache from:', imagePath);

    try {
      // Utiliser l'API FilePicker de Foundry pour parcourir le répertoire
      const result = await this.scanDirectory(imagePath);

      // Limiter à maxFiles fichiers
      this.imageCache.files = result.slice(0, this.imageCache.maxFiles);
      this.imageCache.lastScan = Date.now();

      console.log(`Actor Importer | Image cache refreshed: ${this.imageCache.files.length} files found`);
    } catch (error) {
      console.error('Actor Importer | Error refreshing image cache:', error);
      ui.notifications.warn(`Could not scan image directory: ${error.message}`);
    }
  }

  /**
   * Scanner récursivement un répertoire pour trouver toutes les images
   * @param {string} directory - Chemin du répertoire à scanner
   * @param {Array} results - Tableau pour accumuler les résultats
   * @returns {Promise<Array>} Liste des fichiers trouvés
   */
  static async scanDirectory(directory, results = []) {
    try {
      // Utiliser FilePicker.browse pour lister les fichiers
      const browse = await FilePicker.browse('data', directory);

      // Extensions d'images supportées
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

      // Ajouter les fichiers d'images trouvés
      for (const file of browse.files) {
        const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
        if (imageExtensions.includes(ext)) {
          // Extraire le nom du fichier sans extension
          const fileName = file.substring(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
          results.push({
            path: file,
            name: fileName,
            nameNormalized: this.normalizeString(fileName)
          });

          // Arrêter si on atteint la limite
          if (results.length >= this.imageCache.maxFiles) {
            console.warn(`Actor Importer | Image cache limit reached (${this.imageCache.maxFiles})`);
            return results;
          }
        }
      }

      // Scanner récursivement les sous-répertoires
      for (const dir of browse.dirs) {
        if (results.length >= this.imageCache.maxFiles) break;
        await this.scanDirectory(dir, results);
      }

      return results;
    } catch (error) {
      console.error(`Actor Importer | Error scanning directory ${directory}:`, error);
      return results;
    }
  }

  /**
   * Normaliser une chaîne pour la comparaison
   * @param {string} str - Chaîne à normaliser
   * @returns {string} Chaîne normalisée
   */
  static normalizeString(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
      .replace(/[^a-z0-9]/g, ''); // Retirer les caractères spéciaux
  }

  /**
   * Trouver l'image correspondant à un nom d'acteur
   * @param {string} actorName - Nom de l'acteur
   * @returns {Promise<string|null>} Chemin de l'image trouvée ou null
   */
  static async getImageForActor(actorName) {
    // Vérifier que le cache est à jour
    if (!this.imageCache.lastScan) {
      await this.refreshImageCache();
    }

    if (this.imageCache.files.length === 0) {
      return null;
    }

    const normalizedActorName = this.normalizeString(actorName);
    console.log(`Actor Importer | Searching image for actor: "${actorName}" (normalized: "${normalizedActorName}")`);

    // ÉTAPE 1 : Chercher d'abord une correspondance EXACTE
    const exactMatches = this.imageCache.files.filter(file => {
      return file.nameNormalized === normalizedActorName;
    });

    if (exactMatches.length > 0) {
      console.log(`Actor Importer | Exact match found: ${exactMatches[0].path}`);
      return exactMatches[0].path;
    }

    // ÉTAPE 2 : Si pas de correspondance exacte, chercher les correspondances partielles
    const partialMatches = this.imageCache.files.filter(file => {
      return file.nameNormalized.includes(normalizedActorName) ||
             normalizedActorName.includes(file.nameNormalized);
    });

    console.log(`Actor Importer | Found ${partialMatches.length} partial matching images`);

    if (partialMatches.length === 0) {
      return null;
    }

    if (partialMatches.length === 1) {
      console.log(`Actor Importer | Single partial match found: ${partialMatches[0].path}`);
      return partialMatches[0].path;
    }

    // ÉTAPE 3 : Plusieurs correspondances partielles - chercher le nom générique
    const commonThreshold = game.settings.get(this.ID, 'commonThreshold');
    const genericName = this.findGenericName(partialMatches.map(m => m.name), commonThreshold);

    if (genericName) {
      console.log(`Actor Importer | Generic name found: "${genericName}", selecting first match: ${partialMatches[0].path}`);
      // Stocker le nom générique pour référence future si nécessaire
      // Pour l'instant, on retourne simplement la première image
      return partialMatches[0].path;
    }

    // Pas de nom générique valide, retourner la première correspondance partielle
    console.log(`Actor Importer | No generic name found, using first partial match: ${partialMatches[0].path}`);
    return partialMatches[0].path;
  }

  /**
   * Trouver le nom générique basé sur les caractères communs
   * @param {Array<string>} names - Liste des noms à comparer
   * @param {number} threshold - Seuil minimum de caractères communs
   * @returns {string|null} Nom générique trouvé ou null
   */
  static findGenericName(names, threshold) {
    if (names.length < 2) return null;

    // Trouver le préfixe commun le plus long
    let commonPrefix = names[0];
    for (let i = 1; i < names.length; i++) {
      const name = names[i];
      let j = 0;
      while (j < commonPrefix.length && j < name.length && commonPrefix[j] === name[j]) {
        j++;
      }
      commonPrefix = commonPrefix.substring(0, j);

      if (commonPrefix.length < threshold) {
        return null;
      }
    }

    // Vérifier que le préfixe commun respecte le seuil
    if (commonPrefix.length >= threshold) {
      console.log(`Actor Importer | Generic name: "${commonPrefix}" (${commonPrefix.length} chars common)`);
      return commonPrefix;
    }

    return null;
  }

  static setupHooks() {
    Hooks.once('init', () => {
      console.log('Actor Importer | Init hook');
    });

    Hooks.once('ready', () => {
      console.log('Actor Importer | Ready hook');
    });
  }

  static setupUI() {
    // Ajouter un bouton dans la barre d'outils de la sidebar des acteurs
    Hooks.on('renderActorDirectory', (app, html, data) => {
      console.log('Actor Importer | Adding button to Actor Directory');
      
      // Convertir html en élément DOM si nécessaire
      const htmlElement = html instanceof jQuery ? html[0] : html;
      
      // Trouver la barre d'actions dans le header
      let headerActions = htmlElement.querySelector('.header-actions');
      
      if (!headerActions) {
        console.warn('Actor Importer | Header actions not found, trying alternative selector');
        // Alternative pour différentes versions
        const header = htmlElement.querySelector('.directory-header');
        if (header) {
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'header-actions flexrow';
          header.appendChild(actionsDiv);
          headerActions = actionsDiv;
        }
      }
      
      if (headerActions) {
        // Créer le bouton
        const button = document.createElement('button');
        button.className = 'import-actor-btn';
        button.title = 'Importer un acteur';
        button.innerHTML = '<i class="fas fa-file-import"></i> Importer';
        
        // Attacher l'événement click
        button.addEventListener('click', (event) => {
          event.preventDefault();
          this.showImportDialog();
        });
        
        headerActions.appendChild(button);
      }
    });

    // Ajouter au menu contextuel des acteurs (clic droit)
    Hooks.on('getActorDirectoryEntryContext', (html, options) => {
      options.push({
        name: "Importer Acteur",
        icon: '<i class="fas fa-file-import"></i>',
        callback: () => this.showImportDialog(),
        condition: () => game.user.isGM
      });
    });

    // Ajouter un raccourci global dans les contrôles
    // Hooks.on('getSceneControlButtons', (controls) => {
    //   const tokenControls = controls.find(c => c.name === 'token');
    //   if (tokenControls) {
    //     tokenControls.tools.push({
    //       name: 'import-actor',
    //       title: 'Importer un Acteur',
    //       icon: 'fas fa-file-import',
    //       button: true,
    //       onClick: () => this.showImportDialog()
    //     });
    //   }
    // });
  }

  static async showImportDialog() {
    // Détection automatique du système actuel
    const currentSystemId = game.system.id;

    // Charger les derniers choix sauvegardés, avec détection auto pour le système cible
    const lastSource = game.settings.get(this.ID, 'lastSource');
    let lastTargetSystem = game.settings.get(this.ID, 'lastTargetSystem');

    // Si le système actuel est dans la liste des systèmes cibles, le pré-sélectionner
    if (this.TARGET_SYSTEMS[currentSystemId]) {
      lastTargetSystem = currentSystemId;
    }

    const lastFormat = game.settings.get(this.ID, 'lastFormat');
    const lastActorType = game.settings.get(this.ID, 'lastActorType');

    // Générer les options de sources
    const sourceOptions = Object.values(this.SOURCES)
      .map(source => `<option value="${source.id}" ${source.id === lastSource ? 'selected' : ''}>${source.name}</option>`)
      .join('');

    // Générer les options de systèmes de destination
    const targetSystemOptions = Object.values(this.TARGET_SYSTEMS)
      .map(system => `<option value="${system.id}" ${system.id === lastTargetSystem ? 'selected' : ''}>${system.name}</option>`)
      .join('');

    // Créer le contenu HTML directement si le template n'est pas disponible
    const content = `
      <form class="actor-importer-dialog">
        <div class="form-row">
          <div class="form-group">
            <label for="import-source">Source :</label>
            <select id="import-source" name="source">
              ${sourceOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="target-system">Système de destination :</label>
            <select id="target-system" name="targetSystem">
              ${targetSystemOptions}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="import-format">Format d'import :</label>
            <select id="import-format" name="format">
              <option value="text" ${lastFormat === 'text' ? 'selected' : ''}>Texte (Stat Block)</option>
              <option value="csv" ${lastFormat === 'csv' ? 'selected' : ''}>CSV</option>
              <option value="json" ${lastFormat === 'json' ? 'selected' : ''}>JSON</option>
            </select>
          </div>

          <div class="form-group">
            <label for="actor-type">Type d'acteur :</label>
            <select id="actor-type" name="actorType">
              <option value="npc" ${lastActorType === 'npc' ? 'selected' : ''}>PNJ</option>
              <option value="character" ${lastActorType === 'character' ? 'selected' : ''}>Personnage</option>
            </select>
          </div>
        </div>

        <div class="form-group textarea-group">
          <label for="import-text">Données à importer :</label>
          <textarea id="import-text" name="importText" rows="15" placeholder="Collez vos données ici..."></textarea>
        </div>
      </form>
    `;
    
    const dialog = new Dialog({
      title: "Importateur d'Acteurs",
      content: content,
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Importer",
          callback: html => this.processImport(html)
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Annuler"
        }
      },
      default: "import",
      render: html => {
        // Convertir html en élément DOM si c'est jQuery
        const htmlElement = html instanceof jQuery ? html[0] : html;

        // Attendre que le DOM soit complètement rendu
        setTimeout(() => {
          // Trouver la fenêtre de dialogue
          let dialogWindow = htmlElement.closest('.window-app');
          if (!dialogWindow) {
            // Fallback : chercher dans le document
            const allDialogs = document.querySelectorAll('.window-app.dialog');
            for (const dlg of allDialogs) {
              if (dlg.querySelector('.actor-importer-dialog')) {
                dialogWindow = dlg;
                break;
              }
            }
          }

          if (dialogWindow) {
            const buttonsDiv = dialogWindow.querySelector('.dialog-buttons');
            // Vérifier si l'aide n'est pas déjà ajoutée
            if (buttonsDiv && !dialogWindow.querySelector('.actor-importer-help')) {
              // Créer le conteneur d'aide
              const helpContainer = document.createElement('div');
              helpContainer.className = 'actor-importer-help';
              helpContainer.innerHTML = `
                <div id="source-help" class="format-options">
                  <p><strong>Aide spécifique à la source :</strong></p>
                  <div id="source-help-content"></div>
                </div>

                <div id="text-options" class="format-options">
                  <p><strong>Format Texte :</strong> Collez un stat block ou du texte libre.</p>
                  <p>Le parseur détecte automatiquement le format en fonction de la source sélectionnée.</p>
                </div>

                <div id="csv-options" class="format-options" style="display: none;">
                  <p><strong>Format CSV :</strong> Première ligne = en-têtes, deuxième ligne = valeurs.</p>
                  <p>Colonnes supportées : name, hp, stress, evasion, description</p>
                  <p>Exemple : <code>name,hp,stress,description<br>"Gobelin",5,2,"Un petit gobelin vicieux"</code></p>
                </div>

                <div id="json-options" class="format-options" style="display: none;">
                  <p><strong>Format JSON :</strong> JSON d'acteur Foundry VTT complet.</p>
                  <p>Doit contenir au minimum les champs 'name' et 'type'.</p>
                </div>
              `;

              // Insérer AVANT les boutons
              buttonsDiv.insertAdjacentElement('beforebegin', helpContainer);
            }
          }
        }, 50);

        // Fonction pour obtenir la fenêtre de dialogue
        const getDialogWindow = () => {
          let dialogWindow = htmlElement.closest('.window-app');
          if (!dialogWindow) {
            const allDialogs = document.querySelectorAll('.window-app.dialog');
            for (const dlg of allDialogs) {
              if (dlg.querySelector('.actor-importer-dialog')) {
                return dlg;
              }
            }
          }
          return dialogWindow;
        };

        // Fonction pour mettre à jour les systèmes de destination compatibles
        const updateTargetSystems = (sourceId) => {
          const source = this.SOURCES[sourceId];
          const targetSelect = htmlElement.querySelector('#target-system');

          if (source && targetSelect) {
            // Filtrer et afficher uniquement les systèmes compatibles
            Array.from(targetSelect.options).forEach(option => {
              const systemId = option.value;
              if (source.targetSystems.includes(systemId) || systemId === 'other') {
                option.style.display = '';
                option.disabled = false;
              } else {
                option.style.display = 'none';
                option.disabled = true;
              }
            });

            // Vérifier si le système actuellement sélectionné est compatible
            if (!source.targetSystems.includes(targetSelect.value) && targetSelect.value !== 'other') {
              // Sélectionner le premier système compatible
              const firstCompatible = source.targetSystems[0] || 'other';
              targetSelect.value = firstCompatible;
            }
          }

          // Mettre à jour l'aide contextuelle pour la source
          const dialogWindow = getDialogWindow();
          this.updateSourceHelp(dialogWindow || htmlElement, sourceId);
        };

        // Fonction pour mettre à jour l'affichage des options de format
        const updateFormatOptions = (format) => {
          const dialogWindow = getDialogWindow();
          const helpContainer = dialogWindow?.querySelector('.actor-importer-help');
          if (helpContainer) {
            const formatOptions = helpContainer.querySelectorAll('#text-options, #csv-options, #json-options');
            formatOptions.forEach(option => option.style.display = 'none');

            const selectedOption = helpContainer.querySelector(`#${format}-options`);
            if (selectedOption) {
              selectedOption.style.display = 'block';
            }
          }
        };

        // Fonction pour sauvegarder les choix actuels
        const saveCurrentChoices = async () => {
          const sourceSelect = htmlElement.querySelector('#import-source');
          const targetSelect = htmlElement.querySelector('#target-system');
          const formatSelect = htmlElement.querySelector('#import-format');
          const actorTypeSelect = htmlElement.querySelector('#actor-type');

          if (sourceSelect) await game.settings.set(this.ID, 'lastSource', sourceSelect.value);
          if (targetSelect) await game.settings.set(this.ID, 'lastTargetSystem', targetSelect.value);
          if (formatSelect) await game.settings.set(this.ID, 'lastFormat', formatSelect.value);
          if (actorTypeSelect) await game.settings.set(this.ID, 'lastActorType', actorTypeSelect.value);
        };

        // Initialiser et gérer les événements (avec timeout pour s'assurer que l'aide est présente)
        setTimeout(() => {
          // Gérer les changements de source
          const sourceSelect = htmlElement.querySelector('#import-source');
          if (sourceSelect) {
            // Initialiser avec la source actuelle
            updateTargetSystems(sourceSelect.value);

            sourceSelect.addEventListener('change', function() {
              updateTargetSystems(this.value);
              saveCurrentChoices();
            });
          }

          // Gérer les changements de système de destination
          const targetSelect = htmlElement.querySelector('#target-system');
          if (targetSelect) {
            targetSelect.addEventListener('change', function() {
              saveCurrentChoices();
            });
          }

          // Gérer les changements de format
          const formatSelect = htmlElement.querySelector('#import-format');
          if (formatSelect) {
            // Initialiser avec le format actuel
            updateFormatOptions(formatSelect.value);

            formatSelect.addEventListener('change', function() {
              updateFormatOptions(this.value);
              saveCurrentChoices();
            });
          }

          // Gérer les changements de type d'acteur
          const actorTypeSelect = htmlElement.querySelector('#actor-type');
          if (actorTypeSelect) {
            actorTypeSelect.addEventListener('change', function() {
              saveCurrentChoices();
            });
          }
        }, 100);
      }
    }, {
      width: 730,
      height: 750,
      resizable: true,
      classes: ['actor-importer-window']
    });

    dialog.render(true);
  }

  static updateSourceHelp(htmlElement, sourceId) {
    const helpContent = htmlElement.querySelector('#source-help-content');
    if (!helpContent) return;

    // Aide contextuelle selon la source
    const helpTexts = {
      'daggerheart-en': `
        <p>Format attendu : Stat block Daggerheart anglais</p>
        <p>Supporte les formats standard et "Incredible Creatures"</p>
        <p>Exemple (format standard) :</p>
        <code style="display: block; white-space: pre; font-size: 11px;">
Goblin Scout Tier 1
Difficulty: 12  Thresholds: 8/15
HP: 5  Stress: 2
ATK: +3 | Claws: Very Close | 1d8 phy
FEATURES
Sneaky - Passive: +2 to Hide checks
        </code>
        <p>Exemple (format Incredible Creatures) :</p>
        <code style="display: block; white-space: pre; font-size: 11px;">
HEDGE WIZARD
Tier 1 Social
A mystic who has learned the ways...
Motives & Tactics: Live away from others
Difficulty: 11 | Thresholds: 8/12 | HP: 3 | Stress: 3
ATK: –2 | Staff: Far | 1d6+1 mag
Experience: Ancestral Wisdom +2, Herbology +2
FEATURES
Dubious Dealings - Passive: Description...
Hex - Action: Description...
        </code>
      `,
      'daggerheart-fr': `
        <p>Format attendu : Stat block Daggerheart français</p>
        <p>Exemple :</p>
        <code style="display: block; white-space: pre; font-size: 11px;">
Éclaireur Gobelin Niveau 1
Difficulté: 12  Seuils: 8/15
PV: 5  Stress: 2
Attaque: +3 | Griffes: Très Proche | 1d8 phy
CAPACITÉS
Furtif - Passif: +2 aux jets de Discrétion
        </code>
      `,
      'fabula-ultima-fr': `
        <p>Format attendu : Bloc de statistiques Fabula Ultima (français)</p>
        <p>À venir : Parser pour Fabula Ultima</p>
      `
    };

    helpContent.innerHTML = helpTexts[sourceId] || '<p>Sélectionnez une source pour voir l\'aide.</p>';
  }

  static async processImport(html) {
    const sourceId = html.find('#import-source').val();
    const targetSystemId = html.find('#target-system').val();
    const format = html.find('#import-format').val();
    const actorType = html.find('#actor-type').val();
    const inputText = html.find('#import-text').val().trim();

    if (!inputText) {
      ui.notifications.warn("Veuillez entrer du texte à importer.");
      return;
    }

    // Les choix sont déjà sauvegardés automatiquement via les événements onChange

    try {
      let intermediateData;

      // Phase 1 : Parser selon la source et le format
      switch (format) {
        case 'text':
          intermediateData = await this.parseTextBySource(inputText, sourceId, actorType);
          break;
        case 'csv':
          intermediateData = await this.parseCSVFormat(inputText, actorType);
          break;
        case 'json':
          intermediateData = await this.parseJSONFormat(inputText);
          break;
        default:
          throw new Error("Format non supporté");
      }

      if (!intermediateData) {
        throw new Error("Échec du parsing des données");
      }

      // Phase 2 : Convertir vers le système de destination
      let actorData;
      if (format === 'json') {
        // Le JSON bypasse la conversion (format direct Foundry)
        actorData = intermediateData;
      } else {
        actorData = await this.convertToTargetSystem(intermediateData, targetSystemId);
      }

      if (actorData) {
        // Phase 3 : Rechercher une image correspondante
        const imagePath = await this.getImageForActor(actorData.name);
        if (imagePath) {
          console.log(`Actor Importer | Image found for "${actorData.name}": ${imagePath}`);
          actorData.img = imagePath;
          // Également définir le token image si non défini
          if (!actorData.prototypeToken) {
            actorData.prototypeToken = {};
          }
          if (!actorData.prototypeToken.texture) {
            actorData.prototypeToken.texture = { src: imagePath };
          } else if (!actorData.prototypeToken.texture.src) {
            actorData.prototypeToken.texture.src = imagePath;
          }
        } else {
          console.log(`Actor Importer | No image found for "${actorData.name}"`);
        }

        console.warn('Actor Importer | ========================================');
        console.warn('Actor Importer | Données acteur à créer (stringifié):');
        console.warn(JSON.stringify(actorData, null, 2));
        console.warn('Actor Importer | Données acteur à créer (objet):');
        console.warn(actorData);
        console.warn('Actor Importer | ========================================');

        let actor;
        try {
          console.warn('Actor Importer | Appel de Actor.create()...');
          actor = await Actor.create(actorData);
          console.warn('Actor Importer | Actor.create() terminé, résultat:', actor);
        } catch (createError) {
          console.warn('Actor Importer | ERREUR lors de Actor.create():');
          console.warn('Actor Importer | Message:', createError.message);
          console.warn('Actor Importer | Stack:', createError.stack);
          console.warn('Actor Importer | Erreur complète:', createError);
          throw new Error(`Échec de Actor.create(): ${createError.message}`);
        }

        if (!actor) {
          throw new Error("La création de l'acteur a échoué - Actor.create a retourné null");
        }

        ui.notifications.info(`Acteur "${actor.name}" importé avec succès !`);

        // Ouvrir la feuille de l'acteur créé
        actor.sheet.render(true);
      } else {
        throw new Error("Les données de l'acteur sont invalides ou vides");
      }
    } catch (error) {
      console.warn('=== Actor Importer | ERREUR ===');
      console.warn('Message:', error.message);
      console.warn('Stack trace:', error.stack);
      console.warn('Erreur complète:', error);
      console.warn('================================');
      ui.notifications.error(`Erreur lors de l'import: ${error.message}`);
    }
  }

  static async parseTextBySource(text, sourceId, actorType) {
    const source = this.SOURCES[sourceId];
    if (!source) {
      console.log(`Source inconnue: ${sourceId}`);
      throw new Error(`Source inconnue: ${sourceId}`);
    }

    console.log(`Parser sélectionné: ${sourceId} pour actorType: ${actorType}`);

    // Router vers le parser approprié selon la source
    switch (sourceId) {
      case 'daggerheart-en':
        return this.parseDaggerheartEN(text, actorType);
      case 'daggerheart-fr':
        return this.parseDaggerheartFR(text, actorType);
      case 'fabula-ultima-fr':
        return this.parseFabulaUltimaFR(text, actorType);
      default:
        console.log(`Parser non implémenté pour la source: ${sourceId}`);
        throw new Error(`Parser non implémenté pour la source: ${sourceId}`);
    }
  }

  static async convertToTargetSystem(intermediateData, targetSystemId) {
    const targetSystem = this.TARGET_SYSTEMS[targetSystemId];
    if (!targetSystem) {
      console.log(`Système de destination inconnu: ${targetSystemId}`);
      throw new Error(`Système de destination inconnu: ${targetSystemId}`);
    }

    console.log(`Converter sélectionné: ${targetSystemId}`);
    console.log('Données intermédiaires à convertir:', intermediateData);

    // Créer le converter approprié selon le système cible
    let converter;
    switch (targetSystemId) {
      case 'daggerheart':
        converter = new DaggerheartConverter(intermediateData);
        break;
      case 'daggerheart-unofficial':
        converter = new DaggerheartUnofficialConverter(intermediateData);
        break;
      case 'projectfu':
        converter = new ProjectFUConverter(intermediateData);
        break;
      case 'other':
        converter = new BaseConverter(intermediateData);
        break;
      default:
        console.log(`Convertisseur non implémenté pour le système: ${targetSystemId}`);
        throw new Error(`Convertisseur non implémenté pour le système: ${targetSystemId}`);
    }

    return converter.convert();
  }

  // Parsers pour chaque source (ancienne parseTextFormat devenue parseDaggerheartEN/FR)
  static async parseDaggerheartEN(text, actorType) {
    // Parser pour Daggerheart anglais
    return this.parseDaggerheartStatBlock(text, actorType);
  }

  static async parseDaggerheartFR(text, actorType) {
    // Parser pour Daggerheart français (même logique, patterns bilingues déjà présents)
    return this.parseDaggerheartStatBlock(text, actorType);
  }

  static async parseFabulaUltimaFR(text, actorType) {
    console.log("=== Fabula Ultima Parser - Début ===");
    console.log("Texte reçu:", text);

    // Format intermédiaire NEUTRE - conserve les données en FRANÇAIS
    const intermediate = {
      name: "",
      type: actorType || "npc",
      level: 5,
      hp: { value: 0, max: 40, bonus: 0 },
      mp: { value: 0, max: 40, bonus: 0 },
      attributes: {
        // Noms d'attributs FR conservés
        dex: { base: 8 },
        int: { base: 8 },  // INT (pas INS)
        pui: { base: 8 },  // PUI (pas MIG)
        vol: { base: 8 }   // VOL (pas WLP)
      },
      affinities: {
        // Affinités en FRANÇAIS (noms des types d'éléments)
        physiques: { base: 0 },
        air: { base: 0 },
        foudre: { base: 0 },
        ténèbres: { base: 0 },
        terre: { base: 0 },
        feu: { base: 0 },
        glace: { base: 0 },
        lumière: { base: 0 },
        poison: { base: 0 }
      },
      def: 0,
      mdef: 0,
      init: 0,
      species: "",  // Espèce en FRANÇAIS ("bête", "humanoïde")
      traits: "",   // Traits en FRANÇAIS
      description: "",  // Description en FRANÇAIS
      items: []
    };

    const lines = text.split('\n');
    console.log("Nombre de lignes:", lines.length);

    // Extraire le nom et niveau (ex: "CHAUVE-SOURIS VAMPIRE Niv. 5 w BÊTE")
    const nameMatch = lines.find(l => /Niv\.\s*\d+/.test(l));
    if (nameMatch) {
      console.log("Ligne nom trouvée:", nameMatch);
      const match = nameMatch.match(/^(.+?)\s+Niv\.\s*(\d+)\s+\w+\s+(.+?)$/);
      if (match) {
        intermediate.name = match[1].trim();
        intermediate.level = parseInt(match[2]);
        // Garder l'espèce en FRANÇAIS
        intermediate.species = match[3].trim().toLowerCase();

        console.log("Nom:", intermediate.name);
        console.log("Niveau:", intermediate.level);
        console.log("Espèce (FR):", intermediate.species);
      } else {
        console.warn("⚠️ Pattern de nom/niveau ne correspond pas:", nameMatch);
      }
    } else {
      console.warn("⚠️ Aucune ligne avec 'Niv.' trouvée");
    }

    // Extraire les attributs (ex: "DEX d10 INT d8 PUI d6 VOL d8 PV 50 w 25 PM 45 Init. 9")
    const attrLine = lines.find(l => /DEX\s+d\d+.*INT\s+d\d+.*PUI\s+d\d+.*VOL\s+d\d+/i.test(l));
    if (attrLine) {
      console.log("Ligne attributs trouvée:", attrLine);
      const dexMatch = attrLine.match(/DEX\s+d(\d+)/i);
      const intMatch = attrLine.match(/INT\s+d(\d+)/i);
      const puiMatch = attrLine.match(/PUI\s+d(\d+)/i);
      const volMatch = attrLine.match(/VOL\s+d(\d+)/i);
      // PV: capturer le premier nombre après PV (avant le "w" de crise)
      // Format: "PV 50 w 25" où 50 = max, 25 = seuil de crise (ignoré)
      const pvMatch = attrLine.match(/PV\s+(\d+)\s+w/i);
      // PM: capturer le premier nombre après PM
      const pmMatch = attrLine.match(/PM\s+(\d+)/i);
      const initMatch = attrLine.match(/Init\.\s+(\d+)/i);

      if (dexMatch) intermediate.attributes.dex.base = parseInt(dexMatch[1]);
      if (intMatch) intermediate.attributes.int.base = parseInt(intMatch[1]);
      if (puiMatch) intermediate.attributes.pui.base = parseInt(puiMatch[1]);
      if (volMatch) intermediate.attributes.vol.base = parseInt(volMatch[1]);
      if (pvMatch) {
        const hpMax = parseInt(pvMatch[1]);
        intermediate.hp.max = hpMax;
        intermediate.hp.value = hpMax; // PV actuels = PV max (pleine santé)

        // Calculer le bonus HP : HP_texte - [(5 × PUI) + (2 × niveau)]
        const hpBase = (5 * intermediate.attributes.pui.base) + (2 * intermediate.level);
        intermediate.hp.bonus = hpMax - hpBase;

        console.log("PV extrait:", pvMatch[1], "→ max =", hpMax, ", value =", hpMax);
        console.log("  Calcul: base = (5×PUI:" + intermediate.attributes.pui.base + ") + (2×Niv:" + intermediate.level + ") = " + hpBase + ", bonus =", intermediate.hp.bonus);
      }
      if (pmMatch) {
        const mpMax = parseInt(pmMatch[1]);
        intermediate.mp.max = mpMax;
        intermediate.mp.value = mpMax; // PM actuels = PM max (pleine santé)

        // Calculer le bonus MP : MP_texte - [(5 × VOL) + (2 × niveau)]
        const mpBase = (5 * intermediate.attributes.vol.base) + (2 * intermediate.level);
        intermediate.mp.bonus = mpMax - mpBase;

        console.log("PM extrait:", pmMatch[1], "→ max =", mpMax, ", value =", mpMax);
        console.log("  Calcul: base = (5×VOL:" + intermediate.attributes.vol.base + ") + (2×Niv:" + intermediate.level + ") = " + mpBase + ", bonus =", intermediate.mp.bonus);
      }
      if (initMatch) intermediate.init = parseInt(initMatch[1]);

      console.log("Attributs extraits (FR):", intermediate.attributes);
      console.log("HP:", intermediate.hp, "MP:", intermediate.mp, "Init:", intermediate.init);
    } else {
      console.warn("⚠️ Aucune ligne d'attributs trouvée");
    }

    // Extraire les défenses et affinités (ex: "DEF +0 DEF M. +0 ' a VU b a E RS f i l b RS")
    const defLine = lines.find(l => /DEF\s+[+\-]?\d+.*DEF\s+M\./i.test(l));
    if (defLine) {
      console.log("Ligne défenses trouvée:", defLine);
      const defMatch = defLine.match(/DEF\s+([+\-]?\d+)/i);
      const mdefMatch = defLine.match(/DEF\s+M\.\s+([+\-]?\d+)/i);

      if (defMatch) intermediate.def = parseInt(defMatch[1]);
      if (mdefMatch) intermediate.mdef = parseInt(mdefMatch[1]);

      console.log("DEF:", intermediate.def, "MDEF:", intermediate.mdef);

      // Extraire les affinités après "DEF M. +0"
      const afterDef = defLine.split(/DEF\s+M\.\s+[+\-]?\d+/i)[1];
      if (afterDef) {
        console.log("Texte des affinités:", afterDef);
        const affinities = this.parseFabulaAffinities(afterDef);
        if (affinities) {
          intermediate.affinities = affinities;
          console.log("Affinités extraites:", affinities);
        }
      } else {
        console.warn("⚠️ Aucun texte d'affinités trouvé après DEF M.");
      }
    } else {
      console.warn("⚠️ Aucune ligne de défenses trouvée");
    }

    // Extraire la description (toutes les lignes entre le nom et "Traits typiques")
    if (nameMatch) {
      const nameIndex = lines.indexOf(nameMatch);
      const traitsLine = lines.find(l => /Traits typiques\s*:/i.test(l));
      const traitsIndex = traitsLine ? lines.indexOf(traitsLine) : -1;

      if (nameIndex >= 0) {
        const descriptionLines = [];
        // Parcourir les lignes après le nom jusqu'à "Traits typiques"
        for (let i = nameIndex + 1; i < lines.length; i++) {
          // Arrêter si on atteint "Traits typiques" ou une ligne d'attributs
          if (traitsIndex >= 0 && i >= traitsIndex) break;
          if (/Traits typiques\s*:/i.test(lines[i])) break;
          if (/DEX\s+d\d+/i.test(lines[i])) break;

          const line = lines[i].trim();
          if (line) {
            descriptionLines.push(line);
          }
        }

        intermediate.description = descriptionLines.join(' ');
        console.log("Description (lignes", nameIndex + 1, "à", nameIndex + descriptionLines.length + "):", intermediate.description);
      }
    }

    // Extraire les traits typiques
    const traitsLine = lines.find(l => /Traits typiques\s*:/i.test(l));
    if (traitsLine) {
      console.log("Ligne traits trouvée:", traitsLine);
      const match = traitsLine.match(/Traits typiques\s*:\s*(.+)/i);
      if (match) {
        intermediate.traits = match[1].trim();
        console.log("Traits:", intermediate.traits);
      }
    } else {
      console.warn("⚠️ Aucune ligne de traits trouvée");
    }

    // Parser les items (attaques et règles spéciales)
    intermediate.items = this.parseFabulaItems(lines, intermediate.level);

    console.log("=== Données intermédiaires finales ===");
    console.log(intermediate);
    console.log("=== Fabula Ultima Parser - Fin ===");

    return intermediate;
  }

  /**
   * Parse les items (attaques et règles spéciales) depuis le texte Fabula Ultima
   * @param {Array} lines - Lignes du texte
   * @param {number} level - Niveau du personnage
   * @returns {Array} Liste des items parsés
   */
  static parseFabulaItems(lines, level) {
    console.log("  >> parseFabulaItems - début");
    const items = [];

    // PAS de traduction - garder les données en FRANÇAIS

    // Trouver l'index de "ATTAQUES DE BASE"
    const attacksIndex = lines.findIndex(l => /ATTAQUES DE BASE/i.test(l));
    // Trouver l'index de "RÈGLES SPÉCIALES"
    const rulesIndex = lines.findIndex(l => /R[ÈE]GLES SP[ÉE]CIALES/i.test(l));

    // Parser les attaques de base
    if (attacksIndex >= 0) {
      console.log("  >> Section ATTAQUES DE BASE trouvée à la ligne", attacksIndex);
      const endIndex = rulesIndex >= 0 ? rulesIndex : lines.length;

      // Joindre les lignes de la section ATTAQUES pour gérer les attaques multi-lignes
      let attackText = '';
      for (let i = attacksIndex + 1; i < endIndex; i++) {
        attackText += lines[i] + ' ';
      }

      // Split par les symboles $ et a qui marquent le début d'une attaque
      const attackBlocks = attackText.split(/(?=[$a]\s+)/);

      for (const block of attackBlocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock || trimmedBlock.length < 5) continue;

        // Attaque : $ (mêlée) ou a (distance) suivi du nom
        // Pattern pour capturer le type de dégâts : "physiques", "d'air", "de poison", etc.
        const attackMatch = trimmedBlock.match(/^([$a])\s+(.+?)\s+w【\s*(.+?)\s*】\s+w【\s*VH\s*\+\s*(\d+)\s*】\s+dégâts\s+(d'[\wéèàù]+|de\s+[\wéèàù]+|[\wéèàù]+)\.?\s*(.*)/i);
        if (attackMatch) {
          const [, symbol, name, attributes, damage, damageTypeFR, description] = attackMatch;
          const type = symbol === '$' ? 'melee' : 'ranged';

          // PAS de traduction - garder le type de dégâts en FRANÇAIS
          const damageType = damageTypeFR.trim();

          console.log("  >> Type de dégâts (FR):", `"${damageType}"`);

          // Parser les attributs (ex: "DEX + DEX" ou "DEX + VOL")
          // PAS de traduction - garder les noms FR (dex, int, pui, vol)
          const attrParts = attributes.split('+').map(a => a.trim().toLowerCase());
          const primary = attrParts[0] || 'dex';
          const secondary = attrParts[1] || 'dex';

          const item = {
            name: name.trim(),
            type: 'basic',
            system: {
              type: { value: type },
              damageType: { value: damageType },  // FRANÇAIS : "physiques", "d'air", etc.
              damage: { value: parseInt(damage) || 0 },
              attributes: {
                primary: { value: primary },    // FRANÇAIS : "dex", "pui", "vol"
                secondary: { value: secondary }  // FRANÇAIS : "dex", "pui", "vol"
              },
              summary: { value: description.trim() },  // FRANÇAIS
              description: description.trim()          // FRANÇAIS
            }
          };

          console.log("  >> Attaque parsée (FR):", item.name, `(${type}, ${damageType}, ${primary}+${secondary})`);
          items.push(item);
        } else {
          console.warn("  ⚠️ Bloc d'attaque non reconnu:", trimmedBlock.substring(0, 50) + "...");
        }
      }
    } else {
      console.warn("  ⚠️ Section ATTAQUES DE BASE non trouvée");
    }

    // Parser les règles spéciales
    if (rulesIndex >= 0) {
      console.log("  >> Section RÈGLES SPÉCIALES trouvée à la ligne", rulesIndex);

      for (let i = rulesIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Arrêter si on rencontre une nouvelle créature
        if (/Niv\.\s*\d+/.test(line)) break;

        // Règle : Nom w Description
        const ruleMatch = line.match(/^(.+?)\s+w\s+(.+)$/i);
        if (ruleMatch) {
          const [, name, description] = ruleMatch;

          const item = {
            name: name.trim(),
            type: 'rule',
            system: {
              summary: { value: description.trim() },
              description: description.trim()
            }
          };

          console.log("  >> Règle parsée:", item.name);
          items.push(item);
        }
      }
    } else {
      console.warn("  ⚠️ Section RÈGLES SPÉCIALES non trouvée");
    }

    console.log("  >> parseFabulaItems - fin,", items.length, "items trouvés");
    return items;
  }

  /**
   * Parse les affinités depuis le texte Fabula Ultima
   * Format: ' a VU b a E RS f i l b RS
   * Les symboles (', a, b, E, f, i, l) représentent les affinités dans l'ordre
   * Les valeurs (VU, RS, IM, AB) qui suivent un symbole donnent la valeur de cette affinité
   * Ordre: physiques, air, foudre, ténèbres, terre, feu, glace, lumière, poison
   * Codage: VU=-1, RS=1, IM=2, AB=3
   */
  static parseFabulaAffinities(text) {
    console.log("  >> parseFabulaAffinities - début");
    console.log("  >> Texte brut:", text);

    // Affinités en FRANÇAIS - utiliser les noms français comme clés
    const affinities = {
      physiques: { base: 0 },
      air: { base: 0 },
      foudre: { base: 0 },
      ténèbres: { base: 0 },
      terre: { base: 0 },
      feu: { base: 0 },
      glace: { base: 0 },
      lumière: { base: 0 },
      poison: { base: 0 }
    };

    // Ordre des affinités selon le codage du PDF
    const affinityOrder = ['physiques', 'air', 'foudre', 'ténèbres', 'terre', 'feu', 'glace', 'lumière', 'poison'];

    // Mapping des valeurs textuelles vers numériques
    const valueMap = {
      'VU': -1,  // Vulnérable
      'RS': 1,   // Résistance
      'IM': 2,   // Immunité
      'AB': 3    // Absorption
    };

    // Nettoyer le texte et extraire les codes/valeurs
    const cleaned = text.trim();
    const tokens = cleaned.split(/\s+/);
    console.log("  >> Tokens:", tokens);

    let affinityIndex = 0;

    // Parcourir les tokens pour trouver les symboles d'affinité
    let i = 0;
    while (i < tokens.length && affinityIndex < affinityOrder.length) {
      const token = tokens[i];

      // Détecter les symboles de codage (lettres simples comme ', a, b, E, f, i, l)
      // qui représentent une affinité dans l'ordre
      if (token.length === 1 && /[a-zA-Z']/.test(token)) {
        // C'est un symbole d'affinité
        const affinityName = affinityOrder[affinityIndex];

        // Valeur par défaut = 0 (pas d'affinité)
        let value = 0;

        // Vérifier si le token suivant est une valeur (VU, RS, IM, AB)
        if (i + 1 < tokens.length && valueMap[tokens[i + 1]]) {
          value = valueMap[tokens[i + 1]];
          console.log(`  >> Token[${i}]: "${token}" = ${affinityName} → valeur "${tokens[i + 1]}" = ${value}`);
          i++; // Sauter le token de valeur car on l'a déjà traité
        } else {
          console.log(`  >> Token[${i}]: "${token}" = ${affinityName} → pas de valeur, défaut = 0`);
        }

        // Assigner la valeur à l'affinité
        affinities[affinityName].base = value;
        affinityIndex++;
      } else if (valueMap[token]) {
        // C'est une valeur sans symbole avant (erreur de format)
        console.warn(`  ⚠️ Token[${i}]: "${token}" est une valeur sans symbole d'affinité, ignoré`);
      } else {
        // Token non reconnu
        console.log(`  >> Token[${i}]: "${token}" - non reconnu, ignoré`);
      }

      i++;
    }

    if (affinityIndex < affinityOrder.length) {
      console.warn(`  ⚠️ Seulement ${affinityIndex} affinités trouvées sur ${affinityOrder.length} attendues`);
    }

    console.log("  >> Affinités finales:", affinities);
    console.log("  >> parseFabulaAffinities - fin");
    return affinities;
  }

  // Convertisseurs déplacés vers /scripts/converters/
  // Les anciennes méthodes de conversion ont été remplacées par des classes
  // Voir: base-converter.js, daggerheart-converter.js, daggerheart-unofficial-converter.js, projectfu-converter.js

  static isDaggerheartStatBlock(text) {
    const indicators = [
      /(Tier|Niveau)\s+\w+/i,
      /Diffi?(culty|culté):/i,
      /(Thresholds|seuils):/i,
      /ATK\s*:\s*[+\-]?\d+/i,
      /(Earth|Spit|Acid|Tremor)/i,
      /Very Close|Close|Far/i
    ];
    
    return indicators.some(pattern => pattern.test(text));
  }

  // Dictionnaire de traduction pour les patterns multilingues
  static PATTERNS = {
    // Tier/Niveau
    tier: /(Tier|Niveau)\s+/i,
    
    // Motives & Tactics
    motives: /(?:Motives?\s*(?:&|et)\s*Tactics?|Motivations?\s*(?:&|et)\s*Tactiques?)\s*:\s*/i,
    
    // Difficulty
    difficulty: /Diffi\s?(culty|culté)\s*:\s*/i,
    
    // Thresholds
    thresholds: /(?:Thresholds?|Seuils?)\s*:\s*/i,
    thresholdsPlus :  /(?:Thresholds?|Seuils?)\s*:\s*(\d+)\s*\/\s*(\d+)/,

    
    // HP
    hp: /(?:HP|PV)\s*:\s*(\d+)/i,
    
    // Stress
    stress: /(?:Stress|Tension)\s*:\s*(\d+)/i,
    
    // ATK/Attack
    attack: /(?:ATK|Attack|Attaque)\s*:\s*/i,
    
    // Experience/Expérience
    experience: /(?:Experience|Expérience)\s*:\s*/i,
    
    // Features/Capacités
    features: /^(?:FEATURES|CAPACITÉS|POUVOIRS|CARACTÉRISTIQUES)$/i,
    
    // Action types
    actionTypes: /(?:Action|Reaction|Passive|Réaction|Passif)\s*:\s*/i
  };

  static parseDaggerheartStatBlock(text, actorType) {
    console.log("=== Daggerheart Parser - Début ===");
    console.log("Texte reçu:", text);

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Format intermédiaire NEUTRE - conserve les données en langue SOURCE
    const intermediate = {
      name: lines[0] || "Acteur Importé",
      type: actorType || "npc",
      tier: 1,
      creatureType: "",  // Type de créature (ex: "Skulk", "Bruiser", etc.)
      difficulty: 14,
      thresholds: { major: 8, severe: 15 },
      health: { value: 0, max: 8 },
      stress: { value: 0, max: 3 },
      attacks: [],
      experiences: [],
      features: [],
      biography: ""
    };

    let currentSection = null;
    let currentFeature = null;
    let biographyLines = [];
    let inBiographySection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Nom de l'acteur (première ligne)
      if (i === 0) {
        // Si la ligne contient Tier/Niveau, extraire tout ce qui précède
        const tierMatch = line.match(/(.*?)\s+(Tier|Niveau)\s+/i);
        if (tierMatch) {
          // Tier sur la même ligne → extraire le nom et continuer le traitement
          intermediate.name = tierMatch[1].trim();
        } else {
          // Pas de Tier sur cette ligne → prendre toute la ligne comme nom et passer à la suivante
          intermediate.name = line.trim();
          continue;
        }
      }

      // Détecter le début de la section biographie (après Tier/Niveau)
      if (line.match(this.PATTERNS.tier)) {
        inBiographySection = true;

        // Extraire le numéro de tier (1-4) et le type de créature optionnel
        // Format: "Tier 1" ou "Tier 1 Skulk" (Incredible Creatures)
        const tierMatch = line.match(/(Tier|Niveau)\s+(\d+|[I]{1,4})(?:\s+(.+))?/i);
        if (tierMatch) {
          const tierValue = tierMatch[2];
          // Convertir chiffres romains ou numériques en nombre
          if (tierValue === 'I') intermediate.tier = 1;
          else if (tierValue === 'II') intermediate.tier = 2;
          else if (tierValue === 'III') intermediate.tier = 3;
          else if (tierValue === 'IV') intermediate.tier = 4;
          else intermediate.tier = parseInt(tierValue) || 1;
          console.log("  >> Tier extrait:", intermediate.tier);

          // Extraire le type de créature si présent (ex: "Skulk", "Bruiser")
          if (tierMatch[3]) {
            intermediate.creatureType = tierMatch[3].trim();
            console.log("  >> Type de créature:", intermediate.creatureType);
          }
        }

        // Ajouter cette ligne à la biographie si elle contient plus que juste le tier
        let afterTier = line;
        // Gérer les codes unicode spéciaux pour les tiers (58689-58692 = tiers 1-4)
        if (line.charCodeAt(5) == 58689) {
          afterTier = line.slice(0, 5) + '1' + line.slice(6);
        } else if (line.charCodeAt(5) == 58690) {
          afterTier = line.slice(0, 5) + '2' + line.slice(6);
        } else if (line.charCodeAt(5) == 58691) {
          afterTier = line.slice(0, 5) + '3' + line.slice(6);
        } else if (line.charCodeAt(5) == 58692) {
          afterTier = line.slice(0, 5) + '4' + line.slice(6);
        }
        if (afterTier) {
          console.log("  >> Tier trouvé et son code:", afterTier, afterTier.charCodeAt(5));
          biographyLines.push(afterTier);
        }
        continue;
      }

      // Arrêter la section biographie avant Difficulty ou Motives
      if (line.match(this.PATTERNS.difficulty) || line.match(this.PATTERNS.motives)) {
        inBiographySection = false;
        // Traiter la ligne Motives & Tactics
        if (line.match(this.PATTERNS.motives)) {
          const tactics = line.replace(this.PATTERNS.motives, '').trim();
          biographyLines.push(`<strong>Motives & Tactics:</strong> ${tactics}`);
        }
        // Ne pas continuer ici, laisser les autres patterns traiter la ligne
      }

      // Collecter les lignes de biographie
      if (inBiographySection && !line.match(/Diffi?culty:|Motives & Tactics:/i)) {
        biographyLines.push(line);
        continue;
      }

      // Stats principales - Support pour format condensé (Incredible Creatures) et format séparé (standard)
      // Format condensé: "Difficulty: 12 | Thresholds: 7/12 | HP: 4 | Stress: 3"
      // Format séparé: lignes individuelles pour chaque stat

      // Détecter si c'est le format condensé (stats sur une ligne avec séparateurs |)
      const isCondensedFormat = line.match(/Diffi\s?cult[yé]\s*:.*\|.*(?:Thresholds?|Seuils?)\s*:.*\|/i);

      if (isCondensedFormat) {
        console.log("  >> Format condensé détecté (Incredible Creatures)");

        // Parser tous les stats depuis cette ligne unique
        const difficultyMatch = line.match(/Diffi\s?cult[yé]\s*:\s*(\d+)/i);
        if (difficultyMatch) {
          intermediate.difficulty = parseInt(difficultyMatch[1]);
          console.log("  >> Difficulty:", intermediate.difficulty);
        }

        const thresholdMatch = line.match(/(?:Thresholds?|Seuils?)\s*:\s*(\d+)\s*\/\s*(\d+)/i);
        if (thresholdMatch) {
          intermediate.thresholds.major = parseInt(thresholdMatch[1]);
          intermediate.thresholds.severe = parseInt(thresholdMatch[2]);
          console.log("  >> Thresholds:", intermediate.thresholds);
        }

        const hpMatch = line.match(/(?:HP|PV)\s*:\s*(\d+)/i);
        if (hpMatch) {
          intermediate.health.max = parseInt(hpMatch[1]);
          intermediate.health.value = 0;
          console.log("  >> HP:", intermediate.health.max);
        }

        const stressMatch = line.match(/(?:Stress|Tension)\s*:\s*(\d+)/i);
        if (stressMatch) {
          intermediate.stress.max = parseInt(stressMatch[1]);
          intermediate.stress.value = 0;
          console.log("  >> Stress:", intermediate.stress.max);
        }
        continue;
      }

      // Format standard (lignes séparées)
      const difficultyMatch = line.match(this.PATTERNS.difficulty);
      if (difficultyMatch) {
        const difficultyValue = line.replace(this.PATTERNS.difficulty, '').match(/(\d+)/);
        if (difficultyValue) {
          intermediate.difficulty = parseInt(difficultyValue[1]);
          console.log("  >> Difficulty:", intermediate.difficulty);
        }
      }

      const thresholdMatch = line.match(this.PATTERNS.thresholds);
      if (thresholdMatch) {
        const thresholdValues = line.match(this.PATTERNS.thresholdsPlus);
        if (thresholdValues) {
          intermediate.thresholds.major = parseInt(thresholdValues[1]);
          intermediate.thresholds.severe = parseInt(thresholdValues[2]);
          console.log("  >> Thresholds:", intermediate.thresholds);
        }
      }

      const hpMatch = line.match(this.PATTERNS.hp);
      if (hpMatch) {
        intermediate.health.max = parseInt(hpMatch[1]);
        intermediate.health.value = 0; // Valeur actuelle par défaut
        console.log("  >> HP:", intermediate.health.max);
      }

      const stressMatch = line.match(this.PATTERNS.stress);
      if (stressMatch) {
        intermediate.stress.max = parseInt(stressMatch[1]);
        intermediate.stress.value = 0; // Valeur actuelle par défaut
        console.log("  >> Stress:", intermediate.stress.max);
      }

      // Attaque principale
      const attackMatch = line.match(this.PATTERNS.attack);
      if (attackMatch) {
        const attackData = line.replace(this.PATTERNS.attack, '');
        // Format: "+3 | Claws: Very Close | 1d12+2 phy"
        const attackParts = attackData.match(/([+\-]?\d+)\s*\|\s*([^:]+):\s*([^|]+)\|\s*(.+)/i);
        if (attackParts) {
          const toHit = parseInt(attackParts[1]);
          const name = attackParts[2].trim();
          const range = attackParts[3].trim();
          const damageInfo = attackParts[4].trim();

          // Parser les dégâts "1d12+2 phy"
          const damageMatch = damageInfo.match(/^(\d*d\d+)(?:([+\-]\d+))?\s*(\w+)?/i);
          let damage = "1d8";
          let damageModifier = "";
          let damageType = "";

          if (damageMatch) {
            damage = damageMatch[1];
            damageModifier = damageMatch[2] || "";
            damageType = damageMatch[3] || "";
          }

          // Ajouter l'attaque au format intermédiaire (langue SOURCE conservée)
          intermediate.attacks.push({
            name: name,
            toHit: toHit,
            range: range,           // "Very Close", "Close", "Far" (EN) ou "Très proche" (FR)
            damage: damage,         // "1d12"
            damageModifier: damageModifier,  // "+2" ou ""
            damageType: damageType  // "phy", "mag", etc. (abréviation)
          });

          console.log("  >> Attaque:", intermediate.attacks[intermediate.attacks.length - 1]);
        }
        continue;
      }

      // Experience - Format: "Experience: Nom +valeur" ou "Experience: Nom1 +X, Nom2 +Y"
      // Support pour expériences multiples séparées par des virgules (Incredible Creatures)
      if (line.match(this.PATTERNS.experience)) {
        const expText = line.replace(this.PATTERNS.experience, '').trim();

        // Splitter par virgule pour gérer les expériences multiples
        const expParts = expText.split(',').map(part => part.trim());

        for (const expPart of expParts) {
          // Parser le format "Tremor Sense +2" ou "Nom de l'expérience +X"
          const expMatch = expPart.match(/^(.+?)\s*([+\-]\d+)(.*)$/);
          if (expMatch) {
            intermediate.experiences.push({
              name: expMatch[1].trim(),
              bonus: expMatch[2],  // "+2", "-1", etc.
              description: expMatch[3] ? expMatch[3].trim() : ""
            });
            console.log("  >> Experience:", intermediate.experiences[intermediate.experiences.length - 1]);
          } else if (expPart) {
            // Format alternatif sans bonus numérique
            intermediate.experiences.push({
              name: expPart || "Experience",
              bonus: "+0",
              description: ""
            });
            console.log("  >> Experience (sans bonus):", intermediate.experiences[intermediate.experiences.length - 1]);
          }
        }
        continue;
      }

      // Section FEATURES
      if (line.match(this.PATTERNS.features)) {
        currentSection = 'features';
        continue;
      }

      // Parsing des features
      if (currentSection === 'features') {
        // Nouvelle feature - Format multilingue (garder langue SOURCE)
        const featureMatch = line.match(/^([^-()]+)\s*(?:\((\d+)\))?\s*-\s*(Action|Reaction|Passive|Réaction|Passif)\s*:\s*(.+)/i);
        if (featureMatch) {
          if (currentFeature) {
            intermediate.features.push(currentFeature);
          }

          // GARDER le type d'action en langue SOURCE (pas de traduction)
          const actionType = featureMatch[3]; // "Action", "Reaction", "Passive", "Réaction", "Passif"

          currentFeature = {
            name: featureMatch[1].trim(),
            uses: featureMatch[2] || "",        // Nombre d'utilisations (ex: "3")
            actionType: actionType,             // Type en langue SOURCE
            description: featureMatch[4]        // Description en langue SOURCE
          };

          console.log("  >> Feature:", currentFeature.name, `(${currentFeature.actionType})`);
        }
        // Continuation de la description
        else if (currentFeature && line && !line.match(/^[A-Z\s]+$/)) {
          currentFeature.description += ` ${line}`;
        }
      }
    }

    // Ajouter la dernière feature
    if (currentFeature) {
      intermediate.features.push(currentFeature);
    }

    // Construire la biographie finale
    if (biographyLines.length > 0) {
      intermediate.biography = biographyLines.join('\n');
    }

    console.log("=== Daggerheart Parser - Fin ===");
    console.log("Format intermédiaire:", intermediate);
    return intermediate;
  }


  static async parseCSVFormat(csvText, actorType) {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
      throw new Error("Le CSV doit avoir au moins une ligne d'en-têtes et une ligne de données.");
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const values = lines[1].split(',').map(v => v.trim().replace(/"/g, ''));

    const actorData = {
      name: values[headers.indexOf('name')] || "Acteur CSV",
      type: actorType || "character",
      system: {},
      items: []
    };

    // Mapper les colonnes CSV aux champs système
    headers.forEach((header, index) => {
      const value = values[index];
      if (!value) return;

      switch (header.toLowerCase()) {
        case 'hp':
        case 'health':
          actorData.system.health = { value: 0, min: 0, max: parseInt(value) || 6 };
          break;
        case 'stress':
          actorData.system.stress = { value: 0, min: 0, max: parseInt(value) || 3 };
          break;
        case 'evasion':
        case 'difficulty':
          actorData.system.defenses = {
            evasion: { baseValue: parseInt(value) || 10, value: parseInt(value) || 10 }
          };
          break;
        case 'description':
        case 'biography':
          actorData.system.biography = `<p>${value}</p>`;
          break;
      }
    });

    return actorData;
  }

  static async parseJSONFormat(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      
      // Vérifier que c'est un acteur Foundry valide
      if (!data.name || !data.type) {
        throw new Error("Le JSON doit contenir au minimum 'name' et 'type'.");
      }

      return data;
    } catch (error) {
      throw new Error(`JSON invalide: ${error.message}`);
    }
  }
}

// Initialiser le module
Hooks.once('init', () => {
  ActorImporter.initialize();
});

// Exposer la classe globalement pour le debugging
window.ActorImporter = ActorImporter;
