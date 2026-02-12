# Fix Pairing UX, Restore Shortcuts & Polish UI

## Goal Description
1.  **Fix Pairing UX**: Allow the user to press `Enter` in the "Pair Telegram Bot" modal to trigger the "Pair Device" action.
2.  **Restore Shortcuts**: Make assignments (`Ctrl+N`), transactions (`Ctrl+T`), and other shortcuts working globally from any page.
3.  **UI Polish (Checkboxes)**: Fix the checkbox size in the Assignments table (both header and rows are too big).

## User Review Required
> [!IMPORTANT]
> **Keyboard Shortcuts Confirmation**:
> I am proceeding with making `Ctrl+N` (New Task) and `Ctrl+T` (New Transaction) global.
>
> **UI Polish**:
> I will reduce the checkbox size significantly (e.g., `scale-75` or specific dimensions) to match the provided reference image.

## Proposed Changes

### 1. Fix "Enter" Key in Pairing Modal
**File:** [TelegramTab.tsx](file:///d:/Project/st4cker/src/pages/Settings/TelegramTab.tsx)
- Add `onKeyDown={(e) => e.key === 'Enter' && handlePair()}` to the `InputOTP` component.

### 2. Implement Global "New Task" Shortcut & Modal Lifting
**File:** [SidebarLayout.tsx](file:///d:/Project/st4cker/src/components/layout/SidebarLayout.tsx)
- [NEW] Import `AssignmentModal` and use it inside `SidebarLayout` so it's always available.
- Add a global `keydown` listener for `Ctrl + N`.
- Manage the modal's open state (`isQuickAddOpen`) in `SidebarLayout`.

**File:** [Assignments.tsx](file:///d:/Project/st4cker/src/pages/Assignments.tsx)
- [MODIFY] Remove the conflicting local `Ctrl+N` listener using `AssignmentModal`.

### 3. UI Polish: Fix Checkbox Size
**File:** [Assignments.tsx](file:///d:/Project/st4cker/src/pages/Assignments.tsx)
- [MODIFY] **Row Checkbox**: Change `className="scale-90"` to `className="scale-75"` (or `w-4 h-4`).
- [MODIFY] **Header Checkbox**: Locate the `TableHeader` checkbox and apply the same `scale-75` and padding fix.

## Verification Plan

### Manual Verification
1.  **Pairing Modal**:
    - Settings -> Telegram -> Pair -> Type Code -> Press Enter -> Verify action triggers.
2.  **Global Shortcuts**:
    - Go to **Dashboard** -> Press `Ctrl + N` -> Verify "New Assignment" modal opens.
3.  **Checkbox UI**:
    - Go to **Assignments** tab.
    - Visually verify the checkboxes are smaller and aligned properly in both the Header and the Rows.
