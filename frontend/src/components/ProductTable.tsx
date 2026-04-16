import { useState, useEffect } from "react";
import { Trash2, Plus, CheckCircle, ChevronRight, ChevronDown } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import React from "react";

import {
  getDashboardProducts,
  deleteDashboardProduct,
  getDashboardArticles,
  deleteDashboardArticle,
  getDashboardCategories,
  deleteDashboardCategory,
} from "../hooks/useFetchQuery";
import type { ApiProduct, ApiCategory, ApiArticle } from "../hooks/useFetchQuery";

type CategoryNode = ApiCategory & { children?: CategoryNode[] };

// Types des onglets
type TabType = "produits" | "articles" | "categories";

// Onglet initial en fonction de ?tab=...
// const params = new URLSearchParams(window.location.search);
// const tabParam = params.get("tab");
// const initialTab: TabType =
//   tabParam === "articles"
//     ? "articles"
//     : tabParam === "categories"
//     ? "categories"
//     : "produits";

const PAGE_SIZE = 24;

// 🔁 Helper suppression récursive dans l’arbre de catégories
const removeCategoryFromTree = (
  nodes: CategoryNode[],
  id: number
): CategoryNode[] => {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: node.children ? removeCategoryFromTree(node.children, id) : [],
    }));
};

const ProductTable = () => {
  // const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const location = useLocation();
  const navigate = useNavigate();
const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const getTabFromUrl = (): TabType => {
    const sp = new URLSearchParams(location.search);
    const tab = sp.get("tab");
    if (tab === "articles") return "articles";
    if (tab === "categories") return "categories";
    return "produits";
  };

  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromUrl());

  // Sync onglet avec URL (tu l’as déjà mais on le garde propre)
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location.search]);
  const [page, setPage] = useState(1);
const [showInactive, setShowInactive] = useState(false);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
const [filterCategories, setFilterCategories] = useState<ApiCategory[]>([]);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  // lecture du terme recherché depuis l'URL

  const searchParams = new URLSearchParams(location.search);
  const q = (searchParams.get("q") || "").trim();

  const [searchMode, setSearchMode] = useState(q.length > 0);
  useEffect(() => {
    setSearchMode(q.length > 0);
  }, [q]);

  const getImageSafe = (product: ApiProduct): string =>
    product?.images?.[0]?.url && product.images[0].url !== "null"
      ? product.images[0].url
      : "/Dispositivos.webp";

  // ================================
  // ✅ MODE SELECTION (Produits)
  // ================================
  
  const [selectMode, setSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
// console.log("DASHBOARD URL:", location.pathname + location.search, "STATE:", location.state);
  // ✅ Mode suppression : "single" ou "bulk"
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [bulkIds, setBulkIds] = useState<number[]>([]);

  const isAllSelected =
    activeTab === "produits" &&
    selectMode &&
    products.length > 0 &&
    selectedProductIds.length === products.length;

  const toggleSelectOne = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!selectMode) return;
    if (isAllSelected) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  // Reset sélection si on change d'onglet (ou on sort de produits)
  useEffect(() => {
    if (activeTab !== "produits") {
      setSelectMode(false);
      setSelectedProductIds([]);
    }
  }, [activeTab]);

  // Reset sélection quand on change de page / search
  useEffect(() => {
    setSelectedProductIds([]);
  }, [page, q]);

useEffect(() => {
  getDashboardCategories({ page: 1, page_size: 500 }).then((data) => {
    const list = data.results ?? data ?? [];
    const parentsOnly = list.filter((cat: ApiCategory) => !cat.parent_id);
    setFilterCategories(parentsOnly);
  });
}, []);

  // === Fetchers ===
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardProducts({ page, page_size: PAGE_SIZE,active_only: showInactive ? 0 : 1,  q: q || undefined,  category_id: selectedCategory || undefined, });
      if (Array.isArray(data)) {
        setProducts(data);
        setCount(data.length);
      } else if (data?.results) {
        setProducts(data.results);
        setCount(data.count ?? data.results.length ?? 0);
      } else {
        setProducts([]);
        setCount(0);
      }
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardArticles({ page, page_size: PAGE_SIZE });
      setArticles(data.results ?? []);
      setCount(data.count ?? data.results?.length ?? 0);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const [openParents, setOpenParents] = useState<number[]>([]);

  const toggleParent = (id: number) => {
    setOpenParents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Transforme la liste plate (parent_id) en arbre { parent -> children[] }
  const buildTree = (list: ApiCategory[]): CategoryNode[] => {
    const map: Record<number, CategoryNode> = {};

    list.forEach((c) => {
      map[c.id] = { ...c, children: [] };
    });

    const tree: CategoryNode[] = [];

    list.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children!.push(map[c.id]);
      } else {
        tree.push(map[c.id]);
      }
    });

    return tree;
  };

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardCategories({
        page: 1,
        page_size: 500,
        q,
      });

      const flatRows =
        (data as any).results ??
        (data as any).items ??
        (Array.isArray(data) ? data : []) ??
        [];

      const treeRows = buildTree(flatRows);

      setCategories(treeRows);
      setCount(flatRows.length ?? 0);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };


