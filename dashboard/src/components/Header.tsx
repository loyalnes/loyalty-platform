import { useAuth } from '../AuthContext';

export default function Header() {
  const { merchant } = useAuth();
  const merchantName = merchant?.name || "Barelio";

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-profile">
          <div className="app-header-avatar">
            <img
              alt="User profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCELtpCMrvHzCLj2myRq5mAnXWoaAoKQduDoaVBWoDsQIRq92qccox6UrZtMWBOj0LdlAd4V_kp46ixzzKwk9TaXrWmpCjEvuXtwhZHNScJ3cE_Erz0Nic9-OuNHu1w2MneuQRP1FrQL6lFfEUAd8t8rRZy-n8eZiSUc1K3msZIaudXVtV2cLsGyxEDnMTExj1Ke5VgKggm1eZf92H36Ux3fphiI8BHeBbl7rW8rQt8E_3JRwGok1J2KR-MjoY64hdODt6hSS0i3q1r"
            />
          </div>
          <h1 className="app-header-title">BUONGIORNO, {merchantName.toUpperCase()}</h1>
        </div>
        <button className="app-header-bell material-symbols-outlined" type="button" aria-label="Notifications">
          notifications
        </button>
      </div>
    </header>
  );
}
