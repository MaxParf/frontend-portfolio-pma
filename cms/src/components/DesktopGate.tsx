interface DesktopGateProps {
  onLogout: () => void;
}

export function DesktopGate({ onLogout }: DesktopGateProps) {
  return (
    <main className="desktop-gate" role="status" aria-labelledby="desktop-gate-title">
      <section className="desktop-gate__card">
        <div className="desktop-gate__mark">M</div>
        <h1 id="desktop-gate-title">Maxpar CMS</h1>
        <p>Maxpar CMS is available on desktop screens with a minimum width of 1200 px.</p>
        <p className="desktop-gate__note">Viewport size is not a security boundary. Server-side session validation remains required.</p>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </section>
    </main>
  );
}
