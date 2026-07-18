export async function executeAppWipe(redirectTo = "/api/auth/signin?wipe=1"): Promise<void> {
  if (typeof indexedDB !== "undefined") {
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const names = new Set([
      "adl_offline_queue",
      "adl_point_operator_queue",
      ...databases.map((entry) => entry.name).filter((name): name is string => Boolean(name)),
    ]);
    await Promise.all(
      Array.from(names).map(async (name) => {
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }),
    );
  }

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Ignore browser storage access failures.
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if (typeof caches !== "undefined") {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  window.location.href = redirectTo;
}
