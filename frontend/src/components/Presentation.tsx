
import * as React from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiChevronDown,
} from "react-icons/fi";
import { MdClose } from "react-icons/md";
import iphone from "../assets/images/Apple Iphone 15 Black Smartphone PNG _ TopPNG.png";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";
import {
  useTopCategories,
  useFilters,
  useProducts,
  type ApiProduct,
  recordProductClick,
  media,
} from "../hooks/useFetchQuery";

import type { ProduitMini } from "../pages/Produits";

/* ==================== UI Types ==================== */
type Option = { label: string; value: string };
type Filter = { title: string; code: string; options: Option[] };

type FilterGroupProps = Filter & {
  selected?: string;
  onSelect: (code: string, v: string) => void;
};

type PresentationProps = {
  onOrder: (p: ProduitMini) => void;
};

/* ==================== Animations ==================== */

// Ease réutilisable
const EASE_CUBIC = [0.22, 1, 0.36, 1] as const;

// --- Transitions typées ---
const TWEEN_500: Transition = {
  type: "tween",
  duration: 0.5,
  ease: EASE_CUBIC,
};
const TWEEN_550: Transition = {
  type: "tween",
  duration: 0.55,
  ease: EASE_CUBIC,
};
const TWEEN_600: Transition = {
  type: "tween",
  duration: 0.66,
  ease: EASE_CUBIC,
};
const TWEEN_400: Transition = {
  type: "tween",
  duration: 0.4,
  ease: EASE_CUBIC,
};

// --- Variants typés ---
const headerEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: TWEEN_500 },
};

const crumbFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { ...TWEEN_400, delay: 0.15 } },
};

const h1Down: Variants = {
  hidden: { y: -16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { ...TWEEN_600, delay: 0.25 } },
};

const phonePop: Variants = {
  hidden: { y: 8, scale: 0.98, opacity: 0 },
  show: { y: 0, scale: 1, opacity: 1, transition: TWEEN_550 },
};

/* ==================== Constantes UI ==================== */
const ACCENT = "bg-[#00A8E8] text-white border-[#00A8E8]";
const ACCENT_HOVER = "hover:opacity-90";

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='16'%3EImage indisponible%3C/text%3E%3C/svg%3E";

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/* ==================== Sous-composants ==================== */

