<script setup>
import { useAuthStore } from '@/stores/auth.js'
import Card from 'primevue/card'

const auth = useAuthStore()
const menu = ['Pretest', 'Materi', 'Simulasi']
</script>

<template>
  <h1 class="text-xl font-bold mb-4">Halo, {{ auth.user?.nama }}</h1>
  <div class="grid gap-3 md:grid-cols-3">
    <Card v-for="item in menu" :key="item">
      <template #title>{{ item }}</template>
      <template #content>
        <p class="text-sm text-gray-500">Segera hadir.</p>
      </template>
    </Card>
  </div>
</template>
