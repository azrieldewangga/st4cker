# St4cker UI Redesign Implementation Plan

**Goal**: Redesign `st4cker` application using the UI source code from `project-dashboard-main` while preserving all existing functionality.

## 0. Prerequisite Analysis & Setup
- [ ] **Dependency Check**:
    - Add `@phosphor-icons/react` (used in reference).
    - Add `vaul` (drawer) if needed.
    - Check `date-fns` version compatibility.
    - Ensure Tailwind 4 configuration matches.
- [ ] **Asset Migration**:
    - Copy fonts (Geist/Fira Code) configuration.
    - Copy `globals.css` color variables (OKLCH system) to `index.css`.

## 1. Design System Migration
- [ ] **Theme Configuration**:
    - Update `index.css` with the new OKLCH color palette from reference.
    - Update `layer base` styles for consistent typography and interactions.
- [ ] **Base Components (shadcn/ui)**:
    - The reference project has its own flavor of shadcn components.
    - **Strategy**: Backup current `src/components/ui` -> `src/components/ui-legacy`.
    - Copy `components/ui` from reference to `src/components/ui`.
    - Fix imports (remove `next/` specific imports, replace with standard React/Vite equivalents).

## 2. Layout & Navigation Restructuring (The "Sidebar" Shift)
- [ ] **Component: `AppSidebar`**:
    - Port `components/app-sidebar.tsx` to `st4cker`.
    - Replace `next/link` with `react-router-dom` `Link`.
    - Replace `usePathname` with `useLocation`.
    - Adapt "Active Projects" section to use real data from `useStore`.
- [ ] **Component: `SidebarLayout`**:
    - Create new layout replacing `MainLayout.tsx`.
    - Integrate `AppSidebar`.
    - Ensure window controls (minimize/close) are properly placed (likely top-right of main content area, since top header is gone).
    - Add "Window Drag Region" support to the new header area.

## 3. Core Feature Migration (Page by Page)

### 3.1 Dashboard (`/`)
- [ ] **Metric Cards**:
    - Adapt reference `StatCard` or similar.
    - Feed data: Balance, Expenses, Tasks Due.
- [ ] **Active Projects List**:
    - Use the reference's Sidebar "Active Projects" logic.
- [ ] **Recent Activity / Tasks**:
    - adapt `project-dashboard-main`'s list/board views for the dashboard widget.

### 3.2 Projects & Assignments (Unified View)
- The reference combines these well. `st4cker` currently has separate tabs.
- [ ] **Project Board**:
    - Port `project-board-view.tsx` and `project-card.tsx`.
    - Connect to `st4cker` project store.
    - Implement Drag & Drop using existing `dnd-kit` logic but with new UI.
- [ ] **Task List**:
    - Port `tasks-view.tsx` (or equivalent list component).
    - Apply existing "Assignments" logic (CRUD, filters).

### 3.3 Tasks Page
- [ ] **Task Table/List**:
    - Use reference's clean table/list style.
    - Implement the "Filter Chips" pattern from reference.

### 3.4 Settings
- [ ] **Settings Dialog**:
    - Port `settings/SettingsDialog.tsx`.
    - Integrate existing `Settings.tsx` logic into this modal/dialog structure.
    - This might replace the dedicated `/settings` page, or the page becomes a wrapper for this view.

## 4. Technical Refactoring
- [ ] **Routing**:
    - Update `App.tsx` router to use the new `SidebarLayout`.
- [ ] **Electron Integration**:
    - Ensure IPC calls still work within new components.
    - Verify `window.electronAPI` availability.

## 5. Timeline / Execution Order
1.  **Dependencies & global CSS** (Switch to OKLCH)
2.  **Base UI Components** (Swap `ui` folder)
3.  **Sidebar & Layout** (Get the shell working)
4.  **Dashboard Page** (First feature page)
5.  **Projects/Tasks Pages** (Core functionality)
6.  **Other Pages** (Cashflow, Performance, Schedule)

## 6. Verification
- Verify Light/Dark mode switching works with new OKLCH variables.
- Verify Electron standard window controls (drag, min, max, close).
- Verify all data CRUD operations still function.
