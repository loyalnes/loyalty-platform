import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, KeyboardIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { getCustomerCard, resolveWalletScan, type CustomerCardDetail } from '../api';
import CustomerProfileModal from '../components/CustomerProfileModal';
import { useOnline } from '../contexts/OnlineContext';
import { addToPendingSync } from '../db/operations';

export default function ScanQRPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isOnline } = useOnline();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [customer, setCustomer] = useState<CustomerCardDetail | null>(null);
  const [error, setError] = useState('');
  const [offlineQueued, setOfflineQueued] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);

  const fetchCustomer = useCallback(async (customerId: string) => {
    try {
      setError('');
      setOfflineQueued(false);

      if (!isOnline) {
        // Queue for offline sync
        await addToPendingSync({
          type: 'scan',
          method: 'POST',
          url: `/api/customers/${customerId}/card`,
          payload: { customerId, timestamp: Date.now() }
        });
        setOfflineQueued(true);
        setError(t('scanQR.offlineQueued') || 'Scan queued for sync when online');

        // Haptic feedback if supported
        if ('vibrate' in navigator) {
          navigator.vibrate(100);
        }

        setTimeout(() => {
          setError('');
          setOfflineQueued(false);
          scannerRef.current?.resume();
        }, 2000);
        return;
      }

      const data = await getCustomerCard(customerId);
      setCustomer(data);

      // Haptic feedback on success
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch {
      setError(t('scanQR.customerNotFound'));
      // Resume scanning after 2 seconds
      setTimeout(() => {
        setError('');
        scannerRef.current?.resume();
      }, 2000);
    }
  }, [t, isOnline]);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    // Stop scanning temporarily
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.pause(true);
    }

    // Try to parse as wallet token (opaque token)
    // If it's not a URL, treat it as a wallet barcode token
    if (!decodedText.includes('/')) {
      try {
        setError('');
        const walletResult = await resolveWalletScan(decodedText);
        // Convert wallet result to CustomerCardDetail format
        const customerDetail: CustomerCardDetail = {
          id: walletResult.loyaltyCardId,
          cardNumber: walletResult.cardNumber,
          customerId: walletResult.customerId,
          firstName: walletResult.customerName.split(' ')[0] || '',
          lastName: walletResult.customerName.split(' ').slice(1).join(' ') || '',
          email: '',
          phone: null,
          avatarUrl: null,
          pointsBalance: walletResult.pointsBalance,
          totalEarned: 0,
          totalRedeemed: 0,
          status: 'ACTIVE',
          recentTransactions: [],
        };
        setCustomer(customerDetail);
        return;
      } catch {
        // Fall through to try customer ID format
        console.log('Not a wallet token, trying customer ID format');
      }
    }

    // Extract customer ID from QR code
    // Expected format: {origin}/app/customer/{customerId}
    const match = decodedText.match(/\/app\/customer\/([a-f0-9-]+)/i);
    if (!match) {
      setError(t('scanQR.invalidQR'));
      // Resume scanning after 2 seconds
      setTimeout(() => {
        setError('');
        scannerRef.current?.resume();
      }, 2000);
      return;
    }

    const customerId = match[1];
    await fetchCustomer(customerId);
  }, [fetchCustomer, t]);

  const startCamera = useCallback(() => {
    const scanner = scannerRef.current ?? new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    if (scanner.isScanning) return;

    setCameraError(false);

    // Calculate QR box size responsively (80% of viewport width, max 300px)
    const qrBoxSize = Math.min(window.innerWidth * 0.8, 300);

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrBoxSize, height: qrBoxSize },
        },
        onScanSuccess,
        () => {
          // Ignore scan failures, they're normal
        }
      )
      .then(() => {
        setScanning(true);
        setCameraError(false);
      })
      .catch((err) => {
        console.error('Camera start failed:', err);
        setCameraError(true);
        setScanning(false);
      });
  }, [onScanSuccess]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startCamera();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch((err) => console.error('Failed to stop scanner:', err));
      }
    };
  }, [startCamera]);

  const handleManualLookup = async () => {
    if (!manualId.trim()) return;
    await fetchCustomer(manualId.trim());
  };

  const handleCloseModal = () => {
    setCustomer(null);
    // Resume scanning
    if (scannerRef.current && !scannerRef.current.isScanning) {
      scannerRef.current.resume();
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="scan-qr-page">
      <div className="scan-qr-shell">
        <header className="scan-qr-header">
          <div>
            <span className="app-page-kicker scan-qr-kicker">{t('scanQR.title')}</span>
            <h1>{t('scanQR.title')}</h1>
          </div>
          <button className="scan-qr-close" onClick={handleClose}>
            <X size={24} />
          </button>
        </header>

        <div className="scan-qr-content">
        {!isOnline && (
          <div className="offline-scan-badge">
            <span className="material-symbols-outlined">cloud_off</span>
            <span>{t('scanQR.offlineMode') || 'Offline - scans will sync later'}</span>
          </div>
        )}

        {offlineQueued && (
          <div className="offline-queued-badge">
            <span className="material-symbols-outlined">check_circle</span>
            <span>{t('scanQR.scanQueued') || 'Scan queued for sync'}</span>
          </div>
        )}

        {cameraError ? (
          <div className="scan-qr-error">
            <Camera size={48} strokeWidth={1.5} />
            <h2>{t('scanQR.cameraError')}</h2>
            <p>{t('scanQR.cameraErrorDesc')}</p>
            <div className="scan-qr-error-actions">
              <button className="btn-primary" onClick={() => { setCameraError(false); hasStartedRef.current = false; startCamera(); }}>
                <Camera size={20} />
                {t('scanQR.retryCamera', 'Retry Camera')}
              </button>
              <button className="btn-primary scan-qr-secondary-btn" onClick={() => setShowManualInput(true)}>
                <KeyboardIcon size={20} />
                {t('scanQR.manualEntry')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="scan-qr-scanner">
              <div id="qr-reader" className="scan-qr-reader" />
              <div className="scan-qr-overlay">
                <div className="scan-qr-frame" />
              </div>
              {!scanning && !cameraError && (
                <div className="scan-qr-loading">{t('common.loading')}</div>
              )}
            </div>

            <p className="scan-qr-instruction">{t('scanQR.instruction')}</p>

            {error && <div className="scan-qr-error-message">{error}</div>}

            <button
              className="scan-qr-manual-btn"
              onClick={() => setShowManualInput(true)}
            >
              <KeyboardIcon size={18} />
              {t('scanQR.manualEntry')}
            </button>
          </>
        )}
        </div>
      </div>

      {/* Manual Input Modal */}
      {showManualInput && (
        <div className="modal-overlay" onClick={() => setShowManualInput(false)}>
          <div className="modal-content manual-input-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('scanQR.enterCustomerId')}</h3>
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowManualInput(false)}>
                {t('scanQR.cancel')}
              </button>
              <button className="btn-primary" onClick={handleManualLookup}>
                {t('scanQR.lookup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Modal */}
      {customer && <CustomerProfileModal customer={customer} onClose={handleCloseModal} />}
    </div>
  );
}
