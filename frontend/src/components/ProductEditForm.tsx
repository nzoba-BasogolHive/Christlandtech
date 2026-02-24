
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useDashboardCategories,
  useMarques,
  useCouleurs,
  useFilters,
  uploadProductImage,
  getDashboardProduct,
  updateDashboardProductDeep,
} from "../hooks/useFetchQuery";
import ComboCreate, { type ComboOption } from "./ComboCreate";
import DateTimePicker from "./DateTimePicker";
import { useQueryClient } from "@tanstack/react-query";

/* ---------------- Types locaux ---------------- */
type ProduitFormState = {
  nom: string;
  slug: string;
  description_courte: string;
  description_long: string;
  garantie_mois: number | null;
  poids_grammes: number | null;
  dimensions: string;
  etat: "neuf" | "occasion" | "reconditionné";
  categorie: string;
  sous_categorie: string;
  marque: string;
  marque_libre: string;
  est_actif: boolean;
  visible: 0 | 1 | null;
 capacite_stockage: number | null;
  // Variante
  variante_nom: string;
  sku: string;
  code_barres: string;
  prix: number | null;
  prix_promo: number | null;
  promo_active: boolean;
  promo_debut: string;
  promo_fin: string;
  stock: number | null;
  prix_achat: number | null;
  variante_poids_grammes: number | null;
  variante_est_actif: boolean;

  // Couleur
  couleur: string;
  couleur_libre: string;
};

type ImgRow = {
  url: string;
  alt_text?: string;
  position?: number | null;
  principale?: boolean;
  _localFile?: File | null;
  _uploading?: boolean;
  _error?: string | null;
};

type AttrMeta = {
  code: string;
  libelle: string;
  type?: "text" | "int" | "dec" | "bool" | "choice";
  options?: { valeur: string; slug?: string }[] | string[];
};

