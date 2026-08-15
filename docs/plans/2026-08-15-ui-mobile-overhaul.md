# EquiNav Mobile UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the app to a mobile-only layout and match the visual mockups from `EquiNav UI ex - akke` exactly.

**Architecture:** Apply a centralized mobile container wrapper on desktop screens to simulate a mobile device viewport while maintaining a full-screen background map, and rebuild each sidebar tab panel to follow the spacing, typography, and element structure in the UI images.

**Tech Stack:** HTML5, Vanilla CSS, Leaflet.js, Vanilla Javascript

---

### Task 1: CSS Viewport & Container Setup (Mobile-Only Mode)

**Files:**
- Modify: `index.css` (lines 1450-1500)
- Verify: `index.html` (view on desktop and mobile)

**Step 1: Convert Desktop Layout to Width-Constrained Center Container**
Instead of the desktop floating sidebar on the left and map on the right, rewrite the desktop media query in `index.css` so that on desktop screens, the mobile bottom sheet (sidebar) is rendered as a center-aligned mobile viewport (max-width: 440px) at the bottom of the screen, with the map taking the full background.

Modify the desktop media query in `index.css`:
```css
@media (min-width: 769px) {
    .sidebar {
        width: 440px;
        left: 50% !important;
        transform: translateX(-50%) translateY(40dvh);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        height: 100dvh;
    }
    
    .sidebar.state-collapsed {
        transform: translateX(-50%) translateY(calc(100dvh - 60px)) !important;
    }

    .sidebar.state-peek {
        transform: translateX(-50%) translateY(40dvh) !important;
    }

    .sidebar.state-expanded {
        transform: translateX(-50%) translateY(0) !important;
    }

    .bottom-sheet-handle {
        display: block !important;
    }
}
```

**Step 2: Commit**
```bash
git add index.css
git commit -m "style: constrain viewport to mobile-only style on all screen sizes"
```

---

### Task 2: Home Tab Overhaul (`tab-home`)

**Files:**
- Modify: `index.html` (lines 35-140)
- Modify: `index.css` (around home page styles)

**Step 1: Update Logo & Header Layout**
Add the green rounded square icon with a horse head (inline SVG) and the title "EquiNav", and add a notification bell icon with a red dot.

```html
<header class="sidebar-header flex justify-between items-center">
    <div class="logo-wrapper">
        <div class="logo-icon-box">
            <svg viewBox="0 0 24 24" class="logo-svg">
                <!-- SVG Horse head shape -->
                <path d="M19,10 C19,12 18,14 16,14 L14,14 L12,18 C12,18 10,19 9,17 L9,14 C8,14 6,13 5,10 C4,7 6,4 10,4 C14,4 19,7 19,10 Z" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
        </div>
        <span class="logo-text">EquiNav</span>
    </div>
    <button class="btn-notifications">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="dot-badge"></span>
    </button>
</header>
```

**Step 2: Update "Planera din rutt" Card**
- Add soft green "NYTT" badge.
- Add dot and pin icons to the inputs, location search crosshairs, and swap locations button.
- Make the main button green `#345735` with path icon.

**Step 3: Update "Om oss" Card**
- Use dark forest green background (`#1b3222`).
- Add "OM OSS" badge and clean "Läs mer om oss ->" link.

**Step 4: Update "Senaste rutter" Card**
- Layout cards with a soft green icon box background and right chevrons exactly as shown in `Equi hemskärm.png`.

**Step 5: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Home tab to match Equi hemskärm.png mockup"
```

---

### Task 3: Weight Calculator Tab Overhaul (`tab-calculator`)

**Files:**
- Modify: `index.html` (lines 265-425)
- Modify: `index.css` (calculator styles)

**Step 1: Re-arrange input forms**
- Place REGNR BIL and REGNR SLÄP side-by-side on a single row.
- Style "Hästens vikt" input with a suffix label `kg` inside the field.

**Step 2: Redesign Driver's License Selector**
- Create large radio button selector cards for "B-kort" and "B96 (utökad)".
- When selected, apply a green border, soft green background, and a green checked icon exactly like `Equi viktkalkyl.png`.

**Step 3: Redesign check results**
- Style the result panel as a soft green container with centered green text: "Kombinationen är laglig för ditt körkort."

**Step 4: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Weight Calculator tab to match Equi viktkalkyl.png mockup"
```

---

### Task 4: Road Hazards Tab Overhaul (`tab-hazards`)

**Files:**
- Modify: `index.html` (lines 428-475)
- Modify: `index.css` (hazard styles)

**Step 1: Update Add Hazard Card**
- Set up HINDERTYP select dropdown with custom icon inside.
- Style button: "Spara hinder på kartan".

**Step 2: Update Hazard List Items**
- Style reported hazards as rounded list items with a soft colored square background for icons (e.g. orange for Bump, light green for Narrow Passage).

**Step 3: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Road Hazards tab to match Equi väghinder.png mockup"
```

---

### Task 5: Akut SOS Tab Overhaul (`tab-emergency`)

**Files:**
- Modify: `index.html` (lines 478-506)
- Modify: `index.css` (emergency styles)

**Step 1: Update SOS Header Card**
- Large solid red background with a rounded white SOS icon inside a circular container.

**Step 2: Update Clinic Cards**
- Card left-border accent in red for the closest clinic.
- Badges showing distance in red (`#34,8 km`) or gray.
- Add dual actions: "Ring jour" (white button) and "Hitta hit" (dark solid button).

**Step 3: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Emergency SOS tab to match Equi akut sos.png mockup"
```

---

### Task 6: Profile & Saved Tabs Overhaul (`tab-profile`, `tab-saved`)

**Files:**
- Modify: `index.html` (lines 509-550)
- Modify: `index.css` (profile and saved styles)

**Step 1: Profile Header**
- Avatar icon inside a green circular box.
- Guest login subtitle.

**Step 2: Settings Group list**
- Group "Mina fordon", "Notiser", "Hjälp & support" inside a unified card with outline border and chevron right links.

**Step 3: Saved Routes list**
- Card listings matching the mockups in `Equi sparade rutter.png`.

**Step 4: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Profile and Saved tabs to match mockups"
```

---

### Task 7: Live Navigation HUD Overhaul (`navigation-hud`)

**Files:**
- Modify: `index.html` (navigation HUD section)
- Modify: `index.css` (navigation UI styles)

**Step 1: Top Navigation Banner**
- Dark green background banner showing remaining distance guidance and direction arrow.

**Step 2: Swedish Speed Limit Sign**
- Red border circular sign for maximum speed (`80`).
- Black capsule showing current GPS speed (`74 km/h`).

**Step 3: Bottom Statistics sheet**
- Clean bottom sheet card showing "2h 45m" large text, total distance, arrival time, and a red "Avsluta rutt" button.

**Step 4: Commit**
```bash
git add index.html index.css
git commit -m "style: overhaul Live Navigation HUD to match Equi live-navigering.png mockup"
```

---

### Task 8: Cache Bump and Vercel Deploy

**Files:**
- Modify: `sw.js` (bump cache to v15)
- Modify: `index.html` (bump query parameters to v1910)

**Step 1: Bump Cache**
```javascript
const CACHE_NAME = 'equinav-cache-v15';
// update queries in assets list
```

**Step 2: Run Vercel Deploy**
Run: `vercel --prod --yes`

**Step 3: Commit**
```bash
git commit -am "chore: bump cache and deploy mobile UI overhaul to production"
```
