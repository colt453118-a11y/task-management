# UI/UX Design System — Enterprise Work Management Platform

## Design Philosophy

- **Clarity over complexity** — Every pixel serves a purpose
- **Premium, not busy** — Inspired by Linear, Notion, and modern enterprise SaaS
- **Accessible by default** — WCAG 2.2 AA compliance built into every component
- **Delightful micro-interactions** — Subtle animations that feel responsive, not distracting
- **Dark & Light modes** — Both equally polished

---

## Design Tokens

```css
/* Color Palette — Tailwind CSS v4 with CSS variables */

:root {
  /* Brand Colors */
  --color-brand-50: #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-200: #c7d2fe;
  --color-brand-300: #a5b4fc;
  --color-brand-400: #818cf8;
  --color-brand-500: #6366f1; /* Primary - Indigo */
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
  --color-brand-800: #3730a3;
  --color-brand-900: #312e81;

  /* Neutral / Surface */
  --color-surface-50: #fafafa; /* Lightest background */
  --color-surface-100: #f4f4f5;
  --color-surface-200: #e4e4e7;
  --color-surface-300: #d4d4d8;
  --color-surface-400: #a1a1aa;
  --color-surface-500: #71717a;
  --color-surface-600: #52525b;
  --color-surface-700: #3f3f46;
  --color-surface-800: #27272a;
  --color-surface-900: #18181b; /* Darkest background */
  --color-surface-950: #09090b;

  /* Task Status Colors */
  --color-draft: #94a3b8;
  --color-open: #3b82f6;
  --color-in-progress: #f59e0b;
  --color-blocked: #ef4444;
  --color-on-hold: #8b5cf6;
  --color-under-review: #06b6d4;
  --color-approved: #22c55e;
  --color-completed: #10b981;
  --color-closed: #6366f1;
  --color-archived: #6b7280;
  --color-rejected: #ef4444;
  --color-cancelled: #9ca3af;

  /* Priority Colors */
  --priority-none: #9ca3af;
  --priority-low: #22c55e;
  --priority-medium: #f59e0b;
  --priority-high: #f97316;
  --priority-urgent: #ef4444;
  --priority-critical: #dc2626;

  /* Feedback Colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Sizing */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-dropdown: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-modal: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.12);

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark Mode Overrides */
.dark {
  --color-surface-50: #09090b;
  --color-surface-100: #18181b;
  --color-surface-200: #27272a;
  --color-surface-300: #3f3f46;
  --color-surface-400: #52525b;
  --color-surface-500: #71717a;
  --color-surface-600: #a1a1aa;
  --color-surface-700: #d4d4d8;
  --color-surface-800: #e4e4e7;
  --color-surface-900: #f4f4f5;
  --color-surface-950: #fafafa;

  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.4);
  --shadow-dropdown: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-modal: 0 10px 15px -3px rgb(0 0 0 / 0.4);
}
```

---

## Typography Scale

```css
/* Inter font — excellent readability at all sizes */

h1 {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.25;
} /* 32px - Page titles */
h2 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
} /* 24px - Section headers */
h3 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
} /* 20px - Card titles */
h4 {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
} /* 16px - Subsection */

body-large {
  font-size: 1rem;
  line-height: 1.5;
} /* 16px - Body text */
body-small {
  font-size: 0.875rem;
  line-height: 1.5;
} /* 14px - Secondary text */
body-xs {
  font-size: 0.75rem;
  line-height: 1.5;
} /* 12px - Labels, metadata */

code {
  font-size: 0.875rem;
  font-family: var(--font-mono);
}
```

---

## Component System

### Sidebar Navigation

```
┌─────────────────────┐
│ [Logo] WorkManager   │
│                     │
│ 🔍 Search...        │ (Command + K)
│                     │
│ 📊 Dashboard        │ ← Active
│ 📋 Tasks            │
│   ├── List          │
│   ├── Board         │
│   └── Calendar      │
│ 📁 Projects         │
│ 👥 Teams            │
│ 📈 Reports          │
│ 📅 Calendar         │
│ ⚙️ Settings         │
│                     │
│ ┌─────────────────┐ │
│ │ User Avatar     │ │
│ │ User Name       │ │
│ │ Workspace       │ │
│ └─────────────────┘ │
└─────────────────────┘
```

- Collapsible sidebar (default: expanded, min 48px collapsed)
- Section headers with collapsible groups
- Badge counts for notifications
- Keyboard shortcut (⌘B) to toggle
- Smooth width transition on collapse

### Top Navigation Bar

```
┌─────────────────────────────────────────────────────────────┐
│ [← Back]  Project Name  │  🔔  💬  👤 User Name  ▼       │
│ Breadcrumbs > Path       │     (Notifications count badge)  │
└─────────────────────────────────────────────────────────────┘
```

