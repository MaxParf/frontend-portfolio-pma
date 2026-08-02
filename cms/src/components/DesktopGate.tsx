import { useEffect, useState } from "react";

interface DesktopGateProps {
  onLogout: () => void;
}

export function isTouchOnlyDevice() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(any-pointer: coarse)").matches && !window.matchMedia("(any-hover: hover)").matches;
}

export function DesktopGate({ onLogout }: DesktopGateProps) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const coarse = window.matchMedia("(any-pointer: coarse)");
    const hover = window.matchMedia("(any-hover: hover)");
    const update = () => setBlocked(coarse.matches && !hover.matches);
    update(); coarse.addEventListener?.("change", update); hover.addEventListener?.("change", update);
    return () => { coarse.removeEventListener?.("change", update); hover.removeEventListener?.("change", update); };
  }, []);
  if (!blocked) return null;
  return (
    <main className="desktop-gate" role="status" aria-labelledby="desktop-gate-title">
      <section className="desktop-gate__card">
        <h1 id="desktop-gate-title">Maxpar CMS доступна только на настольных компьютерах.</h1>
        <p className="desktop-gate__note">Проверка устройства не заменяет серверную проверку сессии.</p>
        <button type="button" onClick={onLogout}>
          Выйти
        </button>
      </section>
    </main>
  );
}
