<script setup>
import Card from 'primevue/card'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.path === '/register'" />

  <main v-else class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
    <Card class="w-full max-w-md">
      <template #content>
        <RouterView />
      </template>
    </Card>
  </main>
</template>
