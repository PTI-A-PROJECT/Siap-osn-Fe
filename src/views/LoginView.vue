<script setup>
import { ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth.js'
import { dashboardFor } from '@/router/index.js'
import { pesanError } from '@/lib/errors.js'
import FormField from '@/components/FormField.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const loading = ref(false)

function validasi() {
  emailError.value = ''
  passwordError.value = ''
  if (!email.value) emailError.value = 'Email wajib diisi'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) emailError.value = 'Format email tidak valid'
  if (!password.value) passwordError.value = 'Password wajib diisi'
  return !emailError.value && !passwordError.value
}

async function masuk() {
  if (!validasi()) return
  loading.value = true
  try {
    const user = await auth.login({ email: email.value, password: password.value })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    router.push(redirect ?? dashboardFor(user.role))
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Login gagal', detail: pesanError(err), life: 4000 })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <h1 class="text-xl font-bold mb-4">Masuk SIAP OSN</h1>
  <form class="flex flex-col gap-3" @submit.prevent="masuk">
    <FormField v-model="email" input-id="email" label="Email" :error="emailError" />
    <FormField v-model="password" input-id="password" label="Password" type="password" :error="passwordError" />
    <Button type="submit" label="Masuk" :loading="loading" />
  </form>
  <p class="mt-4 text-sm">
    Belum punya akun?
    <RouterLink to="/register" class="text-blue-600 underline">Daftar</RouterLink>
  </p>
</template>
