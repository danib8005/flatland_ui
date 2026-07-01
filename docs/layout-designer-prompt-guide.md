# Layout Designer Prompt Guide

## Purpose

This document is a prompt-ready guide for AI agents, LLM chats, and developers working on the Flatland Dispatcher Layout Designer.

Use it when changing:

- the Layout Designer UI
- layout save/load behaviour
- dirty/saved state
- layout import/export
- layout preview
- designer/runtime synchronisation
- panel palette entries
- designer-created layout JSON

The Layout Designer is not only a visual editor. It is also the place where runtime layout data is created, changed, saved, exported, imported, and later consumed by the runtime.

---

## Short Agent Context

Use this text as context for a new AI agent:

```text
We are working in the Flatland Dispatcher Angular frontend.

The Layout Designer edits FlatlandDesign objects.
A FlatlandDesign contains columns.
Columns contain panels.
Panels have a type, title, sizing and optional config.
At runtime panels are rendered through PanelShellComponent and PanelPluginHostComponent.

The designer is responsible for:
- showing available components in a palette
- creating panels from palette entries
- editing layout metadata
- adding/removing/resizing columns
- adding/removing/moving/resizing panels
- live preview
- save
- save as
- rename
- import/export JSON
- clear user layouts
- dirty/saved state
- making saved layouts available to runtime

Important rules:
- Do not mutate state from methods called in Angular templates.
- Template-called methods must be side-effect free.
- Refresh lists explicitly from events like focus/click/save/rename.
- Saved layouts must remain serializable JSON.
- Unknown panel types must not crash preview or runtime.
- Runtime must fall back to default if a selected layout id no longer exists.
```

---

## Mental Model

The designer is a visual editor for layout JSON.

```text
User changes Designer UI
  -> FlatlandDesign is mutated
  -> layout becomes dirty
  -> user saves
  -> layout is persisted
  -> runtime can load same layout
```

The designer should not contain feature-specific business logic.

For example, the designer should not know:

- how a map renders cells
- how an agent list filters agents
- how a timetable computes paths
- how KPI panels calculate values

The designer should only create and edit panel definitions. The concrete component is selected later by the plugin host through `panel.type`.

```text
DesignerPanel.type
  -> PanelPluginHostComponent
  -> concrete Angular component
```

Therefore:

```text
designer palette type == saved panel.type == plugin host mapping
```

These strings must match exactly.

---

## Core Data Model

### FlatlandDesign

A complete saved UI layout.

```ts
export interface FlatlandDesign {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  layout: {
    columns: DesignerColumn[];
  };
}
```

### DesignerColumn

A vertical layout area.

```ts
export interface DesignerColumn {
  id: string;
  title?: string;
  zone?: 'left' | 'center' | 'right' | string;
  widthPx?: number;
  widthFr?: number;
  panels: DesignerPanel[];
}
```

### DesignerPanel

One component instance inside a column.

```ts
export interface DesignerPanel {
  id: string;
  type: string;
  title: string;
  zone?: string;
  minHeight?: number;
  height?: number | 'auto';
  expanded?: boolean;
  config?: Record<string, unknown>;
}
```

`panel.type` is the stable contract between designer, saved layout and runtime.

Do not rename existing panel types without migration or plugin host aliases.

---

## Designer UI Areas

The designer usually has these areas:

### Topbar

Contains global designer actions:

- product/title
- Load Layout
- Rename
- New Layout
- Clear All Layouts
- Save / Save changes / Saved
- Save As
- Export JSON
- Import JSON
- Home

### Meta / Layout Bar

Contains current layout configuration:

- selected layout
- layout name
- session
- preview mode
- scale
- add/remove column
- dirty/saved status
- live preview status

### Body

Contains the main working area:

- component palette
- layout preview canvas
- settings panel

### Footer

Contains status information:

- current status
- dirty/saved/warn indicator
- active layout name
- active layout id

When changing visual styling, preserve behaviour unless the task explicitly asks for functional changes.

---

## Persistence Rules

Canonical localStorage keys:

```text
flatland.designer.designs.v1
flatland.designer.active.v1
flatland.runtime.selectedLayoutId.v1
```

Legacy keys may exist:

```text
flatland.layoutDesigner.designs.v1
flatland.layoutDesigner.active.v1
flatland.layouts.v1
```

### Read Behaviour

When reading layouts:

1. Read canonical key first.
2. Optionally read legacy keys.
3. Ignore invalid JSON.
4. Ignore invalid layout objects.
5. Deduplicate by id.
6. Sort predictably, usually by name or updatedAt.
7. Ensure a default/system layout fallback exists.

### Write Behaviour

When saving:

