# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Actor Importer is a universal Foundry VTT module (v13+) that imports actors from various game systems and sources. It features a modular parser architecture that detects source format (e.g., "Daggerheart LdB Anglais", "Fabula Ultima FR LdB") and converts to target system formats (e.g., "Daggerheart", "Project FU").

**Currently Supported:**
- Source formats: Daggerheart (English/French), Fabula Ultima (French)
- Target systems: Daggerheart, Daggerheart UO, Project FU
- Import formats: Text (stat blocks), CSV, JSON

## Architecture

This is a single-file module with no build process. The core logic resides in `scripts/actor-importer.js` which implements:

- **ActorImporter class**: Main singleton that handles all import functionality
- **UI Integration**: Hooks into Foundry's Actor Directory to add import buttons
- **Source Configuration System**: Registry of known source formats with detection patterns
- **Multi-format Parser**: Three specialized parsers (text/CSV/JSON)
- **Target System Adapters**: Converts parsed data to target system schemas

### Key Components

**Dialog System** (`showImportDialog`): Creates inline HTML form with source and target system selectors. Dynamically updates available options and help text based on selections.

**Parser Pipeline** (`processImport`):
1. Reads source format, target system, and raw input text
2. Routes to appropriate source parser based on source selection
3. Converts parsed intermediate data to target system schema
4. Creates actor in Foundry and opens character sheet

**Source Parsers**: Pattern-based parsers for each supported source:
- Daggerheart parsers use `PATTERNS` dictionaries with bilingual support
- Fabula Ultima parser extracts villain/NPC data structures
- Each parser outputs intermediate normalized format

**Target System Adapters**: Convert intermediate data to target schemas:
- Daggerheart adapter: Maps to `system.health`, `system.defenses`, weapons
- Project FU adapter: Maps to FU-specific data structure
- Handles system-specific item types and categories

**Data Structures**:

*Intermediate Format* (source parser output):
- Normalized structure agnostic of target system
- Contains: name, type, stats, attacks, features, biography
- Allows any source to convert to any target system

*Target System Formats*:
- **Daggerheart**: `system.health`, `system.defenses.evasion`, `system["weapon-main"]`
  - Items have `type: "item"` with `system.category` (Action/Reaction/Passive)
- **Project FU**: System-specific structure for Fabula Ultima mechanics
  - Different item structure and stat organization

## File Structure

```
actor-importer/
├── scripts/
│   ├── actor-importer.js    # Main orchestrator and UI
│   └── converters/          # System-specific converters
│       ├── base-converter.js              # Base class (= "Other" system)
│       ├── daggerheart-converter.js       # Daggerheart official
│       ├── daggerheart-unofficial-converter.js  # Daggerheart UO
│       └── projectfu-converter.js         # Project FU (Fabula Ultima)
├── styles/
│   └── actor-importer.css   # Dialog and button styles
├── lang/
│   ├── en.json              # English translations
│   └── fr.json              # French translations + Daggerheart system strings
├── templates/
│   └── import-dialog.html   # Referenced but not used (inline HTML instead)
└── module.json              # Module manifest (uses esmodules)
```

## Source Format Configurations

**Source Registry** (`SOURCES` config):
Each source has:
- `id`: Unique identifier
- `name`: Display name
- `targetSystems`: Compatible target systems
- `parser`: Function that parses text to intermediate format
- `detector`: Auto-detection patterns (optional)

**Daggerheart Sources**:
Detection patterns: Tier/Niveau, Difficulty, Thresholds, ATK format, range keywords

Expected stat block structure:
```
[Name] Tier X
[Biography lines]
Motives & Tactics: [description]
Difficulty: X  Thresholds: X/X
HP: X  Stress: X
ATK: +X | [Weapon Name]: [Range] | [Damage] [Type]
Experience: [Name] +X
FEATURES
[Feature Name] (X) - Action|Reaction|Passive: [Description]
```

**Fabula Ultima Sources**:
Expected structure varies by French sourcebook format - parses villain/NPC blocks with species, level, traits, attacks, and special abilities.

## Important Implementation Details

1. **jQuery/DOM Handling**: Code handles both jQuery objects and native DOM elements with checks like `html instanceof jQuery ? html[0] : html`

2. **Source/Target Separation**: Parser pipeline has two distinct phases:
   - Phase 1: Source parser → intermediate format
   - Phase 2: Target adapter → system-specific structure
   - This allows M×N support (M sources × N targets) with M+N implementations

3. **Unicode Tier Parsing** (Daggerheart): Special handling for unicode characters 58689-58692 representing tier numbers 1-4

4. **Dynamic UI Updates**: Source selector change triggers:
   - Target system dropdown filtering (only compatible systems shown)
   - Help text updates with source-specific instructions
   - Format examples refresh

5. **Global API**: Module exposes `game.ActorImporter.show()` for programmatic access and `window.ActorImporter` for debugging

## Module Integration

- Hooks into `init` to call `ActorImporter.initialize()`
- `renderActorDirectory` hook adds import button to Actor sidebar
- `getActorDirectoryEntryContext` hook adds context menu item
- Only available to GMs (`game.user.isGM` checks)
- System-agnostic: Works with any Foundry system, adapts output to target

## Testing Approaches

Since there's no test framework:
1. Open Foundry VTT (any system)
2. Navigate to Actors tab
3. Use console: `game.ActorImporter.show()`
4. Test source/target combinations:
   - Select source format (e.g., "Daggerheart LdB Anglais")
   - Select target system (e.g., "Daggerheart")
   - Paste sample stat block
   - Verify actor sheet opens with correct data
5. Test cross-system conversion (if applicable)

## Known Issues & Quirks

- Template file (`templates/import-dialog.html`) exists but is unused - dialog uses inline HTML
- French language file contains many Daggerheart system strings unrelated to Actor Importer
- CSV format is generic - doesn't use source/target system logic
- JSON parser requires minimum fields: `name` and `type` - bypasses intermediate format
- Not all source/target combinations may be implemented - check `targetSystems` array in source config

## Adding New Sources or Targets

**New Source Format:**
1. Add entry to `SOURCES` configuration in `actor-importer.js`
2. Create parser method (e.g., `parseFabulaUltimaFR()`)
3. Parser should return intermediate format object
4. Add detection patterns for auto-identification (optional)
5. Update language files with source-specific help text in `updateSourceHelp()`

**New Target System:**
1. Create new converter class in `scripts/converters/` (e.g., `mysystem-converter.js`)
2. Extend `BaseConverter` class
3. Implement `convert()` method to map intermediate format to target system schema
4. Override `isAlreadyConverted()` to detect if data is already in target format
5. Add mapping methods for system-specific fields (e.g., `mapHealth()`, `mapAttributes()`)
6. Import converter in `actor-importer.js`
7. Add case to `convertToTargetSystem()` switch statement
8. Add to `TARGET_SYSTEMS` configuration
9. Add to `targetSystems` arrays in compatible sources

**Converter Class Structure:**
```javascript
import { BaseConverter } from './base-converter.js';

export class MySystemConverter extends BaseConverter {
  isAlreadyConverted() {
    return !!(this.data.system?.specificField);
  }

  convert() {
    if (this.isAlreadyConverted()) return this.data;

    return {
      name: this.data.name,
      type: this.data.type,
      system: {
        // Map intermediate → target system
        specificField: this.mapSpecificField(),
        // ...
      },
      items: this.mapItems()
    };
  }

  mapSpecificField() { /* ... */ }
}
```
