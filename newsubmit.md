# Product Requirements Document (PRD)

## Admin Submit Form Management System

### Overview

Create a new admin dashboard feature that allows administrators to create, manage, and deploy custom submission forms similar to the existing YCHackForm. This system will enable dynamic form creation with custom fields, routing, and submission handling while maintaining the existing admin dashboard structure.

---

## Phase 1: Database Schema & Backend Foundation

### 1.1 New Convex Schema Tables

**submitForms** table:

```typescript
submitForms: defineTable({
  title: v.string(), // e.g., "YC AI Hackathon Submissions"
  slug: v.string(), // URL slug e.g., "ychack", "newform"
  description: v.optional(v.string()), // Form description
  isEnabled: v.boolean(), // Enable/disable form
  customHiddenTag: v.string(), // Hidden tag to auto-add (e.g., "ychackathon")
  headerText: v.optional(v.string()), // Custom header text
  submitButtonText: v.optional(v.string()), // Custom submit button text
  successMessage: v.optional(v.string()), // Custom success message
  disabledMessage: v.optional(v.string()), // Message when form is disabled
  isBuiltIn: v.optional(v.boolean()), // Mark built-in forms like YCHackForm
  createdBy: v.id("users"),
  submissionCount: v.optional(v.number()), // Track submissions
})
  .index("by_slug", ["slug"])
  .index("by_enabled", ["isEnabled"])
  .index("by_createdBy", ["createdBy"]);
```

**submitFormFields** table:

```typescript
submitFormFields: defineTable({
  formId: v.id("submitForms"),
  fieldKey: v.string(), // e.g., "githubUrl", "linkedinUrl"
  label: v.string(), // Display label
  placeholder: v.optional(v.string()),
  description: v.optional(v.string()),
  fieldType: v.union(
    v.literal("text"),
    v.literal("email"),
    v.literal("url"),
    v.literal("textarea"),
    v.literal("file"),
    v.literal("select"),
  ),
  isRequired: v.boolean(),
  isEnabled: v.boolean(),
  order: v.number(),
  options: v.optional(v.array(v.string())), // For select fields
  storyPropertyMapping: v.optional(v.string()), // Maps to story schema field
})
  .index("by_formId_order", ["formId", "order"])
  .index("by_formId_enabled", ["formId", "isEnabled"]);
```

### 1.2 Backend Mutations & Queries

**submitForms.ts**:

```typescript
// Admin functions
export const createSubmitForm = mutation({ ... })
export const updateSubmitForm = mutation({ ... })
export const deleteSubmitForm = mutation({ ... })
export const listSubmitForms = query({ ... }) // Admin only
export const getSubmitFormWithFields = query({ ... }) // Admin only

// Public functions
export const getPublicSubmitForm = query({ ... }) // By slug
export const submitFormData = mutation({ ... }) // Form submission
```

**submitFormFields.ts**:

```typescript
export const createFormField = mutation({ ... })
export const updateFormField = mutation({ ... })
export const deleteFormField = mutation({ ... })
export const reorderFormFields = mutation({ ... })
export const listFormFields = query({ ... })
```

---

## Phase 2: Admin Dashboard Integration

### 2.1 New Admin Tab

Add "Submit Forms" to AdminDashboard tabs:

```typescript
type AdminTab =
  | "content"
  | "tags"
  | "form-fields"
  | "forms"
  | "reports"
  | "numbers"
  | "users"
  | "settings"
  | "judging"
  | "submit-forms"; // New tab
```

### 2.2 Submit Forms Management Component

**src/components/admin/SubmitFormManagement.tsx**:

- List all submit forms (including built-in YCHackForm)
- Create new submit form button
- Enable/disable toggle for each form
- Copy form URL functionality
- Edit form settings
- View submission count
- Delete confirmation modal

Key features:

- Form status indicators (enabled/disabled)
- URL preview with copy functionality
- Built-in form badge for YCHackForm
- Quick actions (edit, enable/disable, copy URL)

### 2.3 Submit Form Builder Component

**src/components/admin/SubmitFormBuilder.tsx**:

- Form metadata editor (title, slug, description)
- Custom text editor (header, button text, messages)
- Hidden tag configuration
- Form field management interface
- Real-time preview
- Save/publish functionality

Form Editor Sections:

1. **Basic Settings**: Title, slug, enabled status
2. **Display Text**: Header text, button text, success/disabled messages
3. **Hidden Tag**: Custom tag to auto-add to submissions
4. **Form Fields**: Drag-and-drop field management
5. **Preview**: Live preview of form

