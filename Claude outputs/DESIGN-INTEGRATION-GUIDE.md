# Tech'Cars Redesign Integration Guide

## Overview
This guide provides step-by-step instructions to integrate the new automotive-technology focused design system into the Monauto frontend.

## Design System Summary

### Color Tokens (CSS Variables)
```css
/* Primary Colors */
--color-primary: #2E5090 (Blue Steel)
--color-primary-dark: #1F3A5F
--color-primary-light: #3A5BA8

/* Accent */
--color-accent: #F97316 (Warm Orange)

/* Surfaces */
--color-surface: #FFFFFF (light mode)
--color-surface-alt: #F8F9FB

/* Text */
--color-text-primary: #1F3A5F
--color-text-secondary: #4A5063
--color-text-muted: #6B7280
```

### Typography System
- **Display**: Syne (Google Fonts) - Headlines, titles
- **Body**: Inter (Google Fonts) - Body text, UI elements
- **Font Sizes**: 5-level scale from xs (0.75rem) to 5xl (3rem)

### Spacing & Layout
- **Spacing Scale**: xs (0.25rem) → 3xl (4rem)
- **Grid**: Mobile-first with CSS Grid
- **Max Width**: 1200px container
- **Padding**: 16px minimum side gutter on all screens

## File Structure

```
app/
├── (fr)/
│   ├── page.tsx (REPLACE with page-fr-redesigned.tsx)
│   └── layout.tsx (reference provided as layout-root.tsx)
│
styles/
└── globals.css (NEW - add this file)

components/
├── Header.tsx (existing - no changes needed)
└── ArticleCard.tsx (should use CSS classes from globals.css)
```

## Step-by-Step Integration

### Step 1: Add Global Styles
1. Create `app/styles/globals.css` in your project
2. Copy the contents from `globals.css` provided
3. This file includes:
   - CSS variables for design tokens
   - Base element styles (typography, links, etc.)
   - Component classes (.btn, .card, .grid, etc.)
   - Dark mode support
   - Responsive breakpoints

### Step 2: Update Root Layout
1. Update `app/layout.tsx` (or `app/(fr)/layout.tsx`) with:
   - Import `@/styles/globals.css`
   - Add Google Fonts preconnect and link tags
   - Include anti-FOUC theme script
   - Example provided in `layout-root.tsx`

2. Key additions:
   ```tsx
   // Fonts
   <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
   
   // Anti-FOUC script
   <script dangerouslySetInnerHTML={{...}} />
   ```

### Step 3: Update HomePage
1. Replace `app/(fr)/page.tsx` with `page-fr-redesigned.tsx`
2. Key changes:
   - Hero section now uses `.chero` class instead of inline styles
   - Category cards use `.silo` class
   - Section layout uses `.section` and `.wrap` classes
   - Trust section has `.trust-grid` class
   - Newsletter section uses `.nl-band` class

### Step 4: Update ArticleCard Component
The ArticleCard component should be updated to use the provided CSS classes:

```tsx
export default function ArticleCard({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}/`} className="article-card">
      {post.featuredImage && (
        <img src={post.featuredImage} alt={post.title} className="article-card__image" />
      )}
      <div className="article-card__content">
        <span className="article-card__category">{post.category}</span>
        <h3 className="article-card__title">{post.title}</h3>
        <p className="article-card__excerpt">{post.excerpt}</p>
        <div className="article-card__meta">
          <span>{post.author}</span>
          <span>{formatDate(post.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
```

### Step 5: Update Header (if needed)
The existing Header.tsx should work as-is with the new CSS. If you want to enhance it:
- Add theme toggle button (optional)
- The `.appbar` class is already styled
- The `.chip` class is applied to navigation items

### Step 6: Dark Mode Implementation
The design system includes built-in dark mode support via:
1. **System preference**: Uses `prefers-color-scheme: dark`
2. **User preference**: Stored in `localStorage` with `data-theme` attribute
3. **CSS**: All colors defined as CSS variables that update automatically

To add a theme toggle:
```tsx
function ThemeToggle() {
  const toggleTheme = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };
  
  return <button onClick={toggleTheme}>Toggle Theme</button>;
}
```

## Responsive Breakpoints

The CSS includes mobile-first responsive design:

- **Default**: Mobile (< 480px)
- **md**: Tablet (> 768px)
- **lg**: Desktop (> 1024px)

Key breakpoints applied:
- Hero section adjusts padding and font size
- Grid columns stack on mobile, expand on desktop
- AppBar layout changes for mobile
- Buttons become full-width on mobile

## CSS Classes Reference

### Layout Classes
- `.wrap` - Max-width container (1200px)
- `.section` - Vertical padding wrapper
- `.flex`, `.flex--center`, `.flex--between`, `.flex--col` - Flex utilities
- `.grid`, `.grid--cols-2`, `.grid--cols-3` - Grid layout

### Component Classes
- `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--accent` - Buttons
- `.card` - Card component
- `.chip` - Chip/badge component
- `.appbar`, `.appbar__nav`, `.appbar__actions` - Header
- `.chero`, `.chero__title`, `.chero__sub` - Hero section
- `.silo`, `.silo__name`, `.silo__desc` - Category card
- `.article-card`, `.article-card__title`, `.article-card__excerpt` - Article card
- `.trust-grid`, `.trust` - Trust section
- `.nl-band` - Newsletter section

## Color Usage Examples

```tsx
// Using CSS variables in React components
<div style={{ color: 'var(--color-primary)' }}>
  Text in primary color
</div>

// Or use the pre-built classes
<h2 style={{ color: 'var(--color-primary-dark)' }}>
  Darker heading
</h2>
```

## Testing Checklist

After integration, test the following:

- [ ] Hero section displays correctly with gradient background
- [ ] All 5 category cards render and are clickable
- [ ] Dark mode toggle works (if implemented)
- [ ] Responsive layout works on mobile (< 480px)
- [ ] Responsive layout works on tablet (768px)
- [ ] Responsive layout works on desktop (1024px+)
- [ ] Links change color on hover
- [ ] Cards have shadow on hover
- [ ] Newsletter section is readable with white text
- [ ] Footer displays properly
- [ ] Google Fonts load correctly
- [ ] No CLS (Cumulative Layout Shift) on load
- [ ] Print styles hide navigation (media print)
- [ ] Accessibility: Tab through interactive elements
- [ ] Accessibility: Focus visible on all interactive elements

## Browser Support

The design system supports:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

CSS Variables are supported in all modern browsers.

## Performance Notes

1. **Font Loading**: Fonts are loaded with `display=swap` for optimal performance
2. **CSS**: Single stylesheet (no CSS-in-JS overhead)
3. **Variables**: CSS variables have minimal performance impact
4. **Colors**: Hardware-accelerated for smooth transitions
5. **Images**: Use WebP format where possible

## Migration Path

### For existing components:
1. Keep component structure as-is
2. Update className attributes to use new classes
3. Remove inline styles (use CSS variables instead)
4. Update color values to use token variables

### Example before/after:
```tsx
// Before
<h2 style={{ color: "#1F3A5F" }}>Title</h2>

// After
<h2>Title</h2>  // Uses --color-text-primary by default
```

## Support & Troubleshooting

### Dark mode not working?
- Ensure anti-FOUC script is in `<head>`
- Check browser DevTools: `document.documentElement.getAttribute('data-theme')`
- Clear localStorage if needed: `localStorage.clear()`

### Fonts not loading?
- Check Network tab for Google Fonts requests
- Ensure `rel="preconnect"` links are present
- Verify `display=swap` parameter is set

### Colors look off?
- Check CSS variables: `getComputedStyle(document.documentElement)`
- Verify dark mode is not accidentally enabled
- Clear browser cache and reload

### Layout issues?
- Check `.wrap` container max-width
- Verify side padding is applied (16px minimum)
- Test on actual mobile device (not just browser resize)

## Next Steps

1. ✅ Copy `globals.css` to `app/styles/`
2. ✅ Update root layout with fonts and scripts
3. ✅ Replace `app/(fr)/page.tsx` with redesigned version
4. ✅ Update ArticleCard component (if using inline styles)
5. ✅ Test all responsive breakpoints
6. ✅ Test dark mode functionality
7. ✅ Deploy to staging for review
8. ✅ Get stakeholder feedback
9. ✅ Deploy to production

## Questions?

Reference the `techcars-redesign.html` artifact for the complete visual design and layout examples.