const FilterGroup: React.FC<FilterGroupProps> = ({
  title,
  code,
  options,
  selected,
  onSelect,
}) => {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between mt-8 select-none cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <h4 className="text-sm font-semibold tracking-wide text-gray-700">
          {title}
        </h4>

        <button
          type="button"
          aria-label={open ? "Réduire" : "Déployer"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={`p-1 rounded-md text-[#00A8E8] transition-transform duration-300
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00A8E8]
                      ${open ? "rotate-180" : ""}`}
        >
          <FiChevronDown className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 border-t border-[#00A8E8]" />

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-2 text-sm">
            {(options ?? []).map((opt, idx) => {
              const val = String(opt.value ?? opt.label ?? "");
              const isChecked = selected === val;
              const inputId = `${code}-${idx}`;
              const optionKey = `${code}::${val}::${idx}`;

              return (
                <label
                  key={optionKey}
                  htmlFor={inputId}
                  className="flex items-center gap-2"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={code}
                    value={val}
                    checked={isChecked}
                    onClick={(e) => {
                      if (isChecked) {
                        e.preventDefault();
                        onSelect(code, "");
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    onChange={() => {
                      if (!isChecked) onSelect(code, val);
                    }}
                    className="h-4 w-4 rounded-full border border-gray-300 accent-gray-300 checked:accent-[#00A8E8] transition-all duration-200"
                  />
                  <span
                    className={`transition-colors duration-200 ${
                      isChecked
                        ? "text-[#00A8E8] font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{
  slug: string;
  categorySlug?: string;
  name: string;
  price?: number | null;
  oldPrice?: number | null;
  img?: string;
  desc?: string;
  promoNow?: boolean;
  promoFin?: string | null;
  onOrder?: () => void;
}> = ({ slug, categorySlug, name, price, oldPrice, img, desc, promoNow, promoFin, onOrder }) => {
  const { t } = useTranslation();

const productHref =
  categorySlug && categorySlug !== "tous"
    ? `/produits/${categorySlug}/${slug}`
    : `/produit/${slug}`;

console.log("ProductCard =>", { categorySlug, slug, productHref });

  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-lg">
      <Link to={productHref} className="block">
  <div className="relative w-full bg-white border border-gray-100 rounded-xl">
    {promoNow && (
      <span className="absolute top-2 left-2 z-20 bg-red-600 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-lg ring-1 ring-red-500/30 pointer-events-none select-none">
        PROMO
      </span>
    )}
    <div className="pt-[100%] md:pt-[75%]" />
    <img
      src={img}
      alt={name}
      loading="lazy"
      width={800}
      height={600}
      className="absolute inset-0 h-full w-full object-contain rounded-xl transition-transform duration-300 ease-out group-hover:scale-[1.02]"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
      }}
    />
  </div>
</Link>

<Link to={productHref} className="block">
  <h3 className="mt-3 text-[15px] sm:text-base font-semibold text-gray-900 hover:text-[#00A8E8]">
    {name}
  </h3>
</Link>
      {desc ? (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{desc}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        {typeof price === "number" ? (
          <span className="text-xl sm:text-xl md:text-sm lg:text-2xl font-bold text-gray-900">
            {fmt(price)}
          </span>
        ) : (
          <span />
        )}
        {typeof oldPrice === "number" &&
          typeof price === "number" &&
          oldPrice > price && (
            <span className="text-sm sm:text-base md:text-text-base lg:text-lg text-gray-500 line-through">
              {fmt(oldPrice)}
            </span>
          )}
      </div>

      {promoNow && promoFin && (
        <p className="mt-1 text-xs text-gray-500">
          🔔 Offre valable jusqu’au{" "}
          {new Date(promoFin).toLocaleDateString("fr-FR")}
        </p>
      )}

      <div className="mt-3 flex items-center">
        <button
          onClick={onOrder}
          className="rounded-lg border px-3 py-1.5 text-sm sm:text-md font-medium bg-[#00A8E8] text-white border-[#00A8E8] hover:opacity-90"
        >
          {t("stat2.commander")}
        </button>
      </div>
    </article>
  );
};

/* ==================== Composant principal ==================== */

const Presentation: React.FC<PresentationProps> = ({ onOrder }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get("q") || "").trim();
  const { categorySlug: urlCategorySlug } = useParams();
const navigate = useNavigate();
  // 🔁 Rafraîchir la page quand on arrive avec ?refresh=1
  React.useEffect(() => {
    const flag = searchParams.get("refresh");
    if (flag === "1") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("refresh");

      const newSearch = params.toString();
      const newUrl =
        newSearch.length > 0
          ? `${window.location.pathname}?${newSearch}`
          : window.location.pathname;

      window.history.replaceState(null, "", newUrl);
      window.location.reload();
    }
  }, [searchParams]);

  /** Carrousel catégories — md+ */
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);
  const [scrollable, setScrollable] = React.useState(false);
  const EPS = 4;

  const syncEdges = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setScrollable(scrollWidth > clientWidth + 1);
    setAtStart(scrollLeft <= EPS);
    setAtEnd(scrollLeft >= scrollWidth - clientWidth - EPS);
  }, []);

  const scrollStep = (dir: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(160 + 32, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir === "prev" ? -step : step, behavior: "smooth" });
    setTimeout(syncEdges, 220);
    setTimeout(syncEdges, 420);
  };

  const handlePrev = () => scrollStep("prev");
  const handleNext = () => scrollStep("next");

  React.useEffect(() => {
    syncEdges();
    const onResize = () => syncEdges();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncEdges]);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(syncEdges);
    return () => cancelAnimationFrame(id);
  }, [syncEdges]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncEdges());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges]);

  React.useEffect(() => {
    // @ts-ignore
    if ((document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => syncEdges());
    }
  }, [syncEdges]);

  /** Catégorie active (slug) + sous-catégorie (slug) */
const [categorySlug, setCategorySlug] = React.useState<string>(
  urlCategorySlug || "tous"
);
  const [subSlug, setSubSlug] = React.useState<string>("");
React.useEffect(() => {
  setCategorySlug(urlCategorySlug || "tous");
  setSubSlug("");
}, [urlCategorySlug]);
  /** Sélections de filtres */
  const [selected, setSelected] = React.useState<Record<string, string>>({});
  const onSelect = (code: string, value: string) => {
    setSelected((s) => ({ ...s, [code]: value }));
  };

  /** Pagination */
  const PAGE_SIZE = 24;
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [q]);

  React.useEffect(() => {
    setPage(1);
  }, [categorySlug, subSlug, selected]);

  /* ==================== Catégories top-level ==================== */
  const {
    data: apiCategories = [],
    loading: catsLoading,
    error: catsError,
  } = useTopCategories({ level: 1 });

  const cats = apiCategories ?? [];

  // 🔹 Ne garder que les catégories racines (pas les sous-catégories)
  const topCats = cats.filter((c: any) => {
    const parentField = c.parent_id ?? c.parent ?? null;
    return parentField === null || parentField === undefined;
  });

const activeCategory = React.useMemo(() => {
  if (categorySlug === "tous") return null;
  return topCats.find((c: any) => c.slug === categorySlug) ?? null;
}, [topCats, categorySlug]);

  React.useEffect(() => {
    const id = requestAnimationFrame(syncEdges);
    return () => cancelAnimationFrame(id);
  }, [cats.length, syncEdges]);

  /* ==================== Filtres globaux ==================== */
  const filterParams = React.useMemo(
    () => ({
      category: categorySlug,
      subcategory: subSlug || undefined,
    }),
    [categorySlug, subSlug]
  );

  const { data: filtersPayload, loading: filtersLoading } =
    useFilters(filterParams);

  const FILTERS: Filter[] = React.useMemo(() => {
    const base: Filter[] = [];

    if (filtersPayload?.brands?.length) {
      base.push({
        title: t("filters.brand"),
        code: "brand",
        options: filtersPayload.brands.map((b) => ({
          label: b.nom,
          value: b.slug,
        })),
      });
    }

    if (filtersPayload?.colors?.length) {
      base.push({
        title: t("filters.color"),
        code: "color",
        options: filtersPayload.colors.map((c) => ({
          label: c.nom,
          value: c.slug,
        })),
      });
    }

    if (filtersPayload?.states?.length) {
      base.push({
        title: t("filters.state"),
        code: "etat",
        options: (filtersPayload.states as any[]).map((s: any) => ({
          label: s.label ?? s.value,
          value: s.value ?? s.label,
        })),
      });
    }

    if (filtersPayload?.attributes?.length) {
      filtersPayload.attributes.forEach((a) => {
        const opts: Option[] = (a.options ?? []).map((o: any) => {
          if (o && typeof o === "object" && ("valeur" in o || "slug" in o)) {
            const label = String(o.valeur ?? o.slug ?? "");
            const value = String(o.slug ?? o.valeur ?? "");
            return { label, value };
          }
          const s = String(o);
          return { label: s, value: s };
        });

        if (opts.length) {
          base.push({
            title: a.libelle,
            code: `attr_${a.code}`,
            options: opts,
          });
        }
      });
    }

    return base;
  }, [filtersPayload, t]);

  /* ==================== Produits ==================== */
  const productParams = React.useMemo(() => {
    const qp: Record<string, any> = {
      category: categorySlug,
      subcategory: subSlug || undefined,
      page,
      page_size: PAGE_SIZE,
    };
    if (q) qp.q = q;
    Object.entries(selected).forEach(([k, v]) => {
      if (v) qp[k] = v;
    });
    return qp;
  }, [categorySlug, subSlug, page, selected, q]);

  const { data: productPage, loading: productsLoading } =
    useProducts(productParams);

  const products = productPage?.results ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((productPage?.count ?? 0) / PAGE_SIZE)
  );
  const goto = (n: number) =>
    setPage(Math.min(Math.max(1, n), totalPages));

  /* ==================== Helpers ==================== */
  const firstImageUrl = (p: ApiProduct): string | undefined => {
    if (Array.isArray(p.images) && p.images.length) {
      const primary = p.images.find((im) => im.principale) ?? p.images[0];
      return primary?.url || undefined;
    }
    return undefined;
  };

  /* ==================== Tiroirs mobile ==================== */
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [mobileCatsOpen, setMobileCatsOpen] = React.useState(false);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileFiltersOpen || mobileCatsOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFiltersOpen, mobileCatsOpen]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const showArrows = scrollable || catsLoading || cats.length > 0;

  const orderAndTrack = async (prod: ApiProduct, img: string) => {
    try {
      await recordProductClick(prod.id);
    } catch {
      // on ignore pour ne pas casser l'UX
    }
    onOrder({
      id: prod.id,
      slug: prod.slug,
      nom: prod.nom,
      ref: prod.slug?.toUpperCase() ?? "",
      image: img,
    });
  };

  return (
    <>
      {/* ===== ENTÊTE ===== */}
      <motion.div
        className="w-full bg-gray-100"
        variants={headerEnter}
        initial="hidden"
        animate="show"
      >
        <div className="container mx-auto px-5">
          <div className="flex items-center justify-between h-35 md:h-40 lg:h-48 ">
            <div className="min-w-0 mt-6">
              <motion.div
                className="text-xs sm:text-sm text-gray-500"
                variants={crumbFade}
                initial="hidden"
                animate="show"
              >
                {t("Accueil")}{" "}
                <span className="text-gray-400">›</span> {t("Produits")}
              </motion.div>

              <motion.h1
                className="mt-1 font-extrabold leading-tight tracking-tight text-xl sm:text-xl md:text-2xl lg:text-4xl"
                variants={h1Down}
                initial="hidden"
                animate="show"
              >
                {t("bar.description")}
              </motion.h1>

              {activeCategory ? (
  <div className="mt-3 max-w-3xl">
    <h2 className="text-lg md:text-xl font-bold text-gray-900">
      {activeCategory.nom}
    </h2>
    {activeCategory.description ? (
      <p className="mt-2 text-sm md:text-base text-gray-600">
        {activeCategory.description}
      </p>
    ) : null}
  </div>
) : (
  <div className="mt-3 max-w-3xl">
  <p className="text-sm md:text-base text-gray-600">
  {t("products.seo.defaultDescription")}
</p>
  </div>
)}
            </div>

            <motion.div
              className="sm:block pt-6"
              variants={phonePop}
              initial="hidden"
              animate="show"
            >
              <div
                className="h-20 md:h-24 lg:h-28 xl:h-32 w-auto rounded-xl"
                style={{ perspective: 1000, overflow: "visible" }}
              >
                <motion.img
                  src={iphone}
                  alt="Produit vedette"
                  animate={{ rotateY: 360, scale: 0.92 }}
                  transition={{
                    duration: 12,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                  style={{
                    transformOrigin: "50% 50%",
                    transformStyle: "preserve-3d",
                  }}
                  className="h-full w-auto object-contain select-none will-change-transform"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ===== Catégories (mobile + carrousel) ===== */}
      <div className="container mx-auto px-5 pt-10">
        <div className="uppercase tracking-wider text-[11px] md:text-xs font-semibold text-gray-600 mb-3 md:mb-4 hidden md:block">
          {t("bar.cat")}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-3 lg:hidden mb-3 md:mb-4">
          <button
            type="button"
            onClick={() => setMobileCatsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.99]"
            aria-label={t("mobile.openCategories")}
          >
            <FiMenu className="h-5 w-5" />
            {t("mobile.categories")}
          </button>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.99]"
            aria-label={t("mobile.openFilters")}
          >
            <FiMenu className="h-5 w-5" />
            {t("mobile.filters")}
          </button>
        </div>

        {/* Carrousel (md+) */}
        <div className="hidden md:flex items-center gap-3 mt-0">
          <div
            ref={trackRef}
            onScroll={syncEdges}
            className="flex-1 overflow-x-auto whitespace-nowrap scroll-smooth
                       [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex gap-3 lg:gap-4">
              <button
                type="button"
   onClick={() => {
  setCategorySlug("tous");
  setSubSlug("");
  navigate("/produits");
}}
                className={[
                  "shrink-0 rounded-md border font-medium px-4 lg:px-5 py-2",
                  categorySlug === "tous"
                    ? `${ACCENT} ${ACCENT_HOVER}`
                    : "bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]",
                ].join(" ")}
                title="Afficher tout"
              >
                {t("tous")}
              </button>

             {(catsLoading ? [] : topCats).map((c: any) => {
  const active = categorySlug === c.slug;
  return (
    <button
      key={c.slug}
      type="button"
      onClick={() => {
        const slug = active ? "tous" : (c.slug as string) || "";
        setCategorySlug(slug);
        setSubSlug("");

        if (slug === "tous") {
          navigate("/produits");
        } else {
          navigate(`/produits/${slug}`);
        }
      }}
      className={[
        "shrink-0 rounded-md border font-medium whitespace-nowrap px-4 lg:px-5 py-2",
        active
          ? `${ACCENT} ${ACCENT_HOVER}`
          : "bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]",
      ].join(" ")}
      title={c.nom}
    >
      {c.nom}
    </button>
  );
})}
            </div>
          </div>

          <div
            className={`shrink-0 flex items-center gap-2 ${
              showArrows ? "" : "opacity-0 pointer-events-none"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                handlePrev();
              }}
              aria-label="Précédent"
              disabled={atStart}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-gray-700 ${
                !atStart
                  ? "border-gray-200 hover:border-[#00A8E8]"
                  : "border-gray-100 opacity-40 cursor-not-allowed"
              }`}
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                handleNext();
              }}
              aria-label="Suivant"
              disabled={atEnd}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-gray-700 ${
                !atEnd
                  ? "border-gray-200 hover:border-[#00A8E8]"
                  : "border-gray-100 opacity-40 cursor-not-allowed"
              }`}
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {catsError && (
          <div className="mt-2 text-sm text-red-600">
            {/* Erreur catégories (optionnel) */}
          </div>
        )}
      </div>

      {/* Bandeau Résultats pour ... */}
      {q && (
        <div className="max-w-screen-4xl mx-auto px-5 mt-6">
          <div className="rounded-lg border border-[#00A8E8]/40 bg-[#E5F7FF] px-4 py-3 text-sm md:text-[15px] text-gray-800 shadow-sm">
            <span className="font-medium">Résultats pour&nbsp;</span>
            <span className="font-semibold text-[#00A8E8]">“{q}”</span>
          </div>
        </div>
      )}

      {/* ===== CONTENU (Sidebar + Grille) ===== */}
      <div className="bg-white">
        <div className="max-w-screen-4xl mx-auto px-5  py-6 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-8">
            {/* Sidebar desktop */}
            <aside
              className="
                hidden lg:block sticky top-24
                rounded-2xl border border-gray-200 bg-white p-5 shadow-sm
                max-h-[calc(100vh-7rem)]
                overflow-y-hidden hover:overflow-y-auto
              "
            >
              <h3 className="text-lg font-bold text-gray-900">
                {t("mobile.filters")}
              </h3>
              <div className="mt-4 border-t border-[#00A8E8] pt-4">
                {(filtersLoading ? [] : FILTERS).map((f) => (
                  <FilterGroup
                    key={f.code}
                    {...f}
                    selected={selected[f.code] ?? ""}
                    onSelect={onSelect}
                  />
                ))}

                {FILTERS.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    <button
                      className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]"
                      onClick={() => setSelected({})}
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Produits + pagination */}
            <main>
              {/* Loader pendant le chargement initial */}
              {productsLoading && products.length === 0 && (
                <div className="py-16 flex items-center justify-center">
                  {/* Vous pouvez afficher un spinner ici si vous voulez */}
                </div>
              )}

              {/* Message si aucun produit après chargement */}
              {!productsLoading && products.length === 0 && (
                <div className="py-10 text-center text-gray-500">
                  {q
                    ? "Aucun produit ne correspond à cette recherche."
                    : "Aucun produit trouvé."}
                </div>
              )}

              {/* Grille de produits */}
              {!productsLoading && products.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    {products.map((p) => {
                      const raw = firstImageUrl(p) || "";
                      const img = raw ? media(raw) : FALLBACK_IMG;
                      return (
                   <ProductCard
  key={p.id}
  slug={p.slug}
  categorySlug={categorySlug}
  name={p.nom}
  price={
    p?.prix_from != null
      ? Number(p.prix_from as any)
      : null
  }
  oldPrice={
    p?.promo_now && p?.old_price_from != null
      ? Number(p.old_price_from as any)
      : null
  }
  img={img}
  desc={p.description_courte}
  promoNow={p.promo_now}
  promoFin={p.promo_fin ?? null}
  onOrder={() => orderAndTrack(p, img)}
/>
                      );
                    })}
                  </div>

                  {(productPage?.count ?? 0) > 12 && (
                    <div className="mt-10 flex items-center justify-center gap-2">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white hover:border-[#00A8E8]"
                        onClick={() => goto(page - 1)}
                        disabled={page === 1}
                        aria-label="Page précédente"
                      >
                        <FiChevronLeft />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .slice(0, 5)
                        .map((n) => (
                          <button
                            key={n}
                            onClick={() => goto(n)}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
                              n === page
                                ? `${ACCENT} ${ACCENT_HOVER}`
                                : "bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white hover:border-[#00A8E8]"
                        onClick={() => goto(page + 1)}
                        disabled={page === totalPages}
                        aria-label="Page suivante"
                      >
                        <FiChevronRight />
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* ===== TIROIR CATÉGORIES — MOBILE ===== */}
      {mobileCatsOpen && (
        <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileCatsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold">Catégories</h3>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileCatsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <div className="pt-3">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                 onClick={() => {
  setCategorySlug("tous");
  setSubSlug("");
  navigate("/produits");
  setMobileCatsOpen(false);
}}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium text-left ${
                    categorySlug === "tous"
                      ? `${ACCENT} ${ACCENT_HOVER}`
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]"
                  }`}
                >
                  Tous
                </button>

                {(catsLoading ? [] : topCats).map((c: any) => {
                  const active = categorySlug === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => {
  const slug = active ? "tous" : (c.slug as string) || "";
  setCategorySlug(slug);
  setSubSlug("");
  navigate(`/produits/${slug}`);
                        setMobileCatsOpen(false);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium text-left ${
                        active
                          ? `${ACCENT} ${ACCENT_HOVER}`
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#00A8E8]"
                      }`}
                    >
                      {c.nom}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TIROIR FILTRES — MOBILE ===== */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold">{t("mobile.filters")}</h3>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileFiltersOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <div className="border-t border-[#00A8E8] pt-4">
              {(filtersLoading ? [] : FILTERS).map((f) => (
                <FilterGroup
                  key={f.code}
                  {...f}
                  selected={selected[f.code] ?? ""}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Presentation;