---

## Phase 3: Dynamic Form Field Management

### 3.1 Field Type System

Support field types that map to story schema:

- **text**: Maps to custom string fields
- **email**: Maps to story.email
- **url**: Maps to linkedinUrl, twitterUrl, githubUrl, etc.
- **textarea**: Maps to longDescription
- **file**: Maps to screenshotId (image upload)
- **select**: Custom dropdown options

### 3.2 Field Configuration Interface

Each field configurable with:

- Label and placeholder text
- Required/optional toggle
- Description text
- Story property mapping
- Field ordering (drag-and-drop)
- Enable/disable toggle

### 3.3 Built-in Form Migration

Create migration to add YCHackForm as built-in:

```typescript
// Migration script to create YCHackForm entry
const ychackFormId = await ctx.db.insert("submitForms", {
  title: "YC AI Hackathon Submissions",
  slug: "ychack",
  isEnabled: true,
  customHiddenTag: "ychackathon",
  isBuiltIn: true,
  createdBy: adminUserId,
  // ... other fields
});
```

---

## Phase 4: Dynamic Form Rendering

### 4.1 Generic Form Component

**src/components/DynamicSubmitForm.tsx**:

- Fetch form configuration by slug
- Render fields dynamically based on configuration
- Handle form submission
- Display custom text (header, buttons, messages)
- Form validation
- File upload handling
- Success/error states

### 4.2 Form Routing System

Update App.tsx routing:

```typescript
// New dynamic route for submit forms
<Route
  path="/submit/:slug"
  element={<DynamicSubmitFormPage />}
/>

// Keep existing YCHackForm route for backward compatibility
<Route
  path="/ychack"
  element={<YCHackForm />}
/>
```

### 4.3 Form Submission Handler

Enhanced submission logic:

- Map form fields to story schema
- Auto-add hidden tag
- Handle anonymous submissions
- Rate limiting by form
- Validation based on field configuration
- File upload processing

---

## Phase 5: Form Management Features

### 5.1 Form Status Management

- **Enabled**: Form accepts submissions normally
- **Disabled**: Show custom disabled message with signup CTA
- **Draft**: Form exists but not publicly accessible

### 5.2 Submission Tracking

- Track submission count per form
- View submissions by form in admin
- Export form submissions
- Form analytics (conversion rates, popular fields)

### 5.3 URL Management

- Automatic slug generation from title
- Custom slug editing
- URL conflict detection
- SEO-friendly URLs
- Copy URL functionality

---

## Phase 6: Migration & Backward Compatibility

### 6.1 YCHackForm Integration

- Keep existing YCHackForm.tsx component
- Add database entry for YCHackForm
- Mark as built-in form (non-deletable)
- Maintain /ychack route
- Show in admin submit forms list

### 6.2 Form Field Sync

- Ensure submit form fields use same storyFormFields
- Maintain compatibility with existing form field management
- Shared field types and validation

### 6.3 Database Migration

1. Create new schema tables
2. Migrate YCHackForm to database
3. Set up default form fields for YCHack
4. Update existing queries if needed

---

## Technical Implementation Order

### Phase 1: Foundation (Week 1)

1. Add new schema tables to convex/schema.ts
2. Create submitForms.ts and submitFormFields.ts
3. Implement basic CRUD operations
4. Add database migration for YCHackForm

### Phase 2: Admin Interface (Week 2)

1. Add submit-forms tab to AdminDashboard
2. Create SubmitFormManagement.tsx component
3. Implement form listing and basic actions
4. Add enable/disable functionality

### Phase 3: Form Builder (Week 2-3)

1. Create SubmitFormBuilder.tsx component
2. Implement form field management
3. Add drag-and-drop field ordering
4. Create form preview functionality

### Phase 4: Dynamic Rendering (Week 3)

1. Create DynamicSubmitForm.tsx component
2. Implement dynamic form rendering
3. Add form submission handling
4. Update routing system

### Phase 5: Polish & Testing (Week 4)

1. Add form analytics and tracking
2. Implement URL management
3. Add error handling and validation
4. Testing and bug fixes

---

## Success Metrics

- Admin can create new submit form in <5 minutes
- Form submissions work identically to YCHackForm
- Zero downtime for existing YCHackForm
- All existing admin features remain functional
- New forms generate submissions in stories table
- Form enable/disable works as expected

This PRD provides a comprehensive roadmap for implementing the dynamic submit form management system while maintaining full backward compatibility and type safety with the existing Convex database structure.