- Breadcrumb navigation always visible
- Notification bell with unread count
- Command palette trigger (⌘K)
- User dropdown menu with theme toggle, settings, logout

### Kanban Board

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  TO DO (4)  │ │ IN PROGRESS │ │  REVIEW (3) │ │  DONE (7)   │
│             │ │    (5)      │ │             │ │             │
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
│ │ TASK-42 │ │ │ │ TASK-43 │ │ │ │ TASK-44 │ │ │ │ TASK-45 │ │
│ │ Login   │─┼─▶│ API     │─┼─▶│ PR #123  │─┼─▶│ Deploy  │ │
│ │ page    │ │ │ │ Route   │ │ │ │ Review   │ │ │ │ Live    │ │
│ │ ─────── │ │ │ │ ─────── │ │ │ │ ─────── │ │ │ │ ─────── │ │
│ │ High ⏰ │ │ │ │ Med     │ │ │ │ Low      │ │ │ │ Done    │ │
│ │ User A  │ │ │ │ User B  │ │ │ │ User C   │ │ │ │ User A  │ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
│ │ TASK-46 │ │ │ │ TASK-47 │ │ │ │ TASK-48 │ │ │ │ TASK-49 │ │
│ │ ...     │ │ │ │ ...     │ │ │ │ ...     │ │ │ │ ...     │ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
│             │ │             │ │             │ │             │
│ [+ Add]     │ │ [+ Add]     │ │ [+ Add]     │ │ [+ Add]     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

- Horizontal scroll for many columns
- Drag and drop between columns (dnd-kit)
- Smooth animation on card movement
- Column collapse/expand
- WIP limits (optional, configured per column)
- Card count badge at column header

### Task Card

```
┌────────────────────────────────┐
│ TASK-1042  ● High  🔥          │ (Task ID + Priority indicator)
│                                │
│ Implement OAuth SSO flow       │ (Title - bold, truncated)
│                                │
│ Fix: The login page crashes... │ (Description - 2 line clamp)
│                                │
│ ┌─────────┐ ┌──────┐ ┌──────┐ │
│ │ Bug     │ │ Auth │ │ Urg  │ │ (Labels / Tags)
│ └─────────┘ └──────┘ └──────┘ │
│                                │
│ 👤 User A   📅 Feb 15  ⏱ 12h │ (Assignee, Due date, Est. hours)
│                                │
│ 💬 3  📎 2  📋 5/8  ⏲️ 4h    │ (Comments, Attachments, Checklist, Logged)
└────────────────────────────────┘
```

- Hover state: subtle elevation increase
- Drag state: slight rotation + shadow
- Compact mode available for dense views
- Color-coded left border by status

### Task Detail View

```
┌──────────────────────────────────────────────────────────────┐
│ [← Back to Tasks]  TASK-1042     ● Open   ● High  ★ Watch   │
│ ─────────────────────────────────────────────────────────── │
│                          │                                  │
│  Implement OAuth SSO     │  Status:  [Open ▼]               │
│  ────────────────────────│  Priority: [High ▼]              │
│                          │  Assignee: [User A ▼]            │
│  Rich text content...   │  Project: [Auth System]           │
│  ▌                      │  Due Date: [Feb 20, 2026]         │
│                          │  Labels:  [Bug] [Auth] [Urgent]  │
│  ─────────────────────── │  ─────────────────────────────── │
│  ACTIVITY                │  DETAILS                          │
│                          │  ─────────────────────────────── │
│  [Write a comment...]   │  Created: Feb 10 by Admin       │
│  ─────────────────────── │  Estimated: 12h                  │
│  User A commented 2h ago│  Logged: 4h                       │
│  > Agreed, let's proceed│  Department: Engineering          │
│                          │  Team: Backend                    │
│  User B changed status   │  ─────────────────────────────── │
│  to "In Progress"        │  CHECKLIST (5/8)                  │
│                          │  ☑ Research auth providers       │
│  System logged status    │  ☐ Implement Google OAuth        │
│  change                  │  ☐ Implement Microsoft OAuth     │
│                          │  ☐ ...                           │
│                          │  ─────────────────────────────── │
│                          │  ATTACHMENTS (2)                  │
│                          │  📎 oauth-flow.png 2.4MB         │
│                          │  📎 requirements.pdf 1.2MB        │
│                          │  ─────────────────────────────── │
│                          │  DEPENDENCIES                     │
│                          │  🔒 Blocked by: TASK-1039         │
│                          │  ◀ Relates to: TASK-1045          │
└──────────────────────────────────────────────────────────────┘
```

- Two-column layout (Main | Sidebar)
- Main: Rich text editor (TipTap) + Activity feed
- Sidebar: Metadata, checklist, attachments, dependencies
- Activity feed shows: comments, status changes, assignments, all in chronological order
- Internal notes visually distinct (yellow background, lock icon)

---

