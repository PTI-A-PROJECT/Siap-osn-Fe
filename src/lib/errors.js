// Ambil pesan Bahasa Indonesia dari envelope error backend:
// { success: false, message: "..." } — lihat pkg/response di siap-osn-be.
export function pesanError(err, fallback = 'Terjadi kesalahan, coba lagi') {
  return err?.response?.data?.message ?? fallback
}
