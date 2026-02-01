# Plan: Refine Task Creation & Course Projects

## 1. Refine Task Creation (`buat_tugas`)
**Goal**: Upgrade from basic extraction to an interactive flow that ensures data completeness.

### Current Problem
- If user says "Ada tugas", bot fails or creates empty task without asking for Matkul/Deadline.
- No validation if the course exists.

### Proposed Flow
1. **User**: "Ada tugas baru"
2. **Bot**: checks extraction results.
   - **Missing Matkul?** -> Ask: "Buat matkul apa? 📚" (Show buttons of active courses).
   - **Missing Date?** -> Ask: "Deadline kapan? 📅" (Default: "Besok" if skipped, but better to ask).
   - **Missing Type?** -> Default to "Tugas" (or infer "Kuis"/"Lapres" from text).
3. **User Answers**: Inputs are merged into pending data.
4. **Confirmation**: "Konfirmasi Data" prompt before saving.

### Implementation Checklist
- [ ] **Schema Update**: Update `intentSchemas.js` to mark `matkul` and `waktu` as REQUIRED for `buat_tugas`.
- [ ] **Course Fetching**: Update `nlp-handler.js` to fetch user's courses from DB for the button list.
- [ ] **Looping Logic**: Ensure `askForMissing` handles `matkul` correctly (validation vs selection causes).
- [ ] **Confirmation**: Use existing `askForConfirmation` but ensure fields like 'Semester' are handled or hidden.

---

## 2. Project Creation (Type: Course/Matkul)
**Goal**: Handle "Project Matkul" flow distinctions (Course Selection).

### Scenario
User says: *"Bikin project buat matkul Komber"* OR *"Ada tugas besar PBO"*

### Flow
1. **Detection**:
   - Keyword "matkul", "kuliah", "tugas besar", "tubes" -> Sets `project_type = 'course'`.
   - Keyword "Komber", "PBO" -> Sets `matkul = '...'`.
2. **Validation**:
   - If `project_type == 'course'` AND `matkul` is missing/unknown:
     - **Bot**: "Ini project untuk matkul apa? 📚" (Show Course Buttons).
3. **Standard Flow**:
   - Continue to ask **Priority**, **Description**, **Links** (same as Personal Project).
4. **Output**:
   - Save `courseId` to the Project object.
   - UI Card shows "Course: [Nama Matkul]".

### Implementation Checklist
- [ ] **Constraint**: If `project_type === 'course'`, add `matkul` to missing fields list in `nlp-handler.js`.
- [ ] **Handler Update**: In `nlp-handler` logic for `nlp_proj_course` callback -> Trigger `askForMissing('matkul')`.
- [ ] **Integration**: Ensure `processProjectCreation` uses the `courseId`.

---

## 3. Technical Changes

### `intentSchemas.js`
```javascript
export const intentSchemas = {
    // ...
    buat_tugas: {
        fields: ['matkul', 'waktu', 'tipe_tugas', 'note'],
        required: ['matkul', 'waktu'] // Make these mandatory
    },
    buat_project: {
        fields: ['project', 'project_type', 'priority', 'note', 'link', 'matkul'], // Add matkul
        required: ['priority', 'note', 'link'] // Conditionally require matkul if type=course
    }
};
```

### `nlp-handler.js`
- **Course Buttons**: Create a helper `generateCourseButtons(userId)` to reuse for both Task and Project-Matkul selection.
- **Conditional Logic**:
  ```javascript
  if (data.project_type?.value === 'course' && !data.matkul) {
      pending.missing.unshift('matkul');
  }
  ```
