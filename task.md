# St4cker UI Redesign Task Tracker

## Phase 0: Setup & Dependencies
- [x] Add `@phosphor-icons/react` to dependencies
- [x] Copy OKLCH color variables from reference `globals.css` to `index.css`
- [x] Update font configuration (Fira Code)

## Phase 1: Design System Migration
- [x] Backup current `src/components/ui` to `src/components/ui-legacy` (skipped - keeping existing)
- [x] Port essential UI components from reference (`sidebar.tsx`, `sheet.tsx`)
- [x] Fix Next.js-specific imports (replace with React Router equivalents)

## Phase 2: Layout Restructuring
- [x] Create new `AppSidebar` component
- [x] Create new `SidebarLayout` to replace `MainLayout`
- [x] Integrate window controls in new layout
- [x] Update `App.tsx` routing

## Phase 3: Page Redesign
- [x] Dashboard page (basic layout working)
- [x] Assignments/Tasks page - added filter chips
- [ ] Projects page
- [ ] Cashflow page
    - [x] Verify database connection implementation in `telegram-bot` <!-- id: 3 -->
    - [x] Verify database connection implementation in `electron` app <!-- id: 4 -->
    - [x] Check `prisma` schema if applicable <!-- id: 5 -->
- [ ] Performance page
- [ ] Schedule page
- [ ] Settings (as dialog)

## Phase 4: Verification
- [ ] Test Light/Dark mode
- [ ] Test all CRUD operations
- [x] Document findings and answer user's question <!-- id: 6 -->
- [x] Test Electron window controls
- [ ] Build test

## Phase 5: OpenClaw Integration & VPS Migration
- [x] **API Enhancements for Agent Control**
    - [x] Create generic REST endpoints for Tasks (CRUD) in `server.js`
    - [x] Create generic REST endpoints for Projects (CRUD)
    - [x] Create generic REST endpoints for Transactions (CRUD)
    - [x] Add API Authentication (Bearer Token or similar simple auth)
- [x] **OpenClaw Skill Generation**
    - [x] Generate OpenAPI/Swagger Spec for the new endpoints
    - [ ] Create `openclaw-skill.json` (or compatible tool definition)
- [x] **VPS Deployment Prep**
    - [x] Create `docker-compose.yml` for St4cker (Node App + Postgres/SQLite)
    - [ ] Document VPS setup steps (env vars, ports)
