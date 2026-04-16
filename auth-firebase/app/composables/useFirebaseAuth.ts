import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth as firebaseGetAuth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  type Auth,
  type AuthProvider,
} from 'firebase/auth'

const providerMap: Record<string, () => AuthProvider> = {
  google: () => new GoogleAuthProvider(),
  github: () => new GithubAuthProvider(),
  apple: () => new OAuthProvider('apple.com'),
  microsoft: () => new OAuthProvider('microsoft.com'),
}

export const providerMeta: Record<string, { label: string; icon: string }> = {
  google: { label: 'Google', icon: 'i-simple-icons-google' },
  github: { label: 'GitHub', icon: 'i-simple-icons-github' },
  apple: { label: 'Apple', icon: 'i-simple-icons-apple' },
  microsoft: { label: 'Microsoft', icon: 'i-simple-icons-microsoft' },
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

export const useFirebaseAuth = () => {
  const config = useRuntimeConfig()
  const apiKey = config.public.firebaseApiKey as string
  const authDomain = config.public.firebaseAuthDomain as string
  const projectId = config.public.firebaseProjectId as string

  const isAvailable = computed(() => !!apiKey && !!authDomain && !!projectId)

  const enabledProviders = computed(() => {
    const raw = (config.public.firebaseAuthProviders as string) || 'google'
    return raw.split(',').map(p => p.trim()).filter(p => p in providerMap)
  })

  const getAuthInstance = (): Auth => {
    if (!app) {
      app = initializeApp({ apiKey, authDomain, projectId })
      auth = firebaseGetAuth(app)
    }
    return auth!
  }

  const signInWithProvider = async (providerName: string): Promise<string> => {
    const createProvider = providerMap[providerName]
    if (!createProvider) {
      throw new Error(`Unknown auth provider: ${providerName}`)
    }

    const authInstance = getAuthInstance()
    const provider = createProvider()
    const result = await signInWithPopup(authInstance, provider)
    return await result.user.getIdToken()
  }

  return {
    isAvailable,
    enabledProviders,
    providerMeta,
    signInWithProvider,
  }
}
