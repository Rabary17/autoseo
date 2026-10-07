# Quick Start: Design System Integration (5-Minute Setup)

**Time to Deploy:** 5 minutes (technical setup only)

## Step 1: Copy Files (2 minutes)

```bash
# From your monauto project root:

# Create styles directory
mkdir -p app/styles

# Copy the stylesheet
cp globals.css app/styles/

# Backup current homepage
cp app/\(fr\)/page.tsx app/\(fr\)/page.tsx.backup

# Copy new homepage
cp page-fr-redesigned.tsx app/\(fr\)/page.tsx
```

## Step 2: Update Root Layout (2 minutes)

In `app/layout.tsx` or `app/(fr)/layout.tsx`, add:

```tsx
// At the top of the file
import "@/styles/globals.css";

// In the <head> section, add these:
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>

// Add anti-FOUC script before </head>
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          const theme = localStorage.getItem('theme') || 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        } catch (e) {}
      })();
    `,
  }}
/>
```

## Step 3: Test Locally (1 minute)

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
# ✅ Homepage should display with new design
# ✅ Dark mode should work automatically (matches your system preference)
# ✅ Navigation should be sticky at top
```

## Step 4: Test Mobile

Resize browser to:
- [ ] 320px width (mobile)
- [ ] 768px width (tablet)
- [ ] 1024px+ width (desktop)

All sections should reflow correctly.

## ✅ Done!

Your design system is now active. All CSS classes are available throughout your app.

---

## Common Issues & Fixes

### Issue: Fonts not loading
**Fix:** Check Network tab in DevTools. Ensure `fonts.googleapis.com` is reachable.

### Issue: Dark mode looks wrong
**Fix:** Check DevTools: `document.documentElement.getAttribute('data-theme')` should be `'dark'` or not set.

### Issue: Layout looks broken on mobile
**Fix:** Check that your layout doesn't have fixed widths. Use `flex`, `grid`, or responsive classes.

### Issue: Colors are different
**Fix:** Check CSS variables: `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')`

---

## Next: Update Components (Optional, 30 mins)

If you have existing components using inline styles, update them:

**Before:**
```tsx
<h2 style={{ color: "#1F3A5F" }}>Title</h2>
```

**After:**
```tsx
<h2>Title</h2>  {/* Uses --color-text-primary automatically */}
```

---

## Reference Quick Lookup

### Most Used Classes
```css
.wrap            /* Container (max 1200px) */
.section         /* Vertical padding */
.btn             /* Button (add --primary, --secondary, --accent) */
.card            /* Card component */
.flex            /* Flexbox utilities */
.grid            /* CSS Grid utilities */
.chero           /* Hero section */
.silo            /* Category card */
.article-card    /* Article card */
.trust-grid      /* Trust section grid */
```

### Most Used Variables
```css
var(--color-primary)        /* #2E5090 */
var(--color-accent)         /* #F97316 */
var(--color-text-primary)   /* #1F3A5F / #F3F4F6 (dark) */
var(--spacing-lg)           /* 1.5rem */
var(--font-display)         /* Syne */
var(--font-body)            /* Inter */
```

---

## Testing Checklist

Quick validation before pushing to production:

- [ ] Fonts load (check Network tab)
- [ ] Hero displays with gradient background
- [ ] Categories are clickable and have hover effect
- [ ] Articles grid is responsive
- [ ] Dark mode works (toggle system preference)
- [ ] Mobile layout stacks correctly (< 480px)
- [ ] Tablet layout wraps correctly (768px)
- [ ] Desktop layout fills screen width (1024px+)
- [ ] Buttons have proper hover/focus states
- [ ] No console errors

---

## Full Documentation

For detailed information, see:
- `DESIGN-INTEGRATION-GUIDE.md` — Complete CSS class reference
- `design-system-implementation-checklist.md` — Full implementation phases
- `techcars-redesign.html` — Visual reference (open in browser)

---

## That's It!

You now have:
✅ Modern automotive-tech design  
✅ Dark mode support  
✅ Responsive on all devices  
✅ Accessibility built-in  
✅ No additional dependencies  

**Next:** Deploy to staging and get stakeholder feedback.
