import React from "react";

const GlobalLoader: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
      role="status"
      aria-live="polite"
      aria-label="Chargement de la page"
    >
      <p className="rounded-md bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-sm">
        Chargement de la page en cours...
      </p>
    </div>
  );
};

export default GlobalLoader;