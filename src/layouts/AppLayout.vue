<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const auth = useAuthStore()
const router = useRouter()

async function keluar() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="border-b bg-white">
    <div class="max-w-5xl mx-auto p-4 flex items-center justify-between gap-4">
      <span class="font-bold text-lg">SIAP OSN</span>
      <div class="flex items-center gap-2">
        <span>{{ auth.user?.nama }}</span>
        <Tag :value="auth.user?.role" severity="info" />
        <Button label="Keluar" severity="secondary" size="small" @click="keluar" />
      </div>
    </div>
  </header>
  <main class="max-w-5xl mx-auto p-4">
    <RouterView />
  </main>
</template>
