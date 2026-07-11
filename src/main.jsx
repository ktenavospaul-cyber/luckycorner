import React from "react";
import { createRoot } from "react-dom/client";
import LuckyCorner from "./LuckyCorner.jsx";

// The app calls window.storage.get/set (a host API that doesn't exist in a
// plain browser). Shim it onto localStorage so profile + tracker persist.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value == null ? null : { value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LuckyCorner />
  </React.StrictMode>
);

// Register the service worker so the app is installable on Android/iOS.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
