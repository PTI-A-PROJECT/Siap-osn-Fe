<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth.js'
import { pesanError } from '@/lib/errors.js'
import FormField from '@/components/FormField.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const nama = ref('')
const email = ref('')
const password = ref('')
const konfirmasi = ref('')
const namaError = ref('')
const emailError = ref('')
const passwordError = ref('')
const konfirmasiError = ref('')
const loading = ref(false)

function validasi() {
  namaError.value = ''
  emailError.value = ''
  passwordError.value = ''
  konfirmasiError.value = ''
  if (nama.value.trim().length < 3) namaError.value = 'Nama minimal 3 karakter'
  if (!email.value) emailError.value = 'Email wajib diisi'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) emailError.value = 'Format email tidak valid'
  if (password.value.length < 8) passwordError.value = 'Password minimal 8 karakter'
  if (konfirmasi.value !== password.value) konfirmasiError.value = 'Konfirmasi password tidak sama'
  return !namaError.value && !emailError.value && !passwordError.value && !konfirmasiError.value
}

async function daftar() {
  if (!validasi()) return
  loading.value = true
  try {
    await auth.register({ nama: nama.value, email: email.value, password: password.value })
    toast.add({ severity: 'success', summary: 'Registrasi berhasil', detail: 'Silakan masuk dengan akun baru', life: 4000 })
    router.push('/login')
  } catch (err) {
    if (err?.response?.status === 400 && err?.response?.data?.message === 'Email sudah terdaftar') {
      emailError.value = 'Email sudah terdaftar'
    } else {
      toast.add({ severity: 'error', summary: 'Registrasi gagal', detail: pesanError(err), life: 4000 })
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <h1 class="text-xl font-bold mb-4">Daftar Akun Siswa</h1>
  <form class="flex flex-col gap-3" @submit.prevent="daftar">
    <FormField v-model="nama" input-id="nama" label="Nama" :error="namaError" />
    <FormField v-model="email" input-id="email" label="Email" :error="emailError" />
    <FormField v-model="password" input-id="password" label="Password" type="password" :error="passwordError" />
    <FormField v-model="konfirmasi" input-id="konfirmasi" label="Konfirmasi Password" type="password" :error="konfirmasiError" />
    <Button type="submit" label="Daftar" :loading="loading" />
  </form>
  <p class="mt-4 text-sm">
    Sudah punya akun?
    <RouterLink to="/login" class="text-blue-600 underline">Masuk</RouterLink>
  </p>
</template>
