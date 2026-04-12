<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <div class="flex justify-end p-4">
      <ThemeToggle />
    </div>
    <div class="text-center py-16 px-4">
      <h1 class="text-4xl font-bold text-(--ui-text) mb-4">Welcome</h1>
      <p class="text-(--ui-text-muted) mb-8 max-w-lg mx-auto">
        Get started by customizing this page.
      </p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})
</script>