## Page Layouts

### Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                  [📅 This Week ▼] [👤 My Tasks]   │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │Tasks │ │Due   │ │In    │ │Over- │ │Prod. │              │
│ │ 42   │ │Today │ │Progr.│ │due   │ │98%   │              │ → KPI Cards
│ │Total │ │ 8    │ │ 15   │ │ 3    │ │↑5%   │              │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
│                                                              │
│ ┌─────────────────────────────────┐ ┌──────────────────────┐│
│ │ Task Health Chart               │ │ Workload Overview    ││
│ │ [Burndown chart - Treemotion]   │ │ [Bar chart - Tremor] ││
│ └─────────────────────────────────┘ └──────────────────────┘│
│                                                              │
│ ┌─────────────────────────────────┐ ┌──────────────────────┐│
│ │ Recent Activity                 │ │ Notifications        ││
│ │ • TASK-1042 status → In Prog   │ │ • Task assigned to   ││
│ │ • TASK-1039 completed by User  │ │   you: Auth SSO      ││
│ │ • User C left comment on...     │ │ • TASK-1041 overdue  ││
│ │ ...                             │ │ ...                  ││
│ └─────────────────────────────────┘ └──────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Upcoming Deadlines (Calendar Mini)                        ││
│ │ Mon 10  ● Task A  ● Task B        Tue 11  ● Task C      ││
│ └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Empty States

```
┌────────────────────────────────────┐
│                                    │
│         🎯 (Illustration)          │
│                                    │
│     No tasks yet in this project   │
│                                    │
│   Create your first task to get    │
│   started on this project.         │
│                                    │
│     ┌────────────────────┐         │
│     │  + Create Task     │         │
│     └────────────────────┘         │
│                                    │
│     Or learn about task management │
└────────────────────────────────────┘
```

Each empty state:

- Custom illustration (not generic)
- Clear, contextual message
- Primary CTA button
- Secondary "learn more" link
- Slight animation on mount

---

## Micro-interactions

### Loading States

- **Skeleton loaders** for all list/card views (pulsing with brand color)
- **Spinner** only for in-line actions (saving, submitting)
- **Progress bar** at top of page for page transitions (Next.js native)
- **Optimistic updates** for task status changes, comments (no loading state needed)

### Animations

```css
/* Card hover */
.task-card {
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}
.task-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

/* Sidebar collapse */
.sidebar {
  transition: width var(--transition-normal);
}

/* Status change badge flash */
.status-badge {
  animation: pulse 0.3s ease-in-out;
}

/* Modal enter/exit */
.modal-enter {
  animation: scale-in 0.2s ease-out;
}
.modal-exit {
  animation: scale-out 0.15s ease-in;
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Drag animation */
.dragging {
  opacity: 0.8;
  transform: rotate(3deg);
  z-index: 100;
}
```

---

## Glass Effects (Subtle)

```css
/* For modals, dropdowns, and command palette */
.glass-effect {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .glass-effect {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Subtle gradient backgrounds for cards */
.card-gradient {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
}
```

---

## Responsive Breakpoints

```css
/* Tailwind defaults + custom enterprise breakpoints */
sm:  640px   /* Mobile landscape */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Ultra-wide */

/* Responsive behaviors */
/* Mobile: single column, bottom navigation */
/* Tablet: 2-column layouts */
/* Desktop: 3-column layouts (board, sidebar) */
/* Ultra-wide: max-width containers, centered */
```

---

## Accessibility (WCAG 2.2 AA)

| Requirement         | Implementation                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| Color contrast      | All text: 4.5:1 minimum. Large text: 3:1. Interactive elements: 3:1     |
| Keyboard navigation | Full tab order, arrow keys for Kanban, Space for checkboxes             |
| Focus indicators    | 3px brand-colored outline, never `outline: none`                        |
| Screen readers      | ARIA labels on all interactive elements, live regions for notifications |
| Reduced motion      | `prefers-reduced-motion` disables all animations                        |
| Touch targets       | Minimum 44x44px for all interactive elements                            |
| Error announcements | `role="alert"` on form errors                                           |

---

## Keyboard Shortcuts

| Shortcut  | Action                          |
| --------- | ------------------------------- |
| `⌘K`      | Command palette                 |
| `⌘B`      | Toggle sidebar                  |
| `⌘N`      | New task                        |
| `⌘P`      | Quick project switcher          |
| `⌘I`      | Back to inbox / notifications   |
| `⌘Enter`  | Submit / Save                   |
| `⌘Z`      | Undo (optimistic update revert) |
| `Shift+C` | Quick comment                   |
| `Shift+A` | Assign task                     |
| `E`       | Edit task title                 |
| `Esc`     | Close modal / deselect          |
| `?`       | Show keyboard shortcuts         |
| `↑↓`      | Navigate list items             |
| `Space`   | Open task detail                |
