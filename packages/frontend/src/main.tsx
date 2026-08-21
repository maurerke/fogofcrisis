import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const AdminApp = lazy(() => import("./admin/AdminApp"));

const isAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-surface-50 text-surface-600">
            Lade Admin-Dashboard…
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
