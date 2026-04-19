import { useState, useEffect } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [visitCount, setVisitCount] = useState(0)

  useEffect(() => {
    // Track session count (increments per page load)
    const sessionCount = parseInt(localStorage.getItem('pwa_session_count') || '0') + 1
    localStorage.setItem('pwa_session_count', sessionCount.toString())
    setVisitCount(sessionCount)

    // Check if dismissed in this session cycle
    const lastDismissSession = parseInt(localStorage.getItem('pwa_last_dismiss_session') || '0')

    // Show again at session 3 even if dismissed before
    if (sessionCount >= 3 && lastDismissSession < 3) {
      setDismissed(false)
    } else if (lastDismissSession > 0 && sessionCount < 3) {
      // Still dismissed in sessions 1-2 after first dismiss
      setDismissed(true)
    }
  }, [])

  const handleInstall = async () => {
    setIsInstalling(true)
    const success = await install()
    setIsInstalling(false)

    if (success) {
      console.log('PWA installed successfully')
      // Mark as permanently dismissed after successful install
      localStorage.setItem('pwa_permanently_dismissed', 'true')

      // Animate out before dismissing
      setIsDismissing(true)
      setTimeout(() => {
        setDismissed(true)
      }, 300)
    }
  }

  const handleDismiss = () => {
    setIsDismissing(true)
    setTimeout(() => {
      setDismissed(true)
      // Save which session user dismissed at
      localStorage.setItem('pwa_last_dismiss_session', visitCount.toString())
    }, 300)
  }

  // Don't show if already installed
  if (isInstalled) {
    return null
  }

  // Don't show if permanently dismissed (after install)
  if (localStorage.getItem('pwa_permanently_dismissed') === 'true') {
    return null
  }

  // Don't show if dismissed (unless it's session 3+)
  if (dismissed) {
    return null
  }

  // Don't show if not installable (browser doesn't support or criteria not met)
  if (!isInstallable) {
    return null
  }

  // iOS specific message (no automatic prompt support)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  if (isIOS) {
    return (
      <div
        className={`pwa-install-prompt expressive ${isDismissing ? 'dismissing' : ''}`}
        role="banner"
        aria-live="polite"
        aria-label="Install Progressive Web App prompt"
      >
        <button
          onClick={handleDismiss}
          className="pwa-prompt-dismiss"
          aria-label="Dismiss install prompt"
          type="button"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        <div className="pwa-prompt-header">
          <div className="pwa-prompt-icon">
            <img src="/icons/icon-192.png" alt="" aria-hidden="true" />
          </div>
          <h3 id="pwa-prompt-title" className="title-expressive">Install Loyalty Platform</h3>
        </div>

        <p id="pwa-prompt-description" className="pwa-prompt-description">
          Tap <strong>Share</strong> icon, then <strong>"Add to Home Screen"</strong>
        </p>
      </div>
    )
  }

  return (
    <div
      className={`pwa-install-prompt expressive ${isDismissing ? 'dismissing' : ''}`}
      role="banner"
      aria-live="polite"
      aria-label="Install Progressive Web App prompt"
    >
      <button
        onClick={handleDismiss}
        className="pwa-prompt-dismiss"
        aria-label="Dismiss install prompt"
        type="button"
      >
        <span className="material-symbols-outlined" aria-hidden="true">close</span>
      </button>

      <div className="pwa-prompt-header">
        <div className="pwa-prompt-icon">
          <img src="/icons/icon-192.png" alt="" aria-hidden="true" />
        </div>
        <h3 id="pwa-prompt-title" className="title-expressive">Install Loyalty Platform</h3>
      </div>

      <p id="pwa-prompt-description" className="pwa-prompt-description">
        Get faster access, offline support, and instant notifications
      </p>

      <button
        onClick={handleInstall}
        className="btn-primary btn-expressive pwa-install-button"
        disabled={isInstalling}
        aria-describedby="pwa-prompt-title pwa-prompt-description"
        type="button"
      >
        {isInstalling ? (
          <>
            <span className="pwa-spinner" aria-hidden="true"></span>
            Installing...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" aria-hidden="true">install_mobile</span>
            Install
          </>
        )}
      </button>
    </div>
  )
}
