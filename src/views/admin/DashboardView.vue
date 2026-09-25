<script setup>
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useAuthStore } from '@/stores/auth.js'
import { api } from '@/lib/api.js'
import { pesanError } from '@/lib/errors.js'

const auth = useAuthStore()
const toast = useToast()

// Bukti role-guard backend bekerja dari browser:
// hanya super_admin yang bisa lolos RequireRole di GET /admin/ping.
async function tesAksesAdmin() {
  try {
    const { data } = await api.get('/admin/ping')
    toast.add({ severity: 'success', summary: 'Akses admin OK', detail: data.data.message, life: 4000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Akses admin ditolak', detail: pesanError(err), life: 4000 })
  }
}
</script>

<template>
  <h1 class="text-xl font-bold mb-4">Halo, {{ auth.user?.nama }} (Admin)</h1>
  <Card>
    <template #content>
      <p class="mb-3 text-sm text-gray-600">Uji bahwa cookie dan role-guard backend bekerja dari browser.</p>
      <Button label="Tes akses admin" @click="tesAksesAdmin" />
    </template>
  </Card>
</template>
