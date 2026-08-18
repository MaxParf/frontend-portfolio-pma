import { DEMO_DATABASE_STORES } from "./contract.js";

/** Demo-only mutation path. The public portfolio never imports this module. */
export async function resetDemoSandbox({ db, media }) {
  media.dispose();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DEMO_DATABASE_STORES, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    DEMO_DATABASE_STORES.forEach((storeName) => transaction.objectStore(storeName).clear());
  });
}
