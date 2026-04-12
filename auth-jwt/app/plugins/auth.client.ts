export default defineNuxtPlugin(async () => {
  const { restoreFromCache, checkAuth, setAuthReady } = useAuth()

  restoreFromCache()

  const hasAuthCookie = document.cookie.includes('auth-token')
  if (hasAuthCookie) {
    await checkAuth()
  }

  setAuthReady(true)
})
