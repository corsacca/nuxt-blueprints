# Kitchen Sink Block

UI component showcase page for development reference. Demonstrates Nuxt UI components, theming, icons, form elements, and layout patterns.

## Dependencies

- `core` (Nuxt UI, theming)

## Files Provided

```
app/pages/kitchen.vue
```

## Package Dependencies

None beyond what `core` provides.

## Wiring Notes

When using with `auth-jwt`, add the auth middleware to protect the page:
```vue
definePageMeta({
  middleware: 'auth'
})
```
