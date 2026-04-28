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







// import React from "react";
// import logo from "../assets/images/logo.webp";

// const GlobalLoader: React.FC = () => {
//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
//       role="status"
//       aria-live="polite"
//       aria-label="Chargement de la page"
//     >
//       {/* Halo flou derrière */}
//       <div className="absolute inset-0 opacity-40 pointer-events-none">
//         <div className="w-72 h-72 bg-indigo-500/40 rounded-full blur-3xl absolute -top-10 -left-10" />
//         <div className="w-72 h-72 bg-cyan-500/30 rounded-full blur-3xl absolute -bottom-10 -right-10" />
//       </div>

//       {/* Carte centrale */}
//       <div className="relative bg-slate-900/80 border border-slate-700/60 shadow-2xl rounded-3xl px-8 py-7 flex flex-col items-center gap-5 backdrop-blur-xl">
//         {/* Logo / icône animée */}
//         <div className="relative">
//           <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
//             <img
//               width={300}
//               height={300}
//               src={logo}
//               alt="Christland Tech"
//               loading="lazy"
//               className="h-10 w-auto animate-pulse"
//             />
//           </div>
//           <div className="absolute -inset-1 rounded-3xl border border-indigo-500/30 animate-ping opacity-40" />
//         </div>

//         {/* Titre + texte */}
//         <div className="text-center space-y-1">
//           <h2 className="text-lg font-semibold tracking-wide text-slate-50">
//             Christland Tech
//           </h2>
//           <p className="text-xs text-slate-300/80">
//             Chargement de la page en cours...
//           </p>
//           <p className="text-[11px] text-slate-400/70">Merci de patienter</p>
//         </div>

//         {/* Barre de progression animée */}
//         <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden">
//           <div className="h-full w-1/3 bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 rounded-full animate-[loaderSlide_1.2s_infinite]" />
//         </div>

//         {/* Petits points animés */}
//         <div className="flex items-center gap-1.5 mt-1">
//           <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
//           <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.15s]" />
//           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]" />
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GlobalLoader;