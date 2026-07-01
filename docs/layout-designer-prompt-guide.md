# Layout Designer Prompt Guide

## Purpose

This document describes the Flatland Dispatcher Layout Designer, its data model, persistence behaviour, user interactions, dirty state handling, and runtime relationship.

It is intended as a prompt-ready technical reference for AI-assisted development. Use it when changing designer UX, layout save/load behaviour, runtime layout sync, drag-and-drop, or panel editing.

---

## Prompt Context

Use this context block when asking an AI assistant to work on the Layout Designer:

```text
We are working in the Flatland Dispatcher Angular frontend.

The Layout Designer edits FlatlandDesign objects. A design contains columns and panels. The designer supports:
- layout selection
- layout naming
- save
- save as
- rename
- new layout
- clear user layouts
- export/import JSON
- columns
- panels
- drag and drop
- resize
- live preview
- dirty/saved state
- light SBB/Lyne-style toolbar and footer status

Layouts are stored in localStorage. Runtime should load the selected/saved layout and fall back to default if the selected layout does not exist.

Important Angular rule:
- Methods called from templates must be side-effect free.
- Do not mutate state or call markForCheck from template-called methods.
- Refresh layout lists explicitly from user events such as focus/click/save/rename.
```

---

## Main Files

Common files involved in designer work:

```text
frontend/src/app/features/layout-designer/layout-designer.component.ts
frontend/src/app/features/layout-designer/layout-designer.component.html
frontend/src/app/features/layout-designer/layout-designer.component.scss

frontend/src/app/shared/layout/panel-shell/...
frontend/src/app/shared/layout/panel-plugin-host/...

frontend/src/app/app.component.ts
frontend/src/app/app.component.html
frontend/src/app/app.component.scss
```

Exact paths may vary slightly, but the responsibilities remain the same.

---

## Data Model

### FlatlandDesign

A saved UI layout.

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

A layout column.

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

A panel inside a column.

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

---

## Designer UI Structure

The designer is visually structured as:

```text
Topbar
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

Meta/Layout bar
  - selected layout
  - layout name
  - session
  - preview mode
  - scale
  - add/remove column
  - dirty/saved pill
  - live preview status

Body
  - component palette
  - preview canvas
  - settings panel

Footer
  - current status
  - saved/dirty/warn indicator
  - active layout name and id
```

---

## Responsibilities

The designer is responsible for:

```text
- creating and editing FlatlandDesign objects
- managing columns
- managing panels
- drag and drop
- panel and column resizing
- dirty/saved tracking
- persistence to localStorage
- import/export
- rendering live preview
- exposing layouts to runtime
```

The designer should not be responsible for:

```text
- simulation business rules
- agent dispatching logic
- map rendering internals
- timetable rendering internals
- component-specific runtime state
```

---

## Persistence

### Canonical Storage Keys

Preferred keys:

```text
flatland.designer.designs.v1
flatland.designer.active.v1
flatland.runtime.selectedLayoutId.v1
```

### Legacy Keys

Legacy keys may exist and can be read for compatibility:

```text
flatland.layoutDesigner.designs.v1
flatland.layoutDesigner.active.v1
flatland.layouts.v1
```

### Read Behaviour

When reading layouts:

```text
1. Try canonical designer layouts key.
2. Optionally read legacy keys.
3. Ignore invalid JSON.
4. Ignore invalid layout objects.
5. Deduplicate by id.
6. Sort by name or updated time.
7. Ensure a default layout fallback exists.
```

### Write Behaviour

When saving:

```text
1. Clone current design.
2. Update updatedAt.
3. Insert or replace by id.
4. Sort list.
5. Write canonical designer layouts key.
6. Write active designer id.
7. Optionally write runtime selected layout id when appropriate.
8. Refresh in-memory list.
9. Mark saved.
```

### Delete/Clear Behaviour

Clear user layouts should:

```text
- remove user layout storage
- keep hardcoded/system default available
- not leave dropdown empty
- set current design to a default copy
- set status to dirty or ready
```

---

## Dirty State

Dirty state means the current layout has unsaved changes.

Expected transitions:

```text
Initial load
  → saved

User edits layout
  → dirty

Save
  → saved

Save As
  → saved as new layout

Rename
  → saved with new name

New Layout
  → dirty or saved depending on implementation

Clear All Layouts
  → default copy available
```

Common dirty triggers:

```text
- layout name changed
- column added
- column removed
- column width changed
- panel added
- panel removed
- panel moved
- panel resized
- panel settings changed
- layout imported
```

Do not mark dirty from pure render functions.

---

## Template Method Rule

Methods used directly in Angular templates are called often. They must be pure.

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

Refresh only from explicit events:

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

## Save / Save As / Rename

### Save

Expected behaviour:

```text
- persist current design
- refresh layout list
- keep current design selected
- mark saved
- show feedback
- update footer status
```

### Save As

Expected behaviour:

```text
- prompt for name
- create new id
- clone current layout
- persist as new design
- refresh layout list
- select new design
- mark saved
- show feedback
```

### Rename

Expected behaviour:

