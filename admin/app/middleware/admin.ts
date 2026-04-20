export default defineNuxtRouteMiddleware(async (_to, _from) => {
  const { user, checkAuth } = useAuth()

  let currentUser = user.value
  if (!currentUser) {
    currentUser = await checkAuth()
  }

  if (!currentUser) {
    return navigateTo('/login')
  }

  if (!currentUser.permissions?.includes('admin.access')) {
    return navigateTo('/')
  }
})
