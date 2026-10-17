# Listing badge examples

For a project listed on Vibe GNOME, place this below your README title:

```markdown
[![Listed on Vibe GNOME](https://vibe-gnome.org/badges/listed-on-vibe-gnome-light.svg)](https://vibe-gnome.org)
```

For a website:

```html
<a href="https://vibe-gnome.org">
  <img
    src="https://vibe-gnome.org/badges/listed-on-vibe-gnome-light.svg"
    alt="Listed on Vibe GNOME"
    width="228" height="64"
  />
</a>
```

Use `listed-on-vibe-gnome-dark.svg` for the dark version. Replace the outer link
destination with your published listing URL to link directly to your project;
keep the image source unchanged. For example, if your published app listing URL
is `https://vibe-gnome.org/apps/31/notebook`, the Markdown is:

```markdown
[![Listed on Vibe GNOME](https://vibe-gnome.org/badges/listed-on-vibe-gnome-light.svg)](https://vibe-gnome.org/apps/31/notebook)
```

For an extension, use its listing URL, such as
`https://vibe-gnome.org/extensions/42/quick-notes`, as the outer destination in
either format. These listing URLs are illustrative; use your actual published
listing.

The guide at `/guides/badge` generates these links for you: enter your app or
extension name, select its matching listing, then choose your badge and format.
Leave the name blank for a homepage link.