```text
- prompt for new name
- update current design name
- persist
- refresh layout list
- keep current design selected
- mark saved
- show feedback
```

### Clear All Layouts

Expected behaviour:

```text
- confirm destructive action
- remove user layouts from storage
- keep default layout available
- set current design to default copy
- update dropdown immediately
- show feedback
```

---

## Layout Selection

Changing selected layout should:

```text
- load selected design by id
- clone the design before editing
- set current design
- clear selection or select design root
- mark saved
- update active layout key
```

If selected id does not exist:

```text
- fall back to default design
- update active id
- avoid throwing
```

---

## Drag and Drop

Designer drag/drop should support:

```text
- drag palette item into canvas
- drag panel between columns
- reorder panels
- drag outside canvas to delete if supported
- undo delete/move if supported
```

Rules:

```text
- create unique panel ids
- preserve panel type
- preserve config
- mark dirty after successful mutation
- avoid mutation during hover-only events unless needed
```

---

## Resize Behaviour

Column resize should:

```text
- update widthPx or widthFr
- enforce min width
- keep total layout usable
- mark dirty on final resize or throttled resize
```

Panel resize should:

```text
- update height or minHeight
- enforce min height
- support auto height where appropriate
- mark dirty after resize
```

---

## Live Preview

Designer live preview renders real runtime components through the shell/plugin host pipeline.

Important:

```text
- preview must not crash without active session
- components must show empty states if data is missing
- preview must not mutate layout state during render
- preview mode can be live or wireframe
```

Useful preview modes:

```text
live
wireframe
```

`live` renders actual components. `wireframe` may render simplified placeholders.

---

## Runtime Relationship

The runtime should use designer layouts but must be robust.

Runtime layout resolution should follow:

```text
1. Runtime selected layout id
2. Designer active layout id
3. First stored user layout
4. System/default layout
```

If the selected layout id no longer exists:

```text
- fall back to default
- update runtime selected id to fallback id
- do not crash
```

When designer saves a layout:

```text
- runtime should be able to see it after refresh/focus/storage event
- welcome layout dropdown should include it
```

---

## Styling Guidelines

Designer styling should follow light SBB/Lyne style:

```text
- white and milk backgrounds
- charcoal text
- granite secondary text
- red primary action or accent
- light danger style for destructive actions
- subtle borders
- compact toolbar buttons
- visible focus states
- no dark footer
```

Recommended footer:

```text
- light background
- top border
- compact status text
- saved/dirty/warn dot
- active layout name and id
```

---

## Accessibility Guidelines

Designer controls should:

```text
- be keyboard focusable
- have visible focus state
- use button elements for actions
- avoid div click handlers where possible
- keep labels associated with inputs/selects
- use aria-live only for important status changes
```

---

## Common Pitfalls

### Infinite Change Detection

Cause:

```text
Template calls a method.
Method mutates state.
Mutation triggers change detection.
Template calls method again.
Loop.
```

Fix:

```text
Make template methods pure.
Move refresh/mutation into explicit event handlers.
```

### Dropdown Not Updating

Cause:

```text
Save As or Rename persists storage but does not refresh in-memory designs list.
```

Fix:

```ts
this.persistCurrentDesignerLayout();
this.refreshDesignerLayoutList();
```

### Empty Dropdown After Clear

Cause:

```text
All stored layouts removed and no default fallback inserted into in-memory list.
```

Fix:

```text
After clear, set current design to default copy and set designs to [current design].
```

### Preview Component Overflows

Cause:

```text
Plugin component uses fixed viewport sizes or lacks min-width: 0.
```

Fix:

```scss
:host {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
```

---

## Prompt: Designer UX Change

```text
Update the Flatland Dispatcher Layout Designer UX.

Context:
- The designer edits FlatlandDesign objects.
- It has topbar, meta bar, body and footer.
- It uses light SBB/Lyne styling.
- Functionality must remain unchanged unless explicitly requested.
- Template-called methods must remain side-effect free.

Task:
<describe requested UI/UX change>

Requirements:
- Keep save/load/rename/save-as working.
- Keep dirty/saved state correct.
- Keep footer light.
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
- Save/Save As/Rename must refresh in-memory layout list.
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

## Prompt: Runtime Layout Sync

```text
Implement runtime layout synchronisation for the Flatland Dispatcher.

Requirements:
- Welcome layout dropdown updates after designer saves.
- Runtime remembers the last selected layout.
- Runtime loads the selected layout on startup.
- If selected layout was deleted, fallback to default.
- Read canonical designer layout storage.
- Optionally read legacy keys for compatibility.
- Do not crash on invalid JSON.
- Do not mutate state from template-called methods.
- Keep build green.
```

---

## Implementation Checklist

Before committing designer changes:

```text
[ ] Build passes.
[ ] No NG0103 infinite change detection.
[ ] Save works.
[ ] Save As works.
[ ] Rename works.
[ ] Clear All keeps default available.
[ ] Load Layout dropdown updates.
[ ] Dirty state changes after edits.
[ ] Saved state returns after save.
[ ] Footer stays light.
[ ] Runtime still loads.
[ ] Unknown panel types still show placeholder.
```

