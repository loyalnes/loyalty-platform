import { useState, useEffect } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [visitCount, setVisitCount] = useState(0)

  useEffect(() => {
    // Track visit count
    const count = parseInt(localStorage.getItem('pwa_visit_count') || '0') + 1
    localStorage.setItem('pwa_visit_count', count.toString())
    setVisitCount(count)

    // Check if user dismissed prompt
    const wasDismissed = localStorage.getItem('pwa_install_dismissed') === 'true'
    setDismissed(wasDismissed)
  }, [])

  const handleInstall = async () => {
    const success = await install()
    if (success) {
      console.log('PWA installed successfully')
      localStorage.setItem('pwa_install_dismissed', 'true')
      setDismissed(true)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    const dismissCount = parseInt(localStorage.getItem('pwa_dismiss_count') || '0') + 1
    localStorage.setItem('pwa_dismiss_count', dismissCount.toString())

    // After 3 dismissals, mark as permanently dismissed
    if (dismissCount >= 3) {
      localStorage.setItem('pwa_install_dismissed', 'true')
    }
  }

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) {
    return null
  }

  // Don't show if not installable (browser doesn't support or criteria not met)
  if (!isInstallable) {
    return null
  }

  // Show after 2 visits
  if (visitCount < 2) {
    return null
  }

  // iOS specific message (no automatic prompt support)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  if (isIOS) {
    return (
      <div className="pwa-install-prompt">
        <div className="pwa-prompt-content">
          <span className="material-symbols-outlined">install_mobile</span>
          <div className="pwa-prompt-text">
            <h3>Install Loyalty Platform</h3>
            <p>
              Tap <strong>Share</strong> icon, then <strong>"Add to Home Screen"</strong>
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} className="pwa-prompt-dismiss" aria-label="Dismiss">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    )
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-prompt-content">
        <span className="material-symbols-outlined">install_mobile</span>
        <div className="pwa-prompt-text">
          <h3>Install Loyalty Platform</h3>
          <p>Get faster access, offline support, and instant notifications</p>
        </div>
      </div>
      <div className="pwa-prompt-actions">
        <button onClick={handleInstall} className="btn-primary">
          Install
        </button>
        <button onClick={handleDismiss} className="btn-text">
          Not now
        </button>
      </div>
    </div>
  )
}
