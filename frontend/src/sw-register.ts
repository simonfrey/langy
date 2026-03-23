import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    // Check for updates every 60 seconds
    setInterval(() => {
      registration.update()
    }, 60 * 1000)

    // Check for updates when app regains focus (critical for iOS homescreen PWAs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update()
      }
    })
  },
  onNeedRefresh() {
    // Auto-reload without prompting
    updateSW(true)
  },
})
