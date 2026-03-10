export async function executeAppWipe(): Promise<void> {
  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .map((entry) => entry.name)
        .filter((name): name is string => Boolean(name))
        .map(async (name) => {
          indexedDB.deleteDatabase(name);
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

  window.location.href = "/api/auth/signin?wipe=1";
}
