import { DEMO_STATE_KEY } from "./contract.js";

/** Demo-only mutation path. The public portfolio never imports this module. */
export async function resetDemoSandbox({ db, media }) {
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(["state", "media"], "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось сбросить демо."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Не удалось сбросить демо."));
    transaction.objectStore("state").delete(DEMO_STATE_KEY);
    transaction.objectStore("media").clear();
  });
  media.dispose();
}
