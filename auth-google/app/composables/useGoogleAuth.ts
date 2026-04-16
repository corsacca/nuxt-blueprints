declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              width?: number
            }
          ) => void
        }
      }
    }
  }
}

export const useGoogleAuth = () => {
  const config = useRuntimeConfig()
  const clientId = config.public.googleClientId as string
  const isAvailable = computed(() => !!clientId)

  const scriptLoaded = ref(false)
  const initialized = ref(false)

  if (isAvailable.value && import.meta.client) {
    useHead({
      script: [
        {
          src: 'https://accounts.google.com/gsi/client',
          async: true,
          onload: () => { scriptLoaded.value = true },
        },
      ],
    })
  }

  const waitForScript = (): Promise<void> => {
    if (window.google?.accounts?.id) return Promise.resolve()
    return new Promise((resolve) => {
      const stop = watch(scriptLoaded, (loaded) => {
        if (loaded && window.google?.accounts?.id) {
          stop()
          resolve()
        }
      })
    })
  }

  const initialize = async (callback: (credential: string) => void) => {
    if (!isAvailable.value || initialized.value) return
    await waitForScript()
    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => callback(response.credential),
    })
    initialized.value = true
  }

  const renderButton = async (
    element: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill'
    } = {}
  ) => {
    await waitForScript()
    window.google!.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      ...options,
    })
  }

  return {
    isAvailable,
    initialize,
    renderButton,
  }
}
