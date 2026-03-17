# st4cker - Student Productivity Desktop App (v1.9.0)

A modern, offline-first desktop application built with Electron, React, and TypeScript.  
Designed to help students manage assignments, schedules, grades, and personal finances—all in one elegant platform.

*(Note: This repository contains the core desktop application. External plugins/services like `telegram-bot` and `openclaw` are managed separately and are not required for the main build).*

## ✨ Features

- **📊 Dashboard**: Comprehensive overview of upcoming deadlines, academic performance, and financial health.
- **📝 Assignments**: Full CRUD operations with smart filtering by status, type, and urgency detection.
- **📅 Schedule**: Organize and track your class timetables effortlessly.
- **🎯 Performance**: Monitor grades, GPA trends, and academic progress across semesters.
- **💰 Cashflow**: Personal finance tracker with income/expense categorization and analytics.
- **⚙️ Settings**: Customizable user profile, semester management, and application preferences.
- **🎨 Modern UI**: Glassmorphism design with full dark mode support and smooth animations.
- **💾 Offline-first**: All data stored locally in SQLite database (no server required).
- **⚡ Quick Add**: Universal modal for rapid data entry across all modules.
- **🔍 Global Search**: Instant search across assignments with CTRL+K shortcut.
- **🌐 Cloud Sync**: Google Drive integration for seamless backup and synchronization.  
  > **Note**: Cloud sync functionality is reserved for development builds. Custom OAuth credentials required.

## 🛠️ Tech Stack

- **Electron** - Cross-platform desktop framework
- **React + TypeScript** - UI framework with type safety
- **Tailwind CSS + shadcn/ui** - Modern, accessible component library
- **SQLite** - Lightweight, serverless database
- **Zustand** - Minimalist state management
- **Recharts** - Data visualization and charting
- **React Hook Form + Zod** - Form validation and management

## 🚀 Getting Started

### Prerequisites
- **Node.js** (LTS version 18.x or higher recommended)
- **Windows** 10/11 (x64)
- **Git** (optional, for cloning)

### Installation
1. Clone or download the repository:
   ```bash
   git clone <repository-url>
   cd st4cker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the app in development mode with Hot Module Replacement:
```bash
npm run electron:dev
```

### Build for Production
Create a standalone Windows installer (`.exe`):
```bash
npm run build
```
The compiled installer will be available in the `dist/` directory.

## 📁 Project Structure

```
├── electron/              # Main process (Node.js/Electron)
│   ├── db/               # SQLite database handlers
│   ├── main.cts          # Application entry point
│   └── preload.cts       # IPC bridge & context isolation
├── src/                  # Renderer process (React/UI)
│   ├── components/       # Reusable UI components
│   ├── pages/           # Application screens/routes
│   ├── store/           # Zustand state management
│   ├── lib/             # Utilities and helpers
│   └── types/           # TypeScript type definitions
└── public/              # Static assets
```

## 💾 Data Storage

User data is stored locally in an SQLite database file:
- **Location**: `%APPDATA%/st4cker/st4cker.db` (Windows)
- **Automatic backups**: Created on major updates
- **No internet required**: Full offline functionality

## 🎨 Design Philosophy

st4cker embraces modern design principles with:
- **Glassmorphism**: Translucent UI elements with backdrop blur effects
- **Dark-first**: Optimized for low-light environments
- **Fluid Animations**: Smooth transitions and micro-interactions
- **Accessibility**: Keyboard shortcuts and screen reader support

## 🐛 Troubleshooting

### App won't start
- Ensure Node.js is installed correctly
- Delete `node_modules/` and run `npm install` again
- Check antivirus isn't blocking the `.exe` file

### Database errors
- Close all running instances of st4cker
- Database file may be locked by another process
- Check file permissions in `%APPDATA%/st4cker/`

## 📄 License

This project is developed for personal and educational use.

---

**Built with ❤️ for students, by students.**