1. Clone current design.
2. Update `updatedAt`.
3. Insert or replace layout by id.
4. Write canonical designer layouts key.
5. Write active designer id.
6. Optionally update runtime selected layout id.
7. Refresh the in-memory layout list.
8. Mark saved.
9. Show feedback.

### Clear User Layouts

Clear all user layouts should:

- confirm destructive action
- remove user layout storage
- keep system/default layout available
- not leave dropdown empty
- select or recreate a default copy
- update status/dirty state clearly

---

## Dirty State Rules

Dirty state means the current layout model has unsaved changes.

Good dirty triggers:

- layout name changed
- column added
- column removed
- column width changed
- panel added
- panel removed
- panel moved
- panel resized
- panel settings changed
- imported layout changed current design

Bad dirty triggers:

- render cycle
- template getter call
- hover-only UI change
- session tick
- map animation
- refreshing dropdown options

Expected transitions:

```text
Initial load
  -> saved

User edits layout
  -> dirty

Save
  -> saved

Save As
  -> saved as new layout

Rename
  -> saved with new name

Clear All Layouts
  -> default/system layout available
```

---

## Angular Template Safety

Methods used directly in Angular templates are called often. They must be pure and side-effect free.

Bad:

```ts
designerLayoutOptions(): FlatlandDesign[] {
  this.refreshDesignerLayoutList();
  return this.designs;
}
```

This can cause infinite change detection.

Good:

```ts
designerLayoutOptions(): FlatlandDesign[] {
  return this.designs;
}
```

Refresh explicitly from events:

```html
<select
  (focus)="refreshDesignerLayoutList()"
  (click)="refreshDesignerLayoutList()">
</select>
```

Or after mutations:

```ts
saveWithFeedback(): void {
  this.persistCurrentDesignerLayout();
  this.refreshDesignerLayoutList();
  this.markDesignerSaved('Layout saved');
}
```

---

## Adding Components Through the Designer

When adding a new component to the designer:

1. Choose a stable kebab-case `panel.type`.
2. Add a palette entry.
3. Add default panel metadata.
4. Ensure `panel.config` is serializable.
5. Map the type in `PanelPluginHostComponent`.
6. Make the component safe in designer preview.
7. Make the component safe in runtime.
8. Test save/reload.

Recommended companion document:

```text
docs/component-agent-build-guide.md
```

That guide explains:

- expected panel component API
- shell/plugin boundary
- embedded CSS rules
- known panel/component types
- how to add new components safely

---

## Runtime Relationship

The runtime consumes saved layouts. Runtime layout resolution should be robust.

Recommended order:

1. Runtime selected layout id.
2. Designer active layout id.
3. First stored user layout.
4. System/default layout.

If the selected layout id does not exist anymore:

- do not crash
- fall back to default/system layout
- update selected id if appropriate
- keep welcome/dropdown usable

Designer and runtime should stay loosely coupled through storage and layout data.

The designer should not require a running session.  
The runtime should not require the designer screen to be open.

---

## Prompt: Designer UX Change

```text
Update the Flatland Dispatcher Layout Designer UX.

Context:
- The designer edits FlatlandDesign objects.
- It has topbar, meta bar, body and footer.
- It uses light SBB/Lyne-style visual language.
- Functionality must remain unchanged unless explicitly requested.
- Template-called methods must remain side-effect free.

Task:
<describe requested UI/UX change>

Requirements:
- Keep save/load/rename/save-as working.
- Keep dirty/saved state correct.
- Keep default fallback available.
- Keep footer light and visible.
- Avoid infinite change detection.
- Keep build green.
```

---

## Prompt: Designer Persistence Fix

```text
Fix Layout Designer persistence.

Context:
- Layouts are saved in localStorage.
- Canonical keys:
  - flatland.designer.designs.v1
  - flatland.designer.active.v1
  - flatland.runtime.selectedLayoutId.v1
- Save/Save As/Rename must refresh the in-memory layout list.
- Runtime must fall back to default if selected layout is missing.

Problem:
<describe issue>

Please inspect:
- loadDesignerLayoutsFromStorage
- persistCurrentDesignerLayout
- refreshDesignerLayoutList
- saveWithFeedback
- saveAsWithPrompt
- renameCurrentLayout
- clearAllUserLayouts
- runtime layout selection
```

---

## Implementation Checklist

Before committing Layout Designer changes:

```text
[ ] Build passes.
[ ] No NG0103 infinite change detection.
[ ] Save works.
[ ] Save As works.
[ ] Rename works.
[ ] Clear All keeps default/system layout available.
[ ] Load Layout dropdown updates.
[ ] Dirty state changes after edits.
[ ] Saved state returns after save.
[ ] Footer stays light.
[ ] Designer preview works without active session.
[ ] Runtime still loads selected/default layout.
[ ] Unknown panel types still show placeholder.
```
