# Design Guidelines: ElizaOS Twitter AI Agent Admin Dashboard

## Design Approach

**Selected Approach:** Design System - Modern Admin Dashboard Pattern

**Justification:** This is a complex, data-intensive admin interface requiring clarity, consistency, and efficiency. Drawing inspiration from Linear, Vercel Dashboard, and Stripe's admin interfaces - systems optimized for information-dense workflows.

**Core Principles:**
- Clarity over decoration
- Information hierarchy through spacing and typography
- Consistent patterns across all pages
- Instant visual feedback for actions
- Scannable layouts for quick navigation

---

## Typography

**Font Family:**
- Primary: Inter (Google Fonts) - for UI elements, labels, body text
- Monospace: JetBrains Mono (Google Fonts) - for code snippets, API keys, JSON data

**Type Scale:**
- Page Titles: `text-2xl font-semibold` (32px)
- Section Headers: `text-lg font-semibold` (20px)
- Card Titles: `text-base font-medium` (16px)
- Body Text: `text-sm` (14px)
- Labels/Captions: `text-xs font-medium uppercase tracking-wide` (12px)
- Helper Text: `text-xs text-gray-500` (12px)

**Hierarchy Rules:**
- Use font weight (medium/semibold) to establish hierarchy, not size jumps
- All caps + letter spacing for category labels only
- Maintain consistent line-height of 1.5 for readability

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 24**

**Application:**
- Component padding: `p-4` or `p-6`
- Section spacing: `mb-8` or `mb-12`
- Card gaps: `gap-6`
- Form field spacing: `space-y-4`
- Page padding: `p-8` or `p-12`

**Grid Structure:**
- Sidebar: Fixed `w-64` (256px)
- Main content: `flex-1` with `max-w-7xl mx-auto`
- Form columns: `grid-cols-1 md:grid-cols-2` for settings
- Card grids: `grid-cols-1 lg:grid-cols-3` for stats/modules

**Page Layout Pattern:**
```
[Sidebar 64] [Main Content Area - fluid with max-width]
```

---

## Component Library

### Navigation
**Sidebar:**
- Fixed left sidebar with logo at top
- Navigation items with icon + label (Heroicons outline style)
- Active state: subtle background treatment
- Group sections: "Settings", "Data", "System"
- Collapse toggle at bottom (optional for mobile)

### Forms & Inputs
**Text Inputs:**
- Border-based design with focus ring
- Label above input: `text-sm font-medium mb-2`
- Helper text below: `text-xs text-gray-500 mt-1`
- Required indicator: red asterisk
- Monospace font for API keys, JSON inputs

**Textarea:**
- Minimum height: `min-h-[120px]`
- Resize vertical only
- Character counter for prompts (e.g., "450/5000")

**Toggle Switches:**
- Use for ON/OFF states (modules, integrations)
- Label to the left of switch
- Status text (ON/OFF) or indicator dot

**Select Dropdowns:**
- Consistent height with text inputs
- Chevron icon on right
- Category selectors, interval pickers

**Buttons:**
- Primary: Solid fill for main actions
- Secondary: Outlined for secondary actions
- Danger: Red variant for delete/restart
- Sizes: `px-4 py-2` (default), `px-6 py-3` (large)
- Icon + text combination where helpful

### Data Display
**Cards:**
- Border-based containers with `rounded-lg`
- Padding: `p-6`
- Header with title + action button
- Use for: KB entries, integration configs, API key groups

**Tables:**
- Clean rows with subtle dividers
- Zebra striping optional for long lists
- Actions column (right-aligned) with icon buttons
- Sticky header for long scrolls
- Use for: Feed data viewer, logs, scheduled posts

**Stats/Metrics:**
- 3-column grid for dashboard overview
- Large number display: `text-3xl font-semibold`
- Label below: `text-sm text-gray-500`
- Icon or status indicator
- Examples: "Posts Today", "API Calls", "Agent Status"

**Status Badges:**
- Small pill-shaped indicators
- Variants: Active (green), Inactive (gray), Error (red), Warning (yellow)
- Use for: module status, integration status, agent health

### Overlays
**Modals:**
- Confirmation dialogs for destructive actions (Delete KB entry, Restart Agent)
- Form modals for adding new entries
- Centered with backdrop
- Max width: `max-w-lg`

**Toast Notifications:**
- Top-right positioned
- Auto-dismiss after 3-5 seconds
- Success, Error, Info variants
- Use for: "Settings saved", "Agent restarted", "API error"

### Special Components
**Code Editor Areas:**
- Syntax highlighting for JSON/prompt editing
- Monospace font
- Line numbers optional
- Dark background variant for code blocks

**Live Data Feed Display:**
- Card-based layout showing latest crypto/news
- Timestamp + source badge
- Refresh button in header
- Scrollable container with max height

**Schedule Builder:**
- Visual time picker
- Frequency selector (hourly, daily, custom interval)
- Preview text: "Posts every 2 hours"

---

## Page-Specific Layouts

### Dashboard (Home)
- Stats grid (3-4 cards): Agent Status, Posts Today, API Health
- Recent activity feed
- Quick action cards: "Restart Agent", "View Latest Feeds"

### Prompts Editor
- Tabbed interface or accordion for different prompt types
- Each section: label + textarea + character count
- "Save All Prompts" button at bottom (sticky)

### Knowledge Base
- Search/filter bar at top
- "Add Entry" button (top right)
- List/grid of KB entries as cards
- Each card: category tag, truncated text, edit/delete icons

### API Keys
- Grouped by service (Twitter, AI Models, Crypto APIs, News)
- Masked input fields with "Show/Hide" toggle
- "Test Connection" button per key
- Status indicator

### Behaviour & Schedules
- Two-column form layout
- Left: Posting schedule controls
- Right: Module toggles with descriptions
- Rate limit sliders

### Integrations
- Tabs: "Crypto Sources" | "News Sources"
- Add integration button opens modal
- Each integration as expandable card showing: URL, fetch interval, ON/OFF toggle, parsing config

### Live Feeds Viewer
- Real-time display of latest fetched data
- Filter by source
- Refresh button + auto-refresh toggle
- Table or card layout with timestamps

---

## Accessibility
- All interactive elements keyboard navigable
- Focus states visible on all inputs and buttons
- ARIA labels for icon-only buttons
- Form validation with clear error messages
- Sufficient contrast ratios throughout

---

## Images
**No hero images needed** - this is a utility dashboard. Any graphics should be:
- Icons in navigation and cards (Heroicons)
- Optional: Empty state illustrations for "No KB entries yet"
- Optional: Agent avatar/logo in header