useEffect(() => {
  const st = location.state as any;

  if (st?.tab) {
    setActiveTab(st.tab);

    const sp = new URLSearchParams(location.search);
    sp.set("tab", st.tab);

    navigate(
      { pathname: location.pathname, search: `?${sp.toString()}` },
      { replace: true, state: { ...st, tab: undefined } }
    );
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



  // Sync onglet avec URL
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tab = sp.get("tab");

    if (tab === "articles") {
      setActiveTab("articles");
    } else if (tab === "categories") {
      setActiveTab("categories");
    } else {
      setActiveTab("produits");
    }
  }, [location.search]);

  // Mode NORMAL (sans q)
useEffect(() => {
  if (searchMode) return;

  if (activeTab === "produits") {
    fetchProducts();
  } else if (activeTab === "articles") {
    fetchArticles();
  } else if (activeTab === "categories") {
    fetchCategories();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab, page, searchMode, showInactive, selectedCategory]);

  // Mode RECHERCHE (q)
  // Mode RECHERCHE (q)
useEffect(() => {
  const sp = new URLSearchParams(location.search);
  const tab = sp.get("tab");

  // ✅ Si on est sur l’onglet catégories, on ne fait PAS la recherche produits/articles
  // et surtout on ne force PAS activeTab = "produits"
  if (tab === "categories") return;

  if (!searchMode) return;

  (async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodsData, artsData] = await Promise.all([
        getDashboardProducts({page,page_size: PAGE_SIZE,q,active_only: showInactive ? 0 : 1,category_id: selectedCategory || undefined,}),
        getDashboardArticles({ page, page_size: PAGE_SIZE, q }),
      ]);

      const prodsRows = Array.isArray(prodsData)
        ? prodsData
        : prodsData?.results ?? [];
      const artsRows = artsData?.results ?? [];

      setProducts(prodsRows);
      setArticles(artsRows);

      if (prodsRows.length > 0) {
        setActiveTab("produits");
        setCount((prodsData as any)?.count ?? prodsRows.length ?? 0);
      } else {
        setActiveTab("articles");
        setCount(artsData?.count ?? artsRows.length ?? 0);
      }
    } catch (e: any) {
      setError(e.message || "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  })();
}, [q, page, searchMode, location.search, showInactive, selectedCategory]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  // =========================
  // ✅ Suppression (single/bulk)
  // =========================
  const requestDelete = (id: number) => {
    setDeleteErrorMsg(null);
    setDeleteMode("single");
    setBulkIds([]);
    setConfirmId(id);
  };

  const requestBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setDeleteErrorMsg(null);
    setDeleteMode("bulk");
    setBulkIds([...selectedProductIds]);
    setConfirmId(-1); // just to open modal
  };

  const handleDeleteConfirmed = async () => {
    if (confirmId == null) return;
    setConfirmLoading(true);
    setDeleteErrorMsg(null);

    try {
      // ------ PRODUITS ------
      if (activeTab === "produits") {
        if (deleteMode === "bulk") {
          const idsToDelete = [...bulkIds];
          const dec = idsToDelete.length;

          for (const id of idsToDelete) {
            await deleteDashboardProduct(id);
          }

          setProducts((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
          setSelectedProductIds([]);
          setSuccessMsg(`${dec} produit(s) supprimé(s) avec succès !`);

          // pagination fallback (simple)
          const itemsLeftOnPage = products.length - dec;
          if (itemsLeftOnPage <= 0 && page > 1) setPage(page - 1);

          setCount((prev) => Math.max(0, prev - dec));
        } else {
          await deleteDashboardProduct(confirmId);

          setProducts((prev) => prev.filter((p) => p.id !== confirmId));
          setSuccessMsg("Produit supprimé avec succès !");

          const itemsLeftOnPage = products.length - 1;
          if (itemsLeftOnPage <= 0 && page > 1) setPage(page - 1);

          setCount((prev) => Math.max(0, prev - 1));
        }
      }

      // ------ ARTICLES ------
      else if (activeTab === "articles") {
        await deleteDashboardArticle(confirmId);
        setArticles((prev) => prev.filter((a) => a.id !== confirmId));
        setSuccessMsg("Article supprimé avec succès !");

        const itemsLeftOnPage = articles.length - 1;
        if (itemsLeftOnPage <= 0 && page > 1) setPage(page - 1);

        setCount((prev) => Math.max(0, prev - 1));
      }

      // ------ CATEGORIES ------
      else {
        await deleteDashboardCategory(confirmId);
        setCategories((prev) => removeCategoryFromTree(prev, confirmId));
        setSuccessMsg("Catégorie supprimée avec succès !");
        setCount((prev) => Math.max(0, prev - 1));
      }

      setConfirmId(null);
      setTimeout(() => setSuccessMsg(null), 7000);
    } catch (e: any) {
      const msg = e?.message ?? "Erreur lors de la suppression.";
      setDeleteErrorMsg(msg);
      // on ne ferme pas le modal
    } finally {
      setConfirmLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const goToTab = (tab: TabType) => {
    const sp = new URLSearchParams(location.search);
    sp.set("tab", tab);
    navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
    setActiveTab(tab);
    setPage(1);
  };

  const tabBaseCls =
    "px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm lg:text-base font-medium whitespace-nowrap";

  return (
    <div
      className="
        bg-white rounded-xl shadow-sm
        w-full md:w-3/4
        p-3 md:p-4
        h-auto md:h-[70vh] lg:h-[73vh]
        overflow-visible md:overflow-y-auto
        relative
      "
    >
      {successMsg && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 px-5 py-3 rounded-lg shadow-lg"
        >
          <CheckCircle size={20} />
          <span className="text-base font-medium">{successMsg}</span>
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b mb-4 overflow-x-auto">
        <button
          onClick={() => goToTab("produits")}
          className={`${tabBaseCls} ${
            activeTab === "produits"
              ? "text-[#00A9DC] border-b-2 border-[#00A9DC]"
              : "text-gray-500 hover:text-[#00A9DC]"
          }`}
        >
          Tous les Produits
        </button>

        <button
          onClick={() => goToTab("articles")}
          className={`${tabBaseCls} ${
            activeTab === "articles"
              ? "text-[#00A9DC] border-b-2 border-[#00A9DC]"
              : "text-gray-500 hover:text-[#00A9DC]"
          }`}
        >
          Tous les Articles
        </button>

        <button
          onClick={() => goToTab("categories")}
          className={`${tabBaseCls} ${
            activeTab === "categories"
              ? "text-[#00A9DC] border-b-2 border-[#00A9DC]"
              : "text-gray-500 hover:text-[#00A9DC]"
          }`}
        >
          Toutes les Catégories
        </button>
      </div>

{/* ✅ Actions produits : filtre + sélection */}
{activeTab === "produits" && (
  <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
    
    {/* ✅ SELECT CATEGORIE */}
    <select
      value={selectedCategory || ""}
      onChange={(e) => {
        const val = e.target.value;
        setSelectedCategory(val ? Number(val) : null);
        setPage(1);
      }}
      className="border px-3 py-1.5 rounded-lg text-sm"
    >
      <option value="">Toutes les catégories</option>
      {filterCategories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.nom}
        </option>
      ))}
    </select>

    {/* Filtre actifs */}
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={showInactive}
        onChange={(e) => {
          setShowInactive(e.target.checked);
          setPage(1);
        }}
        className="h-4 w-4 accent-[#00A9DC] cursor-pointer"
      />
      Afficher les inactifs
    </label>

    {/* Bouton sélection */}
    {!selectMode ? (
      <button
        className="px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50"
        onClick={() => setSelectMode(true)}
      >
        Sélectionner
      </button>
    ) : (
      <button
        className="px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50"
        onClick={() => {
          setSelectMode(false);
          setSelectedProductIds([]);
        }}
      >
        Quitter la sélection
      </button>
    )}
  </div>
)}

      {/* ✅ Barre d’action sticky (produits uniquement) */}
      {activeTab === "produits" && selectMode && selectedProductIds.length > 0 && (
        <div className="sticky top-0 z-10 mb-3 bg-white/90 backdrop-blur border rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <b>{selectedProductIds.length}</b> sélectionné(s)
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border text-gray-700 hover:bg-gray-50"
              onClick={() => setSelectedProductIds([])}
            >
              Tout désélectionner
            </button>

            <button
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
              onClick={requestBulkDelete}
            >
              <Trash2 size={16} />
              Supprimer
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-6">Chargement...</div>}
      {error && <div className="text-red-500 text-center py-6">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <table className="min-w-[520px] w-full text-xs md:text-sm text-left border-collapse">
            <thead className="text-gray-500 border-b">
              {activeTab === "produits" && (
                <tr>
                  {selectMode && (
                    <th className="py-1.5 md:py-2 px-2 md:px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-[#00A9DC] cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Image</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Nom</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Prix</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Quantité</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Modifier</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Supprimer</th>
                </tr>
              )}

              {activeTab === "articles" && (
                <tr>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Image</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Extrait</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Modifier</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Supprimer</th>
                </tr>
              )}

              {activeTab === "categories" && (
                <tr>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Nom</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Description</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Statut</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Modifier</th>
                  <th className="py-1.5 md:py-2 px-2 md:px-4">Supprimer</th>
                </tr>
              )}
            </thead>

            <tbody>
              {/* PRODUITS */}
              {activeTab === "produits" &&
                (products.length ? (
                  products.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      {selectMode && (
                        <td className="py-1.5 md:py-2 px-2 md:px-4">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                            className="h-4 w-4 accent-[#00A9DC] cursor-pointer"
                          />
                        </td>
                      )}

                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <img
                          width={300}
                          height={300}
                          src={getImageSafe(p)}
                          alt={p.nom}
                          loading="lazy"
                          className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover my-1"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/Dispositivos.webp";
                          }}
                        />
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4 text-gray-700">
                        {p.nom}
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4 text-gray-700">
                        {p.prix_from != null
                          ? `${Number(p.prix_from as any).toLocaleString("fr-FR")} FCFA`
                          : "—"}
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        {p.variants_stock?.[0] ?? p.stock_total ?? p.quantite ?? "—"}
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <Plus
                          className="text-[#00A9DC] cursor-pointer"
                          size={18}
                          onClick={() => navigate(`/dashboard/modifier/${p.id}`)}
                        />
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <Trash2
                          className="text-red-500 cursor-pointer"
                          size={18}
                          onClick={() => requestDelete(p.id)}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={selectMode ? 7 : 6} className="text-center py-6 text-gray-500">
                      Aucun produit trouvé.
                    </td>
                  </tr>
                ))}

              {/* ARTICLES */}
              {activeTab === "articles" &&
                (articles.length ? (
                  articles.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <img
                          width={300}
                          height={300}
                          src={a.image || "/Dispositivos.webp"}
                          alt={a.titre}
                          loading="lazy"
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/Dispositivos.webp";
                          }}
                        />
                      </td>
                      <td className="py-2 px-2 md:px-4 text-gray-500 truncate max-w-[240px]">
                        {a.extrait || "—"}
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <Plus
                          className="text-[#00A9DC] cursor-pointer"
                          size={18}
                          onClick={() => navigate(`/dashboard/Articles/${a.id}/edit`)}
                        />
                      </td>
                      <td className="py-1.5 md:py-2 px-2 md:px-4">
                        <Trash2
                          className="text-red-500 cursor-pointer"
                          size={18}
                          onClick={() => requestDelete(a.id)}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-500">
                      Aucun article.
                    </td>
                  </tr>
                ))}

              {/* CATEGORIES */}
              {activeTab === "categories" &&
                (categories.length ? (
                  categories.map((parent) => (
                    <React.Fragment key={parent.id}>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="py-2 px-2 md:px-4 flex items-center gap-2">
                          <button
                            onClick={() => toggleParent(parent.id)}
                            className="p-1 text-gray-600 hover:text-black"
                          >
                            {openParents.includes(parent.id) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                          {parent.nom}
                        </td>

                        <td className="py-2 px-2 md:px-4 text-gray-500 truncate max-w-[240px]">
                          {parent.description || "—"}
                        </td>

                        <td className="py-1.5 md:py-2 px-2 md:px-4">
                          <span
                            className={
                              parent.est_actif
                                ? "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"
                                : "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"
                            }
                          >
                            {parent.est_actif ? "Actif" : "Inactif"}
                          </span>
                        </td>

                        <td className="py-1.5 md:py-2 px-2 md:px-4">
                          <Plus
                            className="text-[#00A9DC] cursor-pointer"
                            size={18}
                            onClick={() => navigate(`/dashboard/Categories/${parent.id}/edit?from=categories`)}
                          />
                        </td>

                        <td className="py-1.5 md:py-2 px-2 md:px-4">
                          <Trash2
                            className="text-red-500 cursor-pointer"
                            size={18}
                            onClick={() => requestDelete(parent.id)}
                          />
                        </td>
                      </tr>

                      {openParents.includes(parent.id) &&
                        (parent.children ?? []).map((child) => (
                          <tr key={child.id} className="border-b">
                            <td className="py-2 px-8 md:px-10 text-gray-700">
                              ↳ {child.nom}
                            </td>

                            <td className="py-2 px-2 md:px-4 text-gray-500 truncate max-w-[240px]">
                              {child.description || "—"}
                            </td>

                            <td className="py-1.5 md:py-2 px-2 md:px-4">
                              <span
                                className={
                                  child.est_actif
                                    ? "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"
                                    : "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"
                                }
                              >
                                {child.est_actif ? "Actif" : "Inactif"}
                              </span>
                            </td>

                            <td className="py-1.5 md:py-2 px-2 md:px-4">
                              <Plus
                                className="text-[#00A9DC] cursor-pointer"
                                size={18}
                                onClick={() => navigate(`/dashboard/Categories/${child.id}/edit`)}
                              />
                            </td>

                            <td className="py-1.5 md:py-2 px-2 md:px-4">
                              <Trash2
                                className="text-red-500 cursor-pointer"
                                size={18}
                                onClick={() => requestDelete(child.id)}
                              />
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-500">
                      Aucune catégorie.
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination (pas pour catégories) */}
      {count > 0 && activeTab !== "categories" && (
        <div className="flex justify-center mt-4">
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-3 py-1 border rounded-full text-sm ${
                  n === page ? "bg-[#00A9DC] text-white" : "bg-white hover:bg-blue-100"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmId !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
          onClick={() => (confirmLoading ? null : setConfirmId(null))}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              {deleteErrorMsg ? "Suppression impossible" : "Confirmation"}
            </h3>

            {/* 👉 Cas ERREUR */}
            {deleteErrorMsg ? (
              <>
                <p className="mt-4 text-sm text-red-600 whitespace-pre-line">
                  {deleteErrorMsg}
                </p>

                <div className="mt-6 flex justify-end">
                  <button
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      setDeleteErrorMsg(null);
                      setConfirmId(null);
                    }}
                  >
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 👉 Cas NORMAL */}
                <p className="mt-2 text-sm text-gray-600">
                  {deleteMode === "bulk" && activeTab === "produits" ? (
                    <>
                      Voulez-vous vraiment supprimer{" "}
                      <b>{bulkIds.length}</b> produit(s) sélectionné(s) ?
                      <br />
                      <span className="text-red-600 font-semibold">
                        Cette action supprimera aussi les variantes, images et
                        spécifications liées.
                      </span>
                    </>
                  ) : (
                    <>
                      Voulez-vous vraiment supprimer ce{" "}
                      {activeTab === "produits"
                        ? "produit"
                        : activeTab === "articles"
                        ? "article"
                        : "catégorie"}
                      ?
                      {activeTab === "produits" && (
                        <>
                          <br />
                          <span className="text-red-600 font-semibold">
                            Cette action supprimera aussi les variantes, images et
                            spécifications liées.
                          </span>
                        </>
                      )}
                      {activeTab === "categories" && (
                        <>
                          <br />
                          <span className="text-red-600 font-semibold">
                            Cette action est définitive. La suppression sera refusée si la
                            catégorie possède des sous-catégories ou des produits rattachés.
                          </span>
                        </>
                      )}
                    </>
                  )}
                </p>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-100"
                    onClick={() => setConfirmId(null)}
                    disabled={confirmLoading}
                  >
                    Annuler
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={handleDeleteConfirmed}
                    disabled={confirmLoading}
                  >
                    {confirmLoading
                      ? "Suppression..."
                      : deleteMode === "bulk" && activeTab === "produits"
                      ? `Oui, supprimer (${bulkIds.length})`
                      : "Oui, supprimer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductTable;
