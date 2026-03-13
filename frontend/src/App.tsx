/// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ScrollToTop from "./components/ScrollToTop";
import PrivateRoute from "./components/PrivateRoute";
import GlobalLoader from "./components/GlobalLoader";
import { useGlobalLoading } from "./hooks/useFetchQuery";

// 🔹 PAGES CHARGÉES EN CHUNKS (code splitting)
const Accueil = lazy(() => import("./pages/Accueil"));
const About = lazy(() => import("./pages/About"));
const Produits = lazy(() => import("./pages/Produits"));
const Services = lazy(() => import("./pages/Services"));
const Assistance = lazy(() => import("./pages/Assistance"));
const Sighup = lazy(() => import("./pages/Sighup"));
const Connexion = lazy(() => import("./pages/Connexion"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const AddArticle = lazy(() => import("./pages/AddArticle"));
const UpdateProduct = lazy(() => import("./pages/UpdateProduct"));
const UpdateArticle = lazy(() => import("./pages/UpdateArticle"));
const UpdateCathegorie = lazy(() => import("./pages/UpdateCathegorie"));
const AddCathegorie = lazy(() => import("./pages/AddCathegorie"));
// const ProduitDetail = lazy(() => import("./pages/ProduitDetail"));
const App: React.FC = () => {
  const { i18n } = useTranslation();
  const isLoading = useGlobalLoading();          // état du loader global (fetch)
  const location = useLocation();                // chemin actuel
  const pathname = location.pathname;

  // 👉 on ne montre le gros loader global que sur /produits et /dashboard
  const isHeavyRoute =
    pathname.startsWith("/produits");

  // 👉 Loader affiché pendant le chargement des chunks (lazy)
  const suspenseFallback = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <GlobalLoader />
    </div>
  );

  return (
    <>
      {/* Loader global pendant les requêtes API sur routes lourdes */}
      {isHeavyRoute && isLoading && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/70">
          <GlobalLoader />
        </div>
      )}

      {/* Loader affiché pendant le chargement des pages lazy (avant que le contenu arrive) */}
      <Suspense fallback={suspenseFallback}>
        <ScrollToTop />
        <main className="relative min-h-screen">
          <Routes key={i18n.language}>
            {/* === PUBLIC (chemins canoniques) === */}
            <Route path="/" element={<Accueil key={i18n.language} />} />
            <Route path="/a-propos" element={<About key={i18n.language} />} />
            <Route path="/produits" element={<Produits key={i18n.language} />} />
            <Route path="/services" element={<Services key={i18n.language} />} />
            <Route path="/assistance" element={<Assistance key={i18n.language} />} />

            {/* === AUTH (canoniques) === */}
            <Route path="/dashboard/inscription" element={<Sighup />} />
            <Route path="/dashboard/connexion" element={<Connexion />} />

            {/* === DASHBOARD PRIVÉ (canoniques) === */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/ajouter-produit"
              element={
                <PrivateRoute>
                  <AddProduct />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/ajouter-article"
              element={
                <PrivateRoute>
                  <AddArticle />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/modifier/:id"
              element={
                <PrivateRoute>
                  <UpdateProduct />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/articles/:id/edit"
              element={
                <PrivateRoute>
                  <UpdateArticle />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/categories/:id/edit"
              element={
                <PrivateRoute>
                  <UpdateCathegorie />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/ajouter-categorie"
              element={
                <PrivateRoute>
                  <AddCathegorie />
                </PrivateRoute>
              }
            />

            {/* === ANCIENNES ROUTES (majuscules / underscores) → REDIRECT === */}
           <Route path="/produits/:categorySlug" element={<Produits key={i18n.language} />} />
           <Route path="/produits/:categorySlug/:productSlug" element={<Produits  key={i18n.language} />} />
           <Route path="/produit/:productSlug" element={<Produits key={i18n.language} />} />
            <Route path="/Services" element={<Navigate to="/services" replace />} />
            <Route path="/Assistance" element={<Navigate to="/assistance" replace />} />
            <Route path="/Dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/Dashboard/Connexion"
              element={<Navigate to="/dashboard/connexion" replace />}
            />
            <Route
              path="/Dashboard/Sighup"
              element={<Navigate to="/dashboard/inscription" replace />}
            />
            <Route
              path="/Dashboard/Ajouter_produit"
              element={<Navigate to="/dashboard/ajouter-produit" replace />}
            />
            <Route
              path="/Dashboard/Ajouter_article"
              element={<Navigate to="/dashboard/ajouter-article" replace />}
            />
            <Route
              path="/Dashboard/Ajouter_categorie"
              element={<Navigate to="/dashboard/ajouter-categorie" replace />}
            />
            <Route
              path="/Dashboard/Modifier/:id"
              element={<Navigate to="/dashboard/modifier/:id" replace />}
            />
            <Route
              path="/Dashboard/Articles/:id/edit"
              element={<Navigate to="/dashboard/articles/:id/edit" replace />}
            />
            <Route
              path="/Dashboard/Categories/:id/edit"
              element={<Navigate to="/dashboard/categories/:id/edit" replace />}
            />

            {/* 404 → retour accueil */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Suspense>
    </>
  );
};

export default App;
