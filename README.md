# st4cker - Student Productivity Desktop App

Desktop application built with Electron, React, TypeScript, and TailwindCSS.
Designed to help students manage assignments, schedules, grades, and cashflow.

## Features
- **Dashboard**: Overview of nearest deadlines, performance, and cashflow.
- **Assignments**: CRUD assignments, filter by status/type, urgency detection.
- **Offline-first**: Data stored locally in JSON ecosystem (no server required).
- **Quick Add**: Universal modal to quickly add items.
- **Global Search**: Search across assignments (CTRL+K style).

## Getting Started

### Prerequisites
- Node.js (LTS version recommended)
- Git (optional)

### Installation
1. Clone the repository (or copy files).
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the app in development mode (Hot Reload):
```bash
npm run electron:dev
```

### Build for Windows
To create a standalone `.exe` installer/portable file:
```bash
npm run build
```
The output file will be located in `dist/`.

## Project Structure
- `electron/`: Main process code (System integration).
- `src/`: Renderer process code (UI/React).
  - `components/`: Reusable UI components.
  - `pages/`: Application screens.
  - `store/`: Zustand global state manager.
  - `lib/db/`: Database logic (Adapters).
