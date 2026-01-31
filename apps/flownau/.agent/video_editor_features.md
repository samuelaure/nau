# Video Editor Priorities & Features

## Implementation Priority Queue

### Phase 1: Core Engine (P0)
- [x] **Canvas & Player**: Basic playback works.
- [x] **Project Structure**: `VideoTemplate` data model is in place.
- [x] **Asset Pipeline**: Asset library visual and click-to-add works.
- [x] **Frame Sync**: Syncing `currentTime` with player is WORKING.
- [x] **Scrubbing/Seeking**: Ability to seek from timeline is WORKING.

### Phase 2: Basic Timeline (P1)
- [x] **Visual Timeline**: Dedicated component with measure marks and playhead.
- [ ] **Track Interaction**: Drag moving of clips.
- [ ] **Trimming**: Drag handles for start/end.
- [ ] **Transform Tools**: On-canvas handles (Gizmo) or just reliable property inputs.

### Phase 3: Layers & Text (P1.5)
- [x] **Text Layers**: Basic text element addition.
- [ ] **Advanced Text**: Fonts, styling beyond simple props.
- [ ] **Layer Reordering**: Drag to reorder or Up/Down buttons.
- [x] **Deletion**: Button exists.

### Phase 4: Polish & advanced (P2)
- [ ] **Splitting**: 'S' key support.
- [ ] **Keyboard Shortcuts**: Play/Pause (Space), Delete.
- [ ] **Transitions**: Crossfades.

---

## Current Status (Post-Refactor)

### 1. Core Component Structure
- **Main Editor**: Refactored into `VideoEditorContext` and subcomponents (`EditorCanvas`, `Timeline`, `LayerList`, etc.).
- **Player**: Remotion Player with event listener sync.

### 2. Canvas & Playback
- [x] **Video Player**
- [x] **Playback Control** (Play/Pause syncs with UI)
- [x] **Frame Sync** (Bidirectional sync via Context)

### 3. Tool Rail & Panels
- [x] **Navigation Rail**: Basic toggle between Layers/Assets.
- [x] **Contextual Drawer**: Shows active tab.
- [x] **Properties Panel**: Basic inputs.

### 4. Media Management
- [x] **Asset Library**
- [x] **Click-to-Add**

### 5. Timeline
- [x] **Timeline Component**: `Timeline.tsx` with scrubbing.
- [ ] **Trimming** (Numeric only)
- [ ] **Splitting** (Missing)

### 6. Layer Management
- [x] **Layers List**
- [ ] **Reordering** (Missing)