/* ---------------- UI ---------------- */
const Toast: React.FC<{ kind: "success" | "error"; msg: string; onClose(): void }> = ({
  kind,
  msg,
  onClose,
}) => (
  <div
    className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-lg px-4 py-3 text-white ${
      kind === "success" ? "bg-emerald-600" : "bg-rose-600"
    }`}
    role="status"
  >
    <div className="flex items-start gap-3">
      <span className="font-semibold">{kind === "success" ? "Succès" : "Erreur"}</span>
      <span className="opacity-90">{msg}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-3 text-white/90 hover:text-white"
        aria-label="Fermer la notification"
      >
        ×
      </button>
    </div>
  </div>
);

const etatOptions: ComboOption[] = [
  { id: "neuf", label: "Neuf" },
  { id: "reconditionné", label: "Reconditionné" },
  { id: "occasion", label: "Occasion" },
];

/* =========================================================
   Composant
========================================================= */
const ProductEditForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories } = useDashboardCategories();
  const { data: marques } = useMarques();
  const { data: couleurs } = useCouleurs();

  const [subCategories, setSubCategories] = useState<ComboOption[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(
    null
  );

  // attributs dynamiques
  const [prodAttrs, setProdAttrs] = useState<Record<string, any>>({});
  const [varAttrs, setVarAttrs] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState<ProduitFormState>({
    nom: "",
    slug: "",
    description_courte: "",
    description_long: "",
    garantie_mois: null,
    poids_grammes: null,
    dimensions: "",
    etat: "neuf",
    categorie: "",
    sous_categorie: "",
    marque: "",
    marque_libre: "",
    est_actif: true,
    visible: 1,
    capacite_stockage: null,
    variante_nom: "",
    sku: "",
    code_barres: "",
    prix: null,
    prix_promo: null,
    promo_active: false,
    promo_debut: "",
    promo_fin: "",
    stock: null,
    prix_achat: null,
    variante_poids_grammes: null,
    variante_est_actif: true,
    couleur: "",
    couleur_libre: "",
  });

  const [images, setImages] = useState<ImgRow[]>([
    {
      url: "",
      alt_text: "",
      position: 1,
      principale: true,
      _localFile: null,
      _uploading: false,
      _error: null,
    },
  ]);

  /* ---------- Helpers UI ---------- */
  const toOptions = (rows: any[] | null | undefined): ComboOption[] =>
    (rows ?? []).map((r: any) => ({
      id: r.id ?? r.slug ?? r.nom,
      label: r.nom ?? r.slug ?? String(r),
    }));

  const brandOptions = toOptions(marques);
  const colorOptions = toOptions(couleurs);

  // Catégories racines
  const rootCategoryOptions: ComboOption[] = useMemo(() => {
    if (!Array.isArray(categories)) return [];

    const roots = (categories as any[]).filter((c) => {
      const rawParent = (c as any).parent ?? (c as any).parent_id ?? null;
      const parentId =
        rawParent && typeof rawParent === "object"
          ? (rawParent as any).id ?? (rawParent as any).slug ?? null
          : rawParent;

      return !parentId;
    });

    return toOptions(roots);
  }, [categories]);

  const updateVariant = (index: number, key: string, value: any) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index][key] = value;
      return updated;
    });
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const brandValue =
    formData.marque === "__custom__"
      ? formData.marque_libre
        ? { id: "__custom__", label: formData.marque_libre }
        : null
      : brandOptions.find((o) => String(o.id) === String(formData.marque)) ??
        brandOptions.find((o) => String(o.label) === String(formData.marque)) ??
        null;

  const colorValue =
    formData.couleur === "__custom__"
      ? formData.couleur_libre
        ? { id: "__custom__", label: formData.couleur_libre }
        : null
      : colorOptions.find((o) => String(o.id) === String(formData.couleur)) ??
        colorOptions.find((o) => String(o.label) === String(formData.couleur)) ??
        null;

  const onCategoryChange = (opt: ComboOption | null) =>
    setFormData((p) => ({
      ...p,
      categorie: opt ? String(opt.id) : "",
      sous_categorie: "",
    }));

  const onBrandChange = (opt: ComboOption | null) => {
    if (!opt) return setFormData((p) => ({ ...p, marque: "", marque_libre: "" }));
    if (brandOptions.some((o) => String(o.id) === String(opt.id))) {
      setFormData((p) => ({ ...p, marque: String(opt.id), marque_libre: "" }));
    } else {
      setFormData((p) => ({ ...p, marque: "__custom__", marque_libre: opt.label }));
    }
  };

  const onColorChange = (opt: ComboOption | null) => {
    if (!opt) return setFormData((p) => ({ ...p, couleur: "", couleur_libre: "" }));
    if (colorOptions.some((o) => String(o.id) === String(opt.id))) {
      setFormData((p) => ({ ...p, couleur: String(opt.id), couleur_libre: "" }));
    } else {
      setFormData((p) => ({ ...p, couleur: "__custom__", couleur_libre: opt.label }));
    }
  };

  const etatValue =
    etatOptions.find((o) => String(o.id) === String(formData.etat)) ?? null;
  const onEtatChange = (opt: ComboOption | null) =>
    setFormData((p) => ({
      ...p,
      etat: (opt?.id as ProduitFormState["etat"]) ?? "neuf",
    }));

  // const addImage = () =>
  //   setImages((arr) => [
  //     ...arr,
  //     {
  //       url: "",
  //       alt_text: "",
  //       position: (arr[arr.length - 1]?.position ?? arr.length) + 1,
  //       principale: false,
  //       _localFile: null,
  //       _uploading: false,
  //       _error: null,
  //     },
  //   ]);

  // const removeImage = (idx: number) =>
  //   setImages((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));

  // const updateImage = (idx: number, patch: Partial<ImgRow>) =>
  //   setImages((arr) => arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // const setPrincipale = (idx: number) =>
  //   setImages((arr) => arr.map((r, i) => ({ ...r, principale: i === idx })));

  // const onSelectFile = async (idx: number, file: File | null) => {
  //   if (!file) {
  //     updateImage(idx, { _localFile: null, _error: null });
  //     return;
  //   }
  //   updateImage(idx, { _localFile: file, _uploading: true, _error: null });
  //   try {
  //     const { url } = await uploadProductImage(file);
  //     updateImage(idx, { url, _uploading: false, _error: null });
  //     setImages((arr) => {
  //       if (!arr.some((a) => a.principale)) {
  //         return arr.map((a, i) => (i === idx ? { ...a, principale: true } : a));
  //       }
  //       return arr;
  //     });
  //   } catch (e: any) {
  //     updateImage(idx, { _uploading: false, _error: e?.message || "Upload échoué" });
  //     setToast({
  //       kind: "error",
  //       msg: e?.message || "Échec de l’upload de l’image.",
  //     });
  //   }
  // };


const onSelectFile = async (_idx: number, file: File | null) => {
  if (!file) return;

  setImages([{
    url: images[0]?.url ?? "",
    alt_text: images[0]?.alt_text ?? "",
    position: 1,
    principale: true,
    _localFile: file,
    _uploading: true,
    _error: null,
  }]);

  try {
    const { url } = await uploadProductImage(file);
    setImages([{
      url,
      alt_text: images[0]?.alt_text ?? "",
      position: 1,
      principale: true,
      _localFile: null,
      _uploading: false,
      _error: null,
    }]);
  } catch (e:any) {
    setImages([{
      url: images[0]?.url ?? "",
      alt_text: images[0]?.alt_text ?? "",
      position: 1,
      principale: true,
      _localFile: null,
      _uploading: false,
      _error: e?.message || "Upload échoué",
    }]);
  }
};


  const numericKeys = new Set([
    "garantie_mois",
    "poids_grammes",
    "prix",
    "prix_promo",
    "stock",
    "prix_achat",
    "variante_poids_grammes",
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const t = e.currentTarget;
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      setFormData((p) => ({ ...p, [t.name]: t.checked }));
      return;
    }
    if (t.name === "visible") {
      const v = t.value === "" ? null : (Number(t.value) as 0 | 1);
      setFormData((p) => ({ ...p, visible: v }));
      return;
    }
    let val: any = t.value;
    if (numericKeys.has(t.name)) val = val === "" ? null : Number(val);
    setFormData((p) => ({ ...p, [t.name]: val }));
  };

  /* ---------- Chargement du produit + variantes + attributs ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        const prod: any = await getDashboardProduct(Number(id));

        // Variantes
       // Variantes
const rawVariants: any[] = Array.isArray(prod?.variants) ? prod.variants : [];
const uniqueVariants = rawVariants.filter((v, index) => {
  if (!v.id) return true;
  return index === rawVariants.findIndex((vv) => vv.id === v.id);
});

const getAttr = (v: any, code: string) => {
  const arr = v?.attributes ?? v?.variant_attributes ?? [];
  const found = Array.isArray(arr) ? arr.find((a: any) => a?.code === code) : null;
  return found?.value ?? null;
};

// ✅ variante principale (celle affichée dans formData)
const firstVar = prod?.variant ?? null;
const firstVarId = firstVar?.id != null ? String(firstVar.id) : null;

// ✅ on retire la principale de la liste "variants"
const variantsSansPrincipale = uniqueVariants.filter((v) => {
  if (!firstVarId) return true;   // si on n'a pas d'ID de principale, on garde tout
  if (v?.id == null) return true; // si pas d'id (nouvelle), on la garde
  return String(v.id) !== firstVarId;
});

setVariants(
  variantsSansPrincipale.map((v: any) => ({
    id: v.id ?? null,
    variante_nom: v.nom ?? "",
    sku: v.sku ?? "",
    code_barres: v.code_barres ?? "",
    prix: v.prix ?? null,
    prix_promo: v.prix_promo ?? null,
    promo_active: !!v.promo_active,
    promo_debut: v.promo_debut ? String(v.promo_debut).slice(0, 16) : "",
    promo_fin: v.promo_fin ? String(v.promo_fin).slice(0, 16) : "",
    stock: v.stock ?? null,
    capacite_stockage: getAttr(v, "capacite_stockage"),
    prix_achat: v.prix_achat ?? null,
    variante_poids_grammes: v.variante_poids_grammes ?? null,
    couleur: v.couleur?.id ?? v.couleur?.slug ?? "",
    couleur_libre: "",
    variante_est_actif: !!v.variante_est_actif,
    attributes: v.attributes ?? v.variant_attributes ?? [],
  }))
);
        const rawCat = prod?.categorie ?? null;
        const rawSub = prod?.sous_categorie ?? null;

        let categorieVal = "";
        let sousCategorieVal = "";

        if (rawCat) {
          if (typeof rawCat === "number" || typeof rawCat === "string") {
            categorieVal = String(rawCat);
          } else if (typeof rawCat === "object") {
            const catId = rawCat.id ?? rawCat.slug ?? "";
            categorieVal = String(catId);

            const rawParent = rawCat.parent ?? rawCat.parent_id ?? null;
            const parentId =
              rawParent && typeof rawParent === "object"
                ? rawParent.id ?? rawParent.slug ?? null
                : rawParent;

            if (!sousCategorieVal && parentId) {
              categorieVal = String(parentId);
              sousCategorieVal = String(rawCat.id ?? rawCat.slug ?? "");
            }
          }
        }

        if (rawSub && !sousCategorieVal) {
          if (typeof rawSub === "object") {
            sousCategorieVal = rawSub.id ? String(rawSub.id) : "";
          } else {
            sousCategorieVal = String(rawSub);
          }
        }

        setFormData((p) => ({
          ...p,
          nom: prod?.nom ?? "",
          slug: prod?.slug ?? "",
          description_courte: prod?.description_courte ?? "",
          description_long: prod?.description_long ?? "",
          garantie_mois: prod?.garantie_mois ?? null,
          poids_grammes: prod?.poids_grammes ?? null,
          dimensions: prod?.dimensions ?? "",
          etat: prod?.etat ?? "neuf",
          capacite_stockage: firstVar ? Number(getAttr(firstVar, "capacite_stockage")) : null,
          categorie: categorieVal,
          sous_categorie: sousCategorieVal,

          marque: prod?.marque?.id ?? prod?.marque?.slug ?? prod?.marque?.nom ?? "",
          est_actif: !!prod?.est_actif,
          visible: (prod?.visible ?? 1) as 0 | 1,

          variante_nom: firstVar?.nom ?? "",
          sku: firstVar?.sku ?? "",
          code_barres: firstVar?.code_barres ?? "",
          prix: firstVar?.prix ?? null,
          prix_promo: firstVar?.prix_promo ?? null,
          promo_active: !!firstVar?.promo_active,
          promo_debut: firstVar?.promo_debut
            ? String(firstVar.promo_debut).slice(0, 16)
            : "",
          promo_fin: firstVar?.promo_fin
            ? String(firstVar.promo_fin).slice(0, 16)
            : "",
          stock: firstVar?.stock ?? null,
          prix_achat: firstVar?.prix_achat ?? null,
          variante_poids_grammes: firstVar?.variante_poids_grammes ?? null,
          variante_est_actif: !!firstVar?.variante_est_actif,

          couleur:
            firstVar?.couleur?.id ??
            firstVar?.couleur?.slug ??
            firstVar?.couleur ??
            "",
          couleur_libre: "",
        }));

        setImages(
          Array.isArray(prod?.images) && prod.images.length
            ? prod.images.map((im: any, i: number) => ({
                url: im.url,
                alt_text: im.alt_text ?? "",
                position: im.position ?? i + 1,
                principale: !!im.principale || i === 0,
                _localFile: null,
                _uploading: false,
                _error: null,
              }))
            : [
                {
                  url: "",
                  alt_text: "",
                  position: 1,
                  principale: true,
                  _localFile: null,
                  _uploading: false,
                  _error: null,
                },
              ]
        );

        const toMap = (arr: any[]) => {
          const m: Record<string, any> = {};
          (arr || []).forEach((a: any) => {
            const code = a?.code;
            const value = a?.value;
            if (code && value !== undefined && value !== null && value !== "") {
              m[code] = value;
            }
          });
          return m;
        };

        setProdAttrs(toMap(prod?.product_attributes ?? []));
        setVarAttrs(toMap(prod?.variant_attributes ?? []));
      } catch (e: any) {
        setToast({ kind: "error", msg: e?.message || "Erreur de chargement." });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Sous-catégories
  useEffect(() => {
    if (!Array.isArray(categories)) return;
    if (!formData.categorie) {
      setSubCategories([]);
      return;
    }

    const selectedId = String(formData.categorie);

    const children = (categories as any[]).filter((c) => {
      const rawParent = (c as any).parent ?? (c as any).parent_id ?? null;
      const parentId =
        rawParent && typeof rawParent === "object"
          ? (rawParent as any).id ?? (rawParent as any).slug ?? null
          : rawParent;

      return parentId != null && String(parentId) === selectedId;
    });

    setSubCategories(toOptions(children));
  }, [categories, formData.categorie]);

  // Slug catégorie pour filtres
  const selectedCategorySlug = useMemo(() => {
    if (!Array.isArray(categories)) return "";
    const target = formData.sous_categorie || formData.categorie;
    if (!target) return "";

    const byId = (categories as any[]).find(
      (c) => String(c.id) === String(target)
    );
    if (byId) return byId.slug ?? "";

    const bySlug = (categories as any[]).find(
      (c) => String(c.slug) === String(target)
    );
    return bySlug?.slug ?? "";
  }, [formData.sous_categorie, formData.categorie, categories]);

  const { data: filters } = useFilters({
    category: selectedCategorySlug || undefined,
    subcategory: undefined,
  });

  const attrsProduct: AttrMeta[] =
    filters?.attributes_product ?? filters?.attributes ?? [];
  const attrsVariant: AttrMeta[] =
    filters?.attributes_variant ?? filters?.attributes ?? [];

  /* ---------- Validation & Submit ---------- */
  const validateRequired = (): string | null => {
    if (!formData.nom.trim()) {
      return "Veuillez renseigner le nom du produit.";
    }

    if (!formData.description_courte.trim()) {
      return "Veuillez renseigner la description courte du produit.";
    }

    if (formData.visible !== 0 && formData.visible !== 1) {
      return "Veuillez indiquer si le produit doit être visible sur le site (oui ou non).";
    }

    if (formData.prix == null) {
      return "Veuillez renseigner le prix de vente du produit.";
    }

    if (!formData.marque && !formData.marque_libre.trim()) {
      return "Veuillez sélectionner ou saisir une marque.";
    }

    if (!formData.categorie) {
      return "Veuillez sélectionner une catégorie pour ce produit.";
    }

    const valid = images.filter((i) => i.url && i.url.trim() !== "");
    if (valid.length === 0) {
      return "Veuillez ajouter au moins une image pour ce produit.";
    }

    if (!valid.some((i) => i.principale)) {
      return "Veuillez définir une image principale pour ce produit.";
    }

    if (images.some((i) => i._uploading)) {
      return "Une image est encore en cours d’upload, veuillez patienter.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateRequired();
    if (err) {
      setToast({ kind: "error", msg: err });
      return;
    }

    const marqueValue =
      formData.marque === "__custom__"
        ? formData.marque_libre.trim() || null
        : formData.marque || null;
    const couleurValue =
      formData.couleur === "__custom__"
        ? formData.couleur_libre.trim() || null
        : formData.couleur || null;

    // const imagesPayload = images
    //   .filter((i) => (i.url || "").trim() !== "")
    //   .map((i) => ({
    //     url: i.url.trim(),
    //     alt_text: (i.alt_text || "").trim(),
    //     position:
    //       i.position == null || Number.isNaN(Number(i.position))
    //         ? null
    //         : Number(i.position),
    //     principale: !!i.principale,
    //   }));
const validImages = images.filter((i) => (i.url || "").trim() !== "");
const imagesPayload = validImages.map((i, index) => ({
  url: i.url.trim(),
  alt_text: (i.alt_text || "").trim(),
  position: index + 1,
  principale: index === 0, // ✅ toujours la première en principale (mode 1 image)
}));



    const toAttrArray = (map: Record<string, any>) =>
      Object.entries(map)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([code, value]) => {
          const meta = [...attrsProduct, ...attrsVariant].find(
            (a) => a.code === code
          );
          const type = (meta?.type ?? "text") as
            | "text"
            | "int"
            | "dec"
            | "bool"
            | "choice";
          const strVal =
            typeof value === "boolean" ? String(value) : String(value);
          return { code, type, value: strVal };
        });

    const product_attributes = toAttrArray(prodAttrs);
    const variant_attributes = toAttrArray(varAttrs);

    let variantsBase: any[];

    if (variants.length <= 1) {
      variantsBase = [
        {
          ...(variants[0] ?? {}),
          variante_nom: formData.variante_nom || formData.nom,
          sku: formData.sku,
          code_barres: formData.code_barres,
          prix: formData.prix,
          prix_promo: formData.prix_promo,
          promo_active: !!formData.promo_active,
          promo_debut: formData.promo_debut || null,
          promo_fin: formData.promo_fin || null,
          stock: formData.stock ?? 0,
          prix_achat: formData.prix_achat,
          variante_poids_grammes: formData.variante_poids_grammes,
          couleur: couleurValue,
          
          variante_est_actif: !!formData.variante_est_actif,
        },
      ];
    } else {
      variantsBase = variants;
    }

const mergeCapaciteAttr = (existing: any[] | undefined, capacite: any) => {
  const base = Array.isArray(existing) ? existing.filter(a => a?.code !== "capacite_stockage") : [];
  if (capacite === "" || capacite == null) return base;

  return [
    ...base,
    { code: "capacite_stockage", type: "int", value: String(capacite) },
  ];
};

    const payload: any = {
      nom: formData.nom.trim(),
      slug: formData.slug.trim() || undefined,
      description_courte: formData.description_courte,
      description_long: formData.description_long,
      garantie_mois: formData.garantie_mois,
      poids_grammes: formData.poids_grammes,
      dimensions: formData.dimensions,
      etat: formData.etat,
      categorie: formData.categorie || null,
      sous_categorie: formData.sous_categorie || null,
      marque: marqueValue,
      est_actif: !!formData.est_actif,
      visible: formData.visible ?? 1,

      variante_nom: formData.variante_nom || formData.nom,
      sku: formData.sku,
      code_barres: formData.code_barres,
      prix: formData.prix,
      prix_promo: formData.prix_promo,
      promo_active: !!formData.promo_active,
      promo_debut: formData.promo_debut || null,
      promo_fin: formData.promo_fin || null,
      stock: formData.stock ?? 0,
      couleur: couleurValue,
      prix_achat: formData.prix_achat,
      variante_poids_grammes: formData.variante_poids_grammes,
      variante_est_actif: !!formData.variante_est_actif,

      product_attributes,
      variant_attributes,
      variants: variantsBase.map((v) => ({
        ...v,
        couleur: v.couleur_libre || v.couleur || null,
        promo_debut: v.promo_debut || null,
        promo_fin: v.promo_fin || null,
        prix: v.prix ?? null,
        prix_promo: v.prix_promo ?? null,
        stock: v.stock ?? 0,
       attributes: mergeCapaciteAttr(v.attributes, v.capacite_stockage),
      })),
      images: imagesPayload,
    };

    try {
      setSubmitting(true);
      await updateDashboardProductDeep(Number(id), payload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-products"] }),
        queryClient.invalidateQueries({ queryKey: ["products-list"] }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            typeof query.queryKey[0] === "string" &&
            query.queryKey[0].toString().toLowerCase().includes("promo"),
        }),
      ]);

      navigate("/dashboard", {
        replace: true,
        state: { flash: "Produit mis à jour ✅" },
      });
    } catch (err: any) {
      setToast({
        kind: "error",
        msg: err?.message || "Échec de la mise à jour.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow" role="status">
        Chargement…
      </div>
    );
  }

  /* ---------- Rendu d’un input pour un attribut ---------- */
  const renderAttrInput = (
    scope: "product" | "variant",
    attr: AttrMeta,
    value: any,
    onChange: (v: any) => void
  ) => {
    const inputId = `${scope}_attr_${attr.code}`;

    if (attr.type === "choice") {
      const opts = (attr.options ?? []).map((o: any) =>
        typeof o === "string"
          ? { id: o, label: o }
          : { id: o.valeur, label: o.valeur }
      );
      const current =
        value == null || value === ""
          ? null
          : opts.find((o) => o.label === String(value)) ?? {
              id: value,
              label: String(value),
            };

      return (
        <>
          <label htmlFor={inputId} className="sr-only">
            {attr.libelle}
          </label>
          <ComboCreate
            options={opts}
            value={current}
            onChange={(opt) => onChange(opt ? opt.label : "")}
            placeholder={`-- ${attr.libelle} --`}
            allowCreate
            className="w-full"
            menuClassName="z-50"
            // @ts-expect-error inputId peut être géré en interne par ComboCreate
            inputId={inputId}
          />
        </>
      );
    }

    if (attr.type === "bool") {
      return (
        <label htmlFor={inputId} className="inline-flex items-center gap-2">
          <input
            id={inputId}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-5 h-5 outline-[#00A9DC]"
          />
          <span>Oui</span>
        </label>
      );
    }

    const isNumber = attr.type === "int" || attr.type === "dec";
    return (
      <>
        <label htmlFor={inputId} className="sr-only">
          {attr.libelle}
        </label>
        <input
          id={inputId}
          type={isNumber ? "number" : "text"}
          step={attr.type === "dec" ? "0.01" : undefined}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              isNumber
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value
            )
          }
          placeholder={attr.libelle}
          className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
        />
      </>
    );
  };

  /* ---------- UI ---------- */
  return (
    <div className="bg-gray-50 rounded-xl shadow-lg w-full lg:w-5/5 h-full flex flex-col">
      {toast && (
        <Toast
          kind={toast.kind}
          msg={toast.msg}
          onClose={() => setToast(null)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="p-6 space-y-6 flex-1 overflow-y-auto overscroll-contain"
        aria-label="Formulaire d’édition de produit"
      >
        {/* ===== Produit ===== */}
        <div className="grid grid-cols-2 gap-4">
          {/* Nom produit */}
          <div className="flex flex-col gap-1">
            <label htmlFor="nom" className="text-sm text-gray-700 font-medium">
              Nom du produit *
            </label>
            <input
              id="nom"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              placeholder="Nom du produit *"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Description courte */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="description_courte"
              className="text-sm text-gray-700 font-medium"
            >
              Description courte
            </label>
            <input
              id="description_courte"
              name="description_courte"
              value={formData.description_courte}
              onChange={handleChange}
              placeholder="Description courte"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Garantie (mois) */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="garantie_mois"
              className="text-sm text-gray-700 font-medium"
            >
              Garantie (mois)
            </label>
            <input
              id="garantie_mois"
              type="number"
              name="garantie_mois"
              value={formData.garantie_mois ?? ""}
              onChange={handleChange}
              placeholder="Garantie (mois)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Poids */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="poids_grammes"
              className="text-sm text-gray-700 font-medium"
            >
              Poids (g)
            </label>
            <input
              id="poids_grammes"
              type="number"
              step="0.01"
              name="poids_grammes"
              value={formData.poids_grammes ?? ""}
              onChange={handleChange}
              placeholder="Poids (g)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Dimensions */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dimensions"
              className="text-sm text-gray-700 font-medium"
            >
              Dimensions
            </label>
            <input
              id="dimensions"
              name="dimensions"
              value={formData.dimensions}
              onChange={handleChange}
              placeholder="Dimensions"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* État */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="etat-select"
              className="text-sm text-gray-700 font-medium"
            >
              État *
            </label>
            <ComboCreate
              options={etatOptions}
              value={etatValue}
              onChange={onEtatChange}
              placeholder="-- État * --"
              allowCreate={false}
              className="w-full"
              menuClassName="z-50"
              // @ts-expect-error id interne
              inputId="etat-select"
            />
          </div>

          {/* Catégorie */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="categorie-select"
              className="text-sm text-gray-700 font-medium"
            >
              Catégorie *
            </label>
            <ComboCreate
              options={rootCategoryOptions}
              value={
                rootCategoryOptions.find(
                  (o) => String(o.id) === String(formData.categorie)
                ) ?? null
              }
              onChange={onCategoryChange}
              placeholder="-- Choisir une catégorie * --"
              allowCreate={false}
              className="w-full"
              menuClassName="z-50"
              // @ts-expect-error id interne
              inputId="categorie-select"
            />
          </div>

          {/* Sous-catégorie */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sous_categorie-select"
              className="text-sm text-gray-700 font-medium"
            >
              Sous-catégorie
            </label>
            <ComboCreate
              options={subCategories}
              value={
                subCategories.find(
                  (o) => String(o.id) === String(formData.sous_categorie)
                ) ??
                subCategories.find(
                  (o) =>
                    o.label &&
                    o.label.toLowerCase() ===
                      String(formData.sous_categorie).toLowerCase()
                ) ??
                null
              }
              onChange={(opt) =>
                setFormData((p) => ({
                  ...p,
                  sous_categorie: opt ? String(opt.id) : "",
                }))
              }
              placeholder="-- Choisir une sous-catégorie --"
              allowCreate={false}
              className="w-full"
              menuClassName="z-50"
              // @ts-expect-error id interne
              inputId="sous_categorie-select"
            />
          </div>

          {/* Marque */}
          <div className="flex flex-col gap-1 col-span-2">
            <label
              htmlFor="marque-select"
              className="text-sm text-gray-700 font-medium"
            >
              Marque *
            </label>
            <ComboCreate
              options={brandOptions}
              value={brandValue}
              onChange={onBrandChange}
              placeholder="-- Choisir une marque * --"
              allowCreate
              className="w-full"
              menuClassName="z-50"
              // @ts-expect-error id interne
              inputId="marque-select"
            />
          </div>

          {/* Statut produit (fieldset) */}
          <fieldset
            className="col-span-2 flex flex-wrap items-center gap-4"
            aria-describedby="product-status-help"
          >
            <legend className="text-sm font-medium text-gray-700">
              Statut du produit
            </legend>

            <label className="inline-flex items-center gap-2">
              <input
                id="est_actif"
                type="checkbox"
                name="est_actif"
                checked={formData.est_actif}
                onChange={handleChange}
                className="w-5 h-5 outline-[#00A9DC]"
              />
              <span className="text-gray-700">Produit actif</span>
            </label>

            <div className="flex items-center gap-2">
              <label
                htmlFor="visible"
                className="text-sm text-gray-700 font-medium"
              >
                Visible sur le site
              </label>
              <select
                id="visible"
                name="visible"
                value={formData.visible ?? ""}
                onChange={handleChange}
                className="border rounded-lg p-2 bg-gray-100 w-40 outline-[#00A9DC]"
              >
                <option value="">Visible…</option>
                <option value={1}>1 (oui)</option>
                <option value={0}>0 (non)</option>
              </select>
            </div>

            <p id="product-status-help" className="sr-only">
              Utilisez ces options pour rendre le produit actif ou non, et
              décider s&apos;il est visible sur le site.
            </p>
          </fieldset>
        </div>

        {/* Description longue */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="description_long"
            className="text-sm text-gray-700 font-medium"
          >
            Description longue
          </label>
          <textarea
            id="description_long"
            name="description_long"
            value={formData.description_long}
            onChange={handleChange}
            placeholder="Description longue"
            className="border rounded-lg p-3 bg-gray-100 w-full h-28 resize-none outline-[#00A9DC]"
          />
        </div>

        {/* ===== Images ===== */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Images *</h3>
          <div className="space-y-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start"
              >
                {/* Fichier */}
                <div className="col-span-1 md:col-span-5">
                  <label
                    htmlFor={`image_file_${idx}`}
                    className="sr-only"
                  >
                    Fichier image {idx + 1}
                  </label>
                  <input
                    id={`image_file_${idx}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      onSelectFile(idx, e.target.files?.[0] ?? null)
                    }
                    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                  />
                </div>

                {/* Alt text */}
                {/* <div className="col-span-1 md:col-span-3">
                  <label
                    htmlFor={`image_alt_${idx}`}
                    className="sr-only"
                  >
                    Texte alternatif image {idx + 1}
                  </label>
                  <input
                    id={`image_alt_${idx}`}
                    type="text"
                    placeholder="Alt text"
                    value={img.alt_text || ""}
                    onChange={(e) =>
                      updateImage(idx, { alt_text: e.target.value })
                    }
                    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                  />
                </div> */}

                {/* Position */}
                {/* <div className="col-span-1 md:col-span-2">
                  <label
                    htmlFor={`image_position_${idx}`}
                    className="sr-only"
                  >
                    Position image {idx + 1}
                  </label>
                  <input
                    id={`image_position_${idx}`}
                    type="number"
                    placeholder="Position"
                    value={img.position ?? ""}
                    onChange={(e) =>
                      updateImage(idx, {
                        position:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                  />
                </div> */}

                {/* Radio principale */}
                {/* <div className="col-span-1 md:col-span-1 flex items-center">
                  <fieldset>
                    <legend className="sr-only">
                      Image principale
                    </legend>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="principale"
                        checked={!!img.principale}
                        onChange={() => setPrincipale(idx)}
                        className="w-5 h-5 outline-[#00A9DC]"
                        aria-checked={!!img.principale}
                      />
                      <span className="text-gray-700 text-sm">
                        Principale
                      </span>
                    </label>
                  </fieldset>
                </div> */}

                {/* Bouton supprimer */}
                {/* <div className="col-span-1 md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    disabled={images.length <= 1}
                    title={
                      images.length <= 1
                        ? "Au moins 1 image requise"
                        : "Supprimer"
                    }
                    aria-disabled={images.length <= 1}
                  >
                    -
                  </button>
                </div> */}

                {/* Aperçu + messages */}
                <div className="col-span-1 md:col-span-12 text-sm">
                  {img._uploading && (
                    <span className="text-gray-600">
                      Téléversement en cours…
                    </span>
                  )}
                  {!img._uploading && img.url && (
                    <div className="flex items-center gap-3 mt-1 overflow-x-auto">
                      <img
                        width={300}
                        height={300}
                        src={img.url}
                        alt={img.alt_text || ""}
                        loading="lazy"
                        className="h-16 w-16 object-cover rounded-md border flex-shrink-0"
                      />
                      <span className="text-gray-700 break-all">
                        {img.url}
                      </span>
                    </div>
                  )}
                  {img._error && (
                    <span className="text-rose-600">{img._error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* <div className="mt-3">
            <button
              type="button"
              onClick={addImage}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              + Ajouter une image
            </button>
          </div> */}
        </div>

        {/* ===== Variante (principale) ===== */}
        <h3 className="text-lg font-semibold mt-2">Variante</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Nom variante */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="variante_nom"
              className="text-sm text-gray-700 font-medium"
            >
              Nom de la variante
            </label>
            <input
              id="variante_nom"
              name="variante_nom"
              value={formData.variante_nom}
              onChange={handleChange}
              placeholder="Nom de la variante (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Couleur */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="couleur-select"
              className="text-sm text-gray-700 font-medium"
            >
              Couleur
            </label>
            <ComboCreate
              options={colorOptions}
              value={colorValue}
              onChange={onColorChange}
              placeholder="-- Couleur (optionnel) --"
              allowCreate
              className="w-full"
              menuClassName="z-50"
              // @ts-expect-error id interne
              inputId="couleur-select"
            />
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sku"
              className="text-sm text-gray-700 font-medium"
            >
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              placeholder="SKU (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Code-barres */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="code_barres"
              className="text-sm text-gray-700 font-medium"
            >
              Code-barres
            </label>
            <input
              id="code_barres"
              name="code_barres"
              value={formData.code_barres}
              onChange={handleChange}
              placeholder="Code-barres (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Prix normal */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="prix"
              className="text-sm text-gray-700 font-medium"
            >
              Prix normal *
            </label>
            <input
              id="prix"
              type="number"
              step="0.01"
              name="prix"
              value={formData.prix ?? ""}
              onChange={handleChange}
              placeholder="Prix normal *"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Prix promo */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="prix_promo"
              className="text-sm text-gray-700 font-medium"
            >
              Prix promo
            </label>
            <input
              id="prix_promo"
              type="number"
              step="0.01"
              name="prix_promo"
              value={formData.prix_promo ?? ""}
              onChange={handleChange}
              placeholder="Prix promo (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Dates promo */}
          <div className="flex flex-col gap-1">
            <DateTimePicker
              label="Début promo"
              name="promo_debut"
              value={formData.promo_debut}
              onChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <DateTimePicker
              label="Fin promo"
              name="promo_fin"
              value={formData.promo_fin}
              onChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))}
              className="w-full"
            />
          </div>

          {/* Stock */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="stock"
              className="text-sm text-gray-700 font-medium"
            >
              Stock
            </label>
            <input
              id="stock"
              type="number"
              name="stock"
              value={formData.stock ?? ""}
              onChange={handleChange}
              placeholder="Stock (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Prix d'achat */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="prix_achat"
              className="text-sm text-gray-700 font-medium"
            >
              Prix d’achat
            </label>
            <input
              id="prix_achat"
              type="number"
              step="0.01"
              name="prix_achat"
              value={formData.prix_achat ?? ""}
              onChange={handleChange}
              placeholder="Prix d’achat (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>

          {/* Poids variante */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="variante_poids_grammes"
              className="text-sm text-gray-700 font-medium"
            >
              Poids variante (g)
            </label>
            <input
              id="variante_poids_grammes"
              type="number"
              step="0.01"
              name="variante_poids_grammes"
              value={formData.variante_poids_grammes ?? ""}
              onChange={handleChange}
              placeholder="Poids variante (g) (optionnel)"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">
              Capacité stockage (Go)
            </label>
            <input
              type="number"
              value={formData.capacite_stockage ?? ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  capacite_stockage: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
              placeholder="ex: 128"
            />
          </div>
          {/* Statut variante (fieldset) */}
          <fieldset className="col-span-2 flex flex-wrap items-center gap-4">
            <legend className="text-sm font-medium text-gray-700">
              Statut de la variante principale
            </legend>

            <label
              htmlFor="promo_active"
              className="inline-flex items-center gap-2"
            >
              <input
                id="promo_active"
                type="checkbox"
                name="promo_active"
                checked={formData.promo_active}
                onChange={handleChange}
                className="w-5 h-5 outline-[#00A9DC]"
              />
              <span className="text-gray-700">Promotion active</span>
            </label>

            <label
              htmlFor="variante_est_actif"
              className="inline-flex items-center gap-2"
            >
              <input
                id="variante_est_actif"
                type="checkbox"
                name="variante_est_actif"
                checked={formData.variante_est_actif}
                onChange={handleChange}
                className="w-5 h-5 outline-[#00A9DC]"
              />
              <span className="text-gray-700">Variante active</span>
            </label>
          </fieldset>
        </div>

        {/* === Gestion des Variantes (liste) === */}
        <div className="mt-4">
          {variants.length > 0 && (
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold">Variantes</h4>
            </div>
          )}

          {variants.length > 0 && (
            <div className="mt-3 space-y-4">
              {variants.map((v, index) => (
                <div
                  key={index}
                  className="border rounded-xl bg-white/70 p-4 shadow-sm space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">
                      Variante {index + 1}
                    </span>
                    {variants.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-200 hover:bg-gray-300"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Nom variante */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_nom`}
                        className="text-sm text-gray-700"
                      >
                        Nom variante
                      </label>
                      <input
                        id={`variant_${index}_nom`}
                        type="text"
                        value={v.variante_nom}
                        onChange={(e) =>
                          updateVariant(index, "variante_nom", e.target.value)
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Nom variante"
                      />
                    </div>

                    {/* Couleur */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_couleur`}
                        className="text-sm text-gray-700"
                      >
                        Couleur
                      </label>
                      <ComboCreate
                        options={colorOptions}
                        value={
                          v.couleur === "__custom__"
                            ? v.couleur_libre
                              ? { id: "__custom__", label: v.couleur_libre }
                              : null
                            : colorOptions.find(
                                (o) => String(o.id) === String(v.couleur)
                              ) ?? null
                        }
                        onChange={(opt) => {
                          if (!opt) {
                            updateVariant(index, "couleur", "");
                            updateVariant(index, "couleur_libre", "");
                            return;
                          }
                          if (
                            colorOptions.some(
                              (o) => String(o.id) === String(opt.id)
                            )
                          ) {
                            updateVariant(
                              index,
                              "couleur",
                              String(opt.id ?? "")
                            );
                            updateVariant(index, "couleur_libre", "");
                          } else {
                            updateVariant(index, "couleur", "__custom__");
                            updateVariant(index, "couleur_libre", opt.label);
                          }
                        }}
                        allowCreate
                        placeholder="-- Couleur --"
                        className="w-full"
                        menuClassName="z-50"
                        // @ts-expect-error id interne
                        inputId={`variant_${index}_couleur`}
                      />
                    </div>
<div className="flex flex-col gap-1">
  <label className="text-sm text-gray-700">Capacité stockage (Go)</label>
  <input
    type="number"
    value={v.capacite_stockage ?? ""}
    onChange={(e) =>
      updateVariant(index, "capacite_stockage", e.target.value === "" ? null : Number(e.target.value))
    }
    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
    placeholder="ex: 128"
  />
</div>
                    {/* SKU */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_sku`}
                        className="text-sm text-gray-700"
                      >
                        SKU
                      </label>
                      <input
                        id={`variant_${index}_sku`}
                        type="text"
                        value={v.sku}
                        onChange={(e) =>
                          updateVariant(index, "sku", e.target.value)
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="SKU"
                      />
                    </div>

                    {/* Code-barres */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_code_barres`}
                        className="text-sm text-gray-700"
                      >
                        Code-barres
                      </label>
                      <input
                        id={`variant_${index}_code_barres`}
                        type="text"
                        value={v.code_barres}
                        onChange={(e) =>
                          updateVariant(index, "code_barres", e.target.value)
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Code-barres"
                      />
                    </div>

                    {/* Prix */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_prix`}
                        className="text-sm text-gray-700"
                      >
                        Prix *
                      </label>
                      <input
                        id={`variant_${index}_prix`}
                        type="number"
                        step="0.01"
                        value={v.prix ?? ""}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "prix",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Prix normal *"
                      />
                    </div>

                    {/* Prix promo */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_prix_promo`}
                        className="text-sm text-gray-700"
                      >
                        Prix promo
                      </label>
                      <input
                        id={`variant_${index}_prix_promo`}
                        type="number"
                        step="0.01"
                        value={v.prix_promo ?? ""}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "prix_promo",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Prix promo"
                      />
                    </div>

                    {/* Dates promo */}
                    <DateTimePicker
                      label="Début promo"
                      name="promo_debut"
                      value={v.promo_debut}
                      onChange={(_, val) =>
                        updateVariant(index, "promo_debut", val)
                      }
                    />
                    <DateTimePicker
                      label="Fin promo"
                      name="promo_fin"
                      value={v.promo_fin}
                      onChange={(_, val) =>
                        updateVariant(index, "promo_fin", val)
                      }
                    />

                    {/* Stock */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_stock`}
                        className="text-sm text-gray-700"
                      >
                        Stock
                      </label>
                      <input
                        id={`variant_${index}_stock`}
                        type="number"
                        value={v.stock ?? ""}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "stock",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Stock"
                      />
                    </div>

                    {/* Poids */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`variant_${index}_variante_poids_grammes`}
                        className="text-sm text-gray-700"
                      >
                        Poids (g)
                      </label>
                      <input
                        id={`variant_${index}_variante_poids_grammes`}
                        type="number"
                        value={v.variante_poids_grammes ?? ""}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "variante_poids_grammes",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
                        placeholder="Poids variante (g)"
                      />
                    </div>
                  </div>

                  {/* Statut variante (fieldset) */}
                  <fieldset className="flex items-center gap-6">
                    <legend className="sr-only">
                      Statut de la variante {index + 1}
                    </legend>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={v.promo_active}
                        onChange={(e) =>
                          updateVariant(index, "promo_active", e.target.checked)
                        }
                        className="w-5 h-5 outline-[#00A9DC]"
                      />
                      Promo active
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={v.variante_est_actif}
                        onChange={(e) =>
                          updateVariant(
                            index,
                            "variante_est_actif",
                            e.target.checked
                          )
                        }
                        className="w-5 h-5 outline-[#00A9DC]"
                      />
                      Variante active
                    </label>
                  </fieldset>
                </div>
              ))}
            </div>
          )}

          {/* Bouton ajout variante */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  {
                    variante_nom: "",
                    sku: "",
                    code_barres: "",
                    prix: null,
                    prix_promo: null,
                    promo_active: false,
                    promo_debut: "",
                    promo_fin: "",
                    stock: null,
                    prix_achat: null,
                    variante_poids_grammes: null,
                    couleur: "",
                    couleur_libre: "",
                    variante_est_actif: true,
                  },
                ])
              }
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              + Ajouter une variante
            </button>
          </div>
        </div>

        {/* ===== Spécifications dynamiques ===== */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold">Spécifications</h3>

          {!attrsProduct.length && !attrsVariant.length && (
            <p className="text-sm text-gray-500 mt-1">
              Aucun attribut pour cette catégorie.
            </p>
          )}

          {!!attrsProduct.length && (
            <div className="rounded-xl border p-4 bg-white/60 mt-3">
              <h4 className="font-semibold mb-3">Niveau Produit</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {attrsProduct.map((a) => (
                  <div key={`p_${a.code}`} className="flex flex-col gap-1">
                    <label className="text-sm text-gray-700">
                      {a.libelle}{" "}
                      <span className="text-gray-400">({a.code})</span>
                    </label>
                    {renderAttrInput(
                      "product",
                      a,
                      prodAttrs[a.code],
                      (v) =>
                        setProdAttrs((m) => ({
                          ...m,
                          [a.code]: v,
                        }))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!attrsVariant.length && (
            <div className="rounded-xl border p-4 bg-white/60 mt-3">
              <h4 className="font-semibold mb-3">Niveau Variante</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {attrsVariant.map((a) => (
                  <div key={`v_${a.code}`} className="flex flex-col gap-1">
                    <label className="text-sm text-gray-700">
                      {a.libelle}{" "}
                      <span className="text-gray-400">({a.code})</span>
                    </label>
                    {renderAttrInput(
                      "variant",
                      a,
                      varAttrs[a.code],
                      (v) =>
                        setVarAttrs((m) => ({
                          ...m,
                          [a.code]: v,
                        }))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#00A9DC] disabled:opacity-60 text-white px-5 py-2 rounded-lg hover:bg-[#0797c4] transition"
          >
            {submitting ? "Mise à jour..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductEditForm;
