
import React, { useMemo, useState } from "react";
import {
  createProductWithVariant,
  useFilters, 
  useDashboardCategories,
  useMarques,
  useCouleurs,
  uploadProductImage,
  type ProductPayload,
} from "../hooks/useFetchQuery";
import { useNavigate } from "react-router-dom"; // ⬅️ AJOUT
import ComboCreate, { type ComboOption } from "./ComboCreate";
import DateTimePicker, { parseLocalDateTime } from "./DateTimePicker";
import MultiComboCreate from "./MultiComboCreate";
import { useQueryClient } from "@tanstack/react-query";  // ⬅️ AJOUTER ÇA
type ProduitFormState = {
  nom: string;
  slug: string;
  capacite_stockage?: string | number; // ✅ AJOUT
  description_courte: string;
  description_long: string;
  garantie_mois: number | null;
  poids_grammes: number | null;
  sous_categorie: string;
  dimensions: string;
  etat: "neuf" | "occasion" | "reconditionné";
  categorie: string;
  marque: string;
  marque_libre: string;
  est_actif: boolean;
  visible: 0 | 1 | null;

  // Variante
  variante_nom: string;
  sku: string;
  code_barres: string;
  prix: number | null;
  prix_promo: number | null;
  promo_active: boolean;
  promo_debut: string;         // HTML datetime-local
  promo_fin: string;           // HTML datetime-local
  stock: number | null;

  prix_achat: number | null;
  variante_poids_grammes: number | null;
  variante_est_actif: boolean;

  // Couleur
  couleur: string;
  couleur_libre: string;
};

type VarianteFormRow = {
  nom: string;
  sku: string;
  prix: number | null;
  prix_promo: number | null;
  stock: number | null;
  prix_achat: number | null;
  promo_active: boolean;
  promo_debut: string;
  promo_fin: string;
  est_actif: boolean;
  poids_grammes: number | null;
 capacite_stockage?: string | number; // ✅ AJOUT
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


const Toast: React.FC<{ kind: "success" | "error"; msg: string; onClose(): void }> = ({
  kind, msg, onClose,
}) => (
  <div className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-lg px-4 py-3 text-white ${kind === "success" ? "bg-emerald-600" : "bg-rose-600"}`} role="status">
    <div className="flex items-start gap-3">
      <span className="font-semibold">{kind === "success" ? "Succès" : "Erreur"}</span>
      <span className="opacity-90">{msg}</span>
      <button type="button" onClick={onClose} className="ml-3 text-white/90 hover:text-white" aria-label="Fermer">×</button>
    </div>
  </div>
);
const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // ✅ AJOUT ICI

  const { data: categories } = useDashboardCategories();

  React.useEffect(() => {
 
}, [categories]);

  const { data: marques } = useMarques();
  const { data: couleurs } = useCouleurs();
 const [extraVariants, setExtraVariants] = useState<VarianteFormRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const [formData, setFormData] = useState<ProduitFormState>({
    nom: "",
    slug: "",
    capacite_stockage: "",
    description_courte: "",
    description_long: "",
    garantie_mois: null,
    poids_grammes: null,
    dimensions: "",
    etat: "neuf",
    categorie: "",
    marque: "",
    marque_libre: "",
    est_actif: true,
    visible: 1,
sous_categorie: "",
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

  // === IMAGES ===
  const [images, setImages] = useState<ImgRow[]>([
    { url: "", alt_text: "", position: 1, principale: true, _localFile: null, _uploading: false, _error: null },
    
  ]);
// Attributs dynamiques saisis
const [prodAttrs, setProdAttrs] = useState<Record<string, any>>({});
const [varAttrs, setVarAttrs] = useState<Record<string, any>>({});
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

  const updateImage = (idx: number, patch: Partial<ImgRow>) =>
    setImages((arr) => arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // const setPrincipale = (idx: number) =>
  //   setImages((arr) => arr.map((r, i) => ({ ...r, principale: i === idx })));

  // fichier -> upload -> url
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
  //       const hasMain = arr.some((a) => a.principale);
  //       if (!hasMain) return arr.map((a, i) => (i === idx ? { ...a, principale: true } : a));
  //       return arr;
  //     });
  //   } catch (e: any) {
  //     updateImage(idx, { _uploading: false, _error: e?.message || "Upload échoué" });
  //     setToast({ kind: "error", msg: e?.message || "Échec de l’upload de l’image." });
  //   }
  // };

const onSelectFile = async (idx: number, file: File | null) => {
  if (!file) {
    setImages([{ url: "", alt_text: "", position: 1, principale: true } as any]);
    return;
  }

  updateImage(idx, { _localFile: file, _uploading: true, _error: null });

  try {
    const { url } = await uploadProductImage(file);

    // ✅ MODE 1 IMAGE : on écrase tout
    setImages([
      {
        url,
        alt_text: images[idx]?.alt_text || "",
        position: 1,
        principale: true,
        _localFile: null,
        _uploading: false,
        _error: null,
      },
    ]);
  } catch (e: any) {
    updateImage(idx, { _uploading: false, _error: e?.message || "Upload échoué" });
    setToast({ kind: "error", msg: e?.message || "Échec de l’upload de l’image." });
  }
};

  
  // options
  const toOptions = (rows: any[] | null | undefined): ComboOption[] =>
    (rows ?? []).map((r: any) => ({ id: r.id ?? r.slug ?? r.nom, label: r.nom ?? r.slug ?? String(r) }));
   // Catégories racines (parent_id NULL)
  const parentCategories = useMemo(
    () =>
      (categories ?? []).filter((c: any) => {
        const pid =
          c.parent_id ??
          (typeof c.parent === "number"
            ? c.parent
            : c.parent && typeof c.parent === "object"
            ? c.parent.id
            : null);
        return pid == null; // => catégorie racine
      }),
    [categories]
  );

// On ne propose que les catégories racines (sans parent)
// On ne propose que les catégories racines (sans parent)
const categoryOptions = useMemo(
  () => toOptions(parentCategories),
  [parentCategories]
);



  // Sous-catégories de la catégorie sélectionnée
// Sous-catégories de la catégorie sélectionnée
const subcategoryOptions = useMemo(() => {
  if (!formData.categorie || !Array.isArray(categories)) return [];

  // Catégorie parent sélectionnée (on accepte id ou slug)
  const parent = (categories as any[]).find(
    (c) =>
      String(c.id) === String(formData.categorie) ||
      String(c.slug) === String(formData.categorie)
  );
  if (!parent) return [];

  let children: any[] = [];

  // 1) Cas où l'API renvoie un arbre : children directement sur la catégorie
  if (Array.isArray((parent as any).children) && (parent as any).children.length) {
    children = (parent as any).children;
  } else if (
    Array.isArray((parent as any).children_recursive) &&
    (parent as any).children_recursive.length
  ) {
    // variante possible selon ton serializer
    children = (parent as any).children_recursive;
  } else {
    // 2) Cas "flat" : toutes les catégories sont dans le même tableau,
    // et les sous-catégories ont parent_id (ou parent) = id du parent.
    const parentId = parent.id;
    children = (categories as any[]).filter((c) => {
      const parentField =
        c.parent_id ??
        (typeof c.parent === "object" ? c.parent?.id : c.parent ?? null);
      return String(parentField) === String(parentId);
    });
  }

  const opts = toOptions(children);
  // console.log("DEBUG sous-catégories:", {
  //   parent,
  //   children,
  //   opts,
  // });
  return opts;
}, [formData.categorie, categories]);


  const subcategoryValue =
    subcategoryOptions.find(
      (o) => String(o.id) === String(formData.sous_categorie)
    ) ?? null;
// console.log("Sous-catégories disponibles pour cette catégorie:", subcategoryOptions);

// Slug réel de la catégorie choisie (pour /filters/)
// Slug réel de la catégorie choisie (pour /filters/)
const selectedCategorySlug = useMemo(() => {
  if (!formData.categorie || !Array.isArray(categories)) return "";

  // on accepte id OU slug : essaye d’abord par id, sinon par slug
  const byId = categories.find(
    (c: any) => String(c.id) === String(formData.categorie)
  );
  if (byId) return byId.slug ?? "";

  const bySlug = categories.find(
    (c: any) => String(c.slug) === String(formData.categorie)
  );
  return bySlug?.slug ?? "";
}, [formData.categorie, categories]);

const selectedSubcategorySlug = useMemo(() => {
  if (!formData.sous_categorie || !Array.isArray(categories)) return "";

  const byId = categories.find(
    (c: any) => String(c.id) === String(formData.sous_categorie)
  );
  if (byId) return byId.slug ?? "";

  const bySlug = categories.find(
    (c: any) => String(c.slug) === String(formData.sous_categorie)
  );
  return bySlug?.slug ?? "";
}, [formData.sous_categorie, categories]);


// Charge les filtres dont les "attributes" pour la catégorie
// Charge les filtres + sépare Produit / Variante
const { data: filters } = useFilters({
  category: selectedCategorySlug || undefined,
  subcategory: selectedSubcategorySlug || undefined,
});




const attrsProduct = filters?.attributes_product
  ?? (filters?.attributes ?? []).filter(a => a); // fallback si backend pas encore à jour
const attrsVariant = filters?.attributes_variant
  ?? (filters?.attributes ?? []).filter(a => a); // fallback

// Valeurs "créées" par l'utilisateur pour les attributs choice, par code
const [customAttrChoices, setCustomAttrChoices] = useState<Record<string, string[]>>({});




  const brandOptions = toOptions(marques);
  const colorOptions = toOptions(couleurs);

  // valeurs
  const categoryValue = categoryOptions.find((o) => String(o.id) === String(formData.categorie)) ?? null;
  const brandValue =
    formData.marque === "__custom__"
      ? formData.marque_libre
        ? { id: "__custom__", label: formData.marque_libre }
        : null
      : brandOptions.find((o) => String(o.id) === String(formData.marque)) ?? null;
  const colorValue =
    formData.couleur === "__custom__"
      ? formData.couleur_libre
        ? { id: "__custom__", label: formData.couleur_libre }
        : null
      : colorOptions.find((o) => String(o.id) === String(formData.couleur)) ?? null;

  // handlers combos
const onCategoryChange = (opt: ComboOption | null) => {
  if (!opt) {
   setFormData((p) => ({ ...p, categorie: "", sous_categorie: "" }));
    setProdAttrs({});
    setVarAttrs({});
    setCustomAttrChoices({});
    return;
  }


setFormData((p) => ({
    ...p,
    categorie: String(opt.id ?? ""),
    sous_categorie: "",                                         
  }));

  // 🔁 reset des specs / variantes pour ne garder que celles de la nouvelle catégorie
  setProdAttrs({});
  setVarAttrs({});
  setCustomAttrChoices({});
};


  const onBrandChange = (opt: ComboOption | null) => {
    if (!opt) return setFormData((p) => ({ ...p, marque: "", marque_libre: "" }));
    if (brandOptions.some((o) => String(o.id) === String(opt.id))) {
      setFormData((p) => ({ ...p, marque: String(opt.id ?? ""), marque_libre: "" }));
    } else {
      setFormData((p) => ({ ...p, marque: "__custom__", marque_libre: opt.label }));
    }
  };
  const onColorChange = (opt: ComboOption | null) => {
    if (!opt) return setFormData((p) => ({ ...p, couleur: "", couleur_libre: "" }));
    if (colorOptions.some((o) => String(o.id) === String(opt.id))) {
      setFormData((p) => ({ ...p, couleur: String(opt.id ?? ""), couleur_libre: "" }));
    } else {
      setFormData((p) => ({ ...p, couleur: "__custom__", couleur_libre: opt.label }));
    }
  };

  // commun
  const numericKeys = new Set([
    "garantie_mois",
    "poids_grammes",

    "prix",
    "prix_promo",
    "stock",
    "prix_achat",
    "variante_poids_grammes",
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

      const onSubcategoryChange = (opt: ComboOption | null) => {
    setFormData((p) => ({
      ...p,
      sous_categorie: opt ? String(opt.id ?? "") : "",
    }));
  };

  // validations
const validateRequired = (): string | null => {
  if (!formData.nom.trim()) {
    return "Veuillez renseigner le nom du produit.";
  }

  // ✅ Description courte obligatoire
  if (!formData.description_courte.trim()) {
    return "Veuillez renseigner la description courte du produit.";
  }

  if (formData.visible !== 0 && formData.visible !== 1) {
    return "Veuillez indiquer si le produit doit être visible sur le site (oui ou non).";
  }

  if (formData.prix == null) {
    return "Veuillez renseigner le prix de vente du produit.";
  }

  const hasMarque = !!formData.marque || !!formData.marque_libre.trim();
  if (!hasMarque) {
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



  // 1) Construire les attributs dynamiques attendus par l’API
  const toAttrArray = (map: Record<string, any>) =>
    Object.entries(map)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([code, value]) => {
        // cherche dans les 2 listes
        const allMeta = [
          ...(attrsProduct || []),
          ...(attrsVariant || []),
        ] as AttrMeta[];
        const meta = allMeta.find((a) => a.code === code);
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
  const variant_attributes = toAttrArray(varAttrs); // on va les mettre sur la 1ère variante

  // Variante principale (celle du formulaire "Variante")
  const mainVariant = {
    nom: formData.variante_nom || formData.nom,
    sku: formData.sku || null,
    code_barres: formData.code_barres || "",
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
   attributes: [
  ...variant_attributes.map((a) => ({
    code: a.code,
    type: a.type,
    value: a.value,
  })),

  // ✅ Ajout capacité stockage pour la variante principale
  ...(formData.capacite_stockage !== "" && formData.capacite_stockage != null
    ? [
        {
          code: "capacite_stockage",
          type: "int",
          value: String(formData.capacite_stockage),
        },
      ]
    : []),
],
  };

  const extraVariantsPayload = extraVariants.map((v) => ({
    nom: v.nom || formData.nom,
    sku: v.sku || null,
    code_barres: "",
    prix: v.prix,
    prix_promo: v.prix_promo,
    promo_active: v.promo_active,
    promo_debut: v.promo_debut || null,
    promo_fin: v.promo_fin || null,
    stock: v.stock ?? 0,
  // couleur spécifique à la variante, sinon on retombe sur la couleur principale
couleur:
  v.couleur === "__custom__"
    ? (v.couleur_libre?.trim() || null)
    : v.couleur || couleurValue,

    prix_achat: v.prix_achat,
    variante_poids_grammes: v.poids_grammes,
    variante_est_actif: v.est_actif,
attributes:
  v.capacite_stockage !== "" && v.capacite_stockage != null
    ? [{ code: "capacite_stockage", type: "int", value: String(v.capacite_stockage) }]
    : [], // pour l’instant pas d’attributs spécifiques

  }));

  const variants = [mainVariant, ...extraVariantsPayload];


  // 2) Payload final
    const payload: ProductPayload = {
    nom: formData.nom.trim(),
    slug: formData.slug.trim() || undefined,
    description_courte: formData.description_courte,
    description_long: formData.description_long,
    garantie_mois: formData.garantie_mois,
    poids_grammes: formData.poids_grammes,
    dimensions: formData.dimensions,
    etat: formData.etat,
    categorie: formData.sous_categorie || formData.categorie || null,
    marque: marqueValue,
    est_actif: !!formData.est_actif,
    visible: formData.visible ?? 1,

    product_attributes,
    variants,               // 👈 toutes les variantes ici

    images: imagesPayload,
  };


  try {
    setSubmitting(true);
    // console.log("[DEBUG] PAYLOAD /produits/ajouter :", payload);

    const res = await createProductWithVariant(payload as any);

await Promise.all([
  // Liste du dashboard
  queryClient.invalidateQueries({ queryKey: ["dashboard-products"] }),

  // Liste générale de produits
  queryClient.invalidateQueries({ queryKey: ["products-list"] }),

  // 🔥 Toutes les queries qui parlent de "promo" dans leur queryKey[0]
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      typeof query.queryKey[0] === "string" &&
      query.queryKey[0].toString().toLowerCase().includes("promo"),
  }),
]);


    let successMsg = "Votre produit a bien été enregistré.";
    if (res?.produit_id && res?.variante_id) {
      successMsg += ` (Produit #${res.produit_id}, Variante #${res.variante_id})`;
    }
    if (res?.notes?.marque_message) {
      successMsg += ` — ${res.notes.marque_message}`;
    }

    setToast({ kind: "success", msg: successMsg });

    // 🔁 avertir Nouveautés, etc.
    window.dispatchEvent(new CustomEvent("product:created"));

    // 🔀 redirection Dashboard
   navigate("/dashboard", {
  state: { flash: successMsg },
  replace: true,
});

    // (facultatif, vu qu’on quitte la page)
    setFormData({
      nom: "",
      slug: "",
      description_courte: "",
      description_long: "",
      garantie_mois: null,
      poids_grammes: null,
      dimensions: "",
      etat: "neuf",
      categorie: "",
      marque: "",
      marque_libre: "",
      est_actif: true,
      visible: 1,
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
      sous_categorie: "",
      variante_poids_grammes: null,
      variante_est_actif: true,
      couleur: "",
      couleur_libre: "",
    });
    setImages([
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
  } catch (err: any) {
    setToast({
      kind: "error",
      msg: err?.message || "Échec d’enregistrement.",
    });
  } finally {
    setSubmitting(false);
  }
};


 const addVariantRow = () => {
  setExtraVariants((rows) => [
    ...rows,
    {
      nom: "",
      sku: "",
      prix: null,
      prix_promo: null,
      stock: null,
      prix_achat: null,
      promo_active: false,
      promo_debut: "",
      promo_fin: "",
      est_actif: true,
      poids_grammes: null,
      couleur: "",
      capacite_stockage: "",
      couleur_libre: "",
    },
  ]);
};


  const updateVariantRow = (
    index: number,
    field: keyof VarianteFormRow,
    value: any
  ) => {
    setExtraVariants((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const removeVariantRow = (index: number) => {
    setExtraVariants((rows) => rows.filter((_, i) => i !== index));
  };


// --- ÉTAT (même design que ComboCreate)
const etatOptions: ComboOption[] = [
  { id: "neuf",           label: "Neuf" },
  { id: "reconditionné",  label: "Reconditionné" },
  { id: "occasion",       label: "Occasion" },
];

const etatValue =
  etatOptions.find(o => String(o.id) === String(formData.etat)) ?? null;

const onEtatChange = (opt: ComboOption | null) => {
  setFormData(p => ({ ...p, etat: (opt?.id as ProduitFormState["etat"]) ?? "neuf" }));
};
type AttrMeta = {
  code: string;
  libelle: string;
  type?: "text" | "int" | "dec" | "bool" | "choice";
  options?: { valeur: string; slug?: string }[] | string[];
};
const MULTI_CHOICE_CODES = new Set(["interface"]);        // ajoute d'autres codes si besoin
const MULTI_SEPARATOR = ", ";                              // ex: "USB-C, HDMI"
const FORCE_DECIMAL = new Set(["frequence"]);  // codes à forcer en décimal


const renderAttrInput = (
  scope: "product" | "variant",
  attr: AttrMeta,
  val: any,
  onChange: (v: any) => void
) => {
  const id = `${scope}_attr_${attr.code}`;

  // ===== CHOIX (select-like) =====
  if (attr.type === "choice") {
    // options de l'API -> ComboOption[]
    const baseOptions: ComboOption[] = (attr.options ?? []).map((o: any) =>
      typeof o === "string" ? { id: o, label: o } : { id: o.valeur, label: o.valeur }
    );

    // options créées par l'utilisateur (persistées au niveau du composant)
    const extras = customAttrChoices[attr.code] ?? [];
    const extraOptions: ComboOption[] = extras.map((v) => ({ id: v, label: v }));

    // fusion + dédoublonnage par label (priorité à l'API)
    const seen = new Set<string>();
    const comboOptions = [...baseOptions, ...extraOptions].filter((o) => {
      const k = o.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // ----- cas MULTI (ex: interface)
    if (MULTI_CHOICE_CODES.has(attr.code)) {
      // string -> array de tags
      const currentArr: ComboOption[] =
        (val ? String(val).split(MULTI_SEPARATOR).map(s => s.trim()).filter(Boolean) : [])
          .map(x => comboOptions.find(o => o.label === x) ?? { id: `__new__:${x}`, label: x });

      return (
        <MultiComboCreate
          options={comboOptions}
          value={currentArr}
          placeholder={`-- ${attr.libelle} --`}
          allowCreate
          dropdownPlacement="bottom-start"
          className="w-full"
          menuClassName="z-50"
          onChange={(arr) => {
            // array -> string joinée pour l'API
            const next = arr.map(a => a.label).join(MULTI_SEPARATOR);
            onChange(next);

            // mémorise les nouvelles valeurs créées (celles qui ne sont pas dans baseOptions)
            const baseSet = new Set(baseOptions.map(b => b.label.toLowerCase()));
            const toSave = arr
              .map(a => a.label)
              .filter(lbl => !baseSet.has(lbl.toLowerCase()));
            if (toSave.length) {
              setCustomAttrChoices(prev => {
                const prevList = prev[attr.code] ?? [];
                const prevSet = new Set(prevList.map(x => x.toLowerCase()));
                const merged = [...prevList, ...toSave.filter(x => !prevSet.has(x.toLowerCase()))];
                return { ...prev, [attr.code]: merged };
              });
            }
          }}
        />
      );
    }

    // ----- cas SIMPLE (un seul choix)
    const comboValue: ComboOption | null =
      val == null || val === ""
        ? null
        : comboOptions.find(
            (opt) =>
              String(opt.id) === String(val) || String(opt.label) === String(val)
          )?? { id: `__new__:${String(val)}`, label: String(val) }

    return (
      <ComboCreate
        options={comboOptions}
        value={comboValue}
        placeholder={`-- ${attr.libelle} --`}
        allowCreate
        dropdownPlacement="bottom-start"
        className="w-full"
        menuClassName="z-50"
        onChange={(opt) => {
          onChange(opt ? opt.label : "");
          // mémorise si nouvelle valeur
          if (
            opt &&
            !baseOptions.some((b) => b.label.toLowerCase() === opt.label.toLowerCase())
          ) {
            setCustomAttrChoices((prev) => {
              const prevList = prev[attr.code] ?? [];
              if (prevList.some((x) => x.toLowerCase() === opt.label.toLowerCase()))
                return prev;
              return { ...prev, [attr.code]: [...prevList, opt.label] };
            });
          }
        }}
      />
    );
  }

  // ===== BOOLÉEN =====
  if (attr.type === "bool") {
    return (
      <label className="inline-flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="w-5 h-5 outline-[#00A9DC]"
          checked={!!val}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-gray-700">Oui</span>
      </label>
    );
  }

  // ===== TEXT / NUMÉRIQUE =====
  const isInt = attr.type === "int" && !FORCE_DECIMAL.has(attr.code);
  const isDec = attr.type === "dec" || FORCE_DECIMAL.has(attr.code);

  const inputType = (isInt || isDec) ? "number" : "text";
  const step = isDec ? "0.01" : isInt ? "1" : undefined;


  return (
    <input
      id={id}
      type={inputType}
      step={step}
      placeholder={attr.libelle}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      value={val ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (isInt) onChange(raw === "" ? "" : parseInt(raw, 10));
        else if (isDec) onChange(raw === "" ? "" : Number(raw));
        else onChange(raw);
      }}
    />
  );
};

  const hasCategory = !!formData.categorie;


  return (
     <div
    className="
      bg-gray-50 rounded-xl shadow-lg w-full lg:w-5/5 h-[calc(100vh-220px)] overflow-y-auto pr-2 mb-6">
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={() => setToast(null)} />}

      <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-6">
        {/* ===== Produit ===== */}
        {/* ===== Produit ===== */}
<div className="grid grid-cols-2 gap-4">
  {/* Nom du produit */}
  <div className="flex flex-col gap-1">
    <label htmlFor="nom" className="text-sm text-gray-700 font-medium">
      Nom du produit *
    </label>
    <input
      id="nom"
      type="text"
      name="nom"
      value={formData.nom}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      required
    />
  </div>

  {/* Slug
  <div className="flex flex-col gap-1">
    <label htmlFor="slug" className="text-sm text-gray-700 font-medium">
      Slug (auto si vide)
    </label>
    <input
      id="slug"
      type="text"
      name="slug"
      value={formData.slug}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Slug (auto si vide)"
    />
  </div> */}

  {/* Description courte */}
  <div className="flex flex-col gap-1">
    <label htmlFor="description_courte" className="text-sm text-gray-700 font-medium">
      Description courte
    </label>
    <input
      id="description_courte"
      type="text"
      name="description_courte"
      value={formData.description_courte}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Description courte"
      required 
    />
  </div>

  {/* Garantie mois */}
  <div className="flex flex-col gap-1">
    <label htmlFor="garantie_mois" className="text-sm text-gray-700 font-medium">
      Garantie (mois)
    </label>
    <input
      id="garantie_mois"
      type="number"
      name="garantie_mois"
      value={formData.garantie_mois ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Garantie (mois)"
    />
  </div>

  {/* Poids */}
  <div className="flex flex-col gap-1">
    <label htmlFor="poids_grammes" className="text-sm text-gray-700 font-medium">
      Poids (g)
    </label>
    <input
      id="poids_grammes"
      type="number"
      step="0.01"
      name="poids_grammes"
      value={formData.poids_grammes ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Poids (g)"
    />
  </div>

  {/* Dimensions */}
  <div className="flex flex-col gap-1">
    <label htmlFor="dimensions" className="text-sm text-gray-700 font-medium">
      Dimensions (ex: 10x20x5)
    </label>
    <input
      id="dimensions"
      type="text"
      name="dimensions"
      value={formData.dimensions}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Dimensions (ex: 10x20x5)"
    />
  </div>

    {/* État */}
  <div className="flex flex-col gap-1">
    <label
      id="etat-label"
      className="text-sm text-gray-700 font-medium"
    >
      État *
    </label>
    <ComboCreate
      aria-labelledby="etat-label"
      options={etatOptions}
      value={etatValue}
      onChange={onEtatChange}
      placeholder="-- État * --"
      allowCreate={false}
      dropdownPlacement="bottom-start"
      className="w-full"
      menuClassName="z-50"
    />
  </div>

  {/* Catégorie */}
  <div className="flex flex-col gap-1">
    <label
      id="categorie-label"
      className="text-sm text-gray-700 font-medium"
    >
      Catégorie *
    </label>
    <ComboCreate
      aria-labelledby="categorie-label"
      options={categoryOptions}
      value={categoryValue}
      onChange={onCategoryChange}
      placeholder="-- Choisir une catégorie * --"
      allowCreate={false}
      dropdownPlacement="bottom-start"
      className="w-full"
      menuClassName="z-50"
    />
  </div>

  {/* Sous-catégorie */}
  {subcategoryOptions.length > 0 ? (
    <div className="flex flex-col gap-1">
      <label
        id="sous-categorie-label"
        className="text-sm text-gray-700 font-medium"
      >
        Sous-catégorie
      </label>
      <ComboCreate
        aria-labelledby="sous-categorie-label"
        options={subcategoryOptions}
        value={subcategoryValue}
        onChange={onSubcategoryChange}
        placeholder={`-- Choisir une sous-catégorie (${subcategoryOptions.length}) --`}
        allowCreate={false}
        dropdownPlacement="bottom-start"
        className="w-full"
        menuClassName="z-50"
      />
    </div>
  ) : formData.categorie ? (
    <div className="flex flex-col gap-1 text-xs text-gray-500">
      <span>Aucune sous-catégorie trouvée pour cette catégorie.</span>
    </div>
  ) : null}

  {/* Marque */}
  <div className="flex flex-col gap-1">
    <label
      id="marque-label"
      className="text-sm text-gray-700 font-medium"
    >
      Marque *
    </label>
    <ComboCreate
      aria-labelledby="marque-label"
      options={brandOptions}
      value={brandValue}
      onChange={onBrandChange}
      placeholder="-- Choisir une marque * --"
      allowCreate
      dropdownPlacement="bottom-start"
      className="w-full"
      menuClassName="z-50"
    />
  </div>

   {/* Statut + visibilité */}
  <fieldset
    className="flex flex-col gap-1 col-span-2"
    aria-describedby="statut-help"
  >
    <legend className="text-sm text-gray-700 font-medium">
      Statut du produit
    </legend>
    <p id="statut-help" className="text-xs text-gray-500">
      Indique si le produit est actif et visible sur le site.
    </p>

    <div className="flex items-center gap-4 mt-1">
      <div className="flex items-center gap-2">
        <input
          id="est_actif"
          type="checkbox"
          name="est_actif"
          checked={formData.est_actif}
          onChange={handleChange}
          className="w-5 h-5 outline-[#00A9DC]"
        />
        <label htmlFor="est_actif" className="text-gray-700">
          Produit actif
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="visible" className="text-xs text-gray-600">
          Visible sur le site
        </label>
        <select
          id="visible"
          name="visible"
          value={formData.visible ?? ""}
          onChange={handleChange}
          aria-label="Visibilité du produit sur le site"
          className="border rounded-lg p-2 bg-gray-100 w-40 outline-[#00A9DC]"
        >
          <option value="">Visible…</option>
          <option value={1}>1 (oui)</option>
          <option value={0}>0 (non)</option>
        </select>
      </div>
    </div>
  </fieldset>

</div>
<div className="flex flex-col gap-1">
  <label htmlFor="description_long" className="text-sm text-gray-700 font-medium">
    Description longue du produit
  </label>
  <textarea
    id="description_long"
    name="description_long"
    placeholder="Description longue du produit"
    value={formData.description_long}
    onChange={handleChange}
    className="border rounded-lg p-3 bg-gray-100 w-full h-28 resize-none outline-[#00A9DC]"
  />
</div>

  {/* ===== Images ===== */}
<div>
  <h3 className="text-lg font-semibold mb-2">Images *</h3>
  <fieldset
    className="space-y-3"
    aria-label="Images du produit"
  >
    <legend className="sr-only">Images du produit</legend>
    {images.map((img, idx) => (
      <div
        key={idx}
        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
      >
        {/* Fichier */}
        <div className="md:col-span-5">
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              onSelectFile(idx, e.target.files?.[0] ?? null)
            }
            className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
          />
        </div>

        {/* Alt text */}
        {/* <div className="md:col-span-3">
          <input
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
        {/* <div className="md:col-span-2">
          <input
            type="number"
            placeholder="Position"
            value={img.position ?? ""}
            onChange={(e) =>
              updateImage(idx, {
                position:
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
              })
            }
            className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
          />
        </div> */}

        {/* Principale */}
        {/* <div className="md:col-span-1">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="principale"
              aria-label={`Définir l'image ${idx + 1} comme image principale`}
              checked={!!img.principale}
              onChange={() => setPrincipale(idx)}
              className="w-5 h-5 outline-[#00A9DC]"
            />
            <span className="text-gray-700 text-sm md:text-xs">
              Principale
            </span>
          </label>
        </div> */}


        {/* Bouton supprimer */}
        {/* <div className="md:col-span-1 flex justify-end">
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
          >
            -
          </button>
        </div> */}

        {/* Aperçu + URL */}
        <div className="md:col-span-12 text-sm mt-1">
          {img._uploading && (
            <span className="text-gray-600">
              Téléversement en cours…
            </span>
          )}
          {!img._uploading && img.url && (
            <div className="flex items-start gap-3 overflow-x-auto">
              <img
              width={300}
                      height={300}
                src={img.url}
                alt={img.alt_text || ""}
                loading="lazy"
                className="h-16 w-16 object-cover rounded-md border flex-shrink-0"
              />
              <span className="text-gray-700 break-all text-xs md:text-sm">
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
 </fieldset>

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

        {/* ===== Variante ===== */}
       <h3 className="text-lg font-semibold mt-2">Variante</h3>
<div className="grid grid-cols-2 gap-4">
  {/* Nom variante */}
  <div className="flex flex-col gap-1">
    <label htmlFor="variante_nom" className="text-sm text-gray-700 font-medium">
      Nom de la variante (optionnel)
    </label>
    <input
      id="variante_nom"
      type="text"
      name="variante_nom"
      value={formData.variante_nom}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Nom de la variante (optionnel)"
    />
  </div>

  {/* Couleur */}
  <div className="flex flex-col gap-1">
    <label
      id="couleur-label"
      className="text-sm text-gray-700 font-medium"
    >
      Couleur (optionnel)
    </label>
    <ComboCreate
      aria-labelledby="couleur-label"
      options={colorOptions}
      value={colorValue}
      onChange={onColorChange}
      placeholder="-- Couleur (optionnel) --"
      allowCreate
      dropdownPlacement="bottom-start"
      className="w-full"
      menuClassName="z-50"
    />
  </div>


  {/* SKU */}
  <div className="flex flex-col gap-1">
    <label htmlFor="sku" className="text-sm text-gray-700 font-medium">
      SKU (optionnel)
    </label>
    <input
      id="sku"
      type="text"
      name="sku"
      value={formData.sku}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="SKU (optionnel)"
    />
  </div>

  {/* Code-barres */}
  <div className="flex flex-col gap-1">
    <label htmlFor="code_barres" className="text-sm text-gray-700 font-medium">
      Code-barres (optionnel)
    </label>
    <input
      id="code_barres"
      type="text"
      name="code_barres"
      value={formData.code_barres}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Code-barres (optionnel)"
    />
  </div>

  {/* Prix */}
  <div className="flex flex-col gap-1">
    <label htmlFor="prix" className="text-sm text-gray-700 font-medium">
      Prix normal *
    </label>
    <input
      id="prix"
      type="number"
      step="0.01"
      name="prix"
      value={formData.prix ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Prix normal *"
      required
    />
  </div>

  {/* Prix promo */}
  <div className="flex flex-col gap-1">
    <label htmlFor="prix_promo" className="text-sm text-gray-700 font-medium">
      Prix promo (optionnel)
    </label>
    <input
      id="prix_promo"
      type="number"
      step="0.01"
      name="prix_promo"
      value={formData.prix_promo ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Prix promo (optionnel)"
    />
  </div>

  {/* Dates promo */}
  <div className="flex flex-col gap-1">
    <DateTimePicker
      label="Début promo"
      name="promo_debut"
      value={formData.promo_debut}
      onChange={(name, val) => setFormData(p => ({ ...p, [name]: val }))}
      className="w-full"
    />
  </div>
  <div className="flex flex-col gap-1">
    <DateTimePicker
      label="Fin promo"
      name="promo_fin"
      value={formData.promo_fin}
      onChange={(n, v) => setFormData(p => ({ ...p, [n]: v }))}
      minDate={parseLocalDateTime(formData.promo_debut) ?? undefined}
      className="w-full"
    />
  </div>

  {/* Stock */}
  <div className="flex flex-col gap-1">
    <label htmlFor="stock" className="text-sm text-gray-700 font-medium">
      Stock (optionnel)
    </label>
    <input
      id="stock"
      type="number"
      name="stock"
      value={formData.stock ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Stock (optionnel)"
    />
  </div>

  {/* Prix d'achat */}
  <div className="flex flex-col gap-1">
    <label htmlFor="prix_achat" className="text-sm text-gray-700 font-medium">
      Prix d’achat (optionnel)
    </label>
    <input
      id="prix_achat"
      type="number"
      step="0.01"
      name="prix_achat"
      value={formData.prix_achat ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Prix d’achat (optionnel)"
    />
  </div>

  {/* Poids variante */}
  <div className="flex flex-col gap-1">
    <label htmlFor="variante_poids_grammes" className="text-sm text-gray-700 font-medium">
      Poids variante (g) (optionnel)
    </label>
    <input
      id="variante_poids_grammes"
      type="number"
      step="0.01"
      name="variante_poids_grammes"
      value={formData.variante_poids_grammes ?? ""}
      onChange={handleChange}
      className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
      placeholder="Poids variante (g) (optionnel)"
    />
  </div>
<div className="flex flex-col gap-1">
  <label className="text-sm text-gray-700 font-medium">Capacité stockage</label>
  <input
    type="number"
    name="capacite_stockage"
    value={formData.capacite_stockage ?? ""}
    onChange={(e) =>
      setFormData(p => ({
        ...p,
        capacite_stockage: e.target.value === "" ? "" : Number(e.target.value),
      }))
    }
    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
    placeholder="Ex: 64"
  />
</div>
  {/* Promo active */}
  <div className="flex items-center gap-2">
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        name="promo_active"
        checked={formData.promo_active}
        onChange={handleChange}
        className="w-5 h-5 outline-[#00A9DC]"
      />
      <span className="text-gray-700">Promotion active</span>
    </label>
  </div>

  {/* Variante active */}
  <div className="flex items-center gap-2">
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        name="variante_est_actif"
        checked={formData.variante_est_actif}
        onChange={handleChange}
        className="w-5 h-5 outline-[#00A9DC]"
      />
      <span className="text-gray-700">Variante active</span>
    </label>
  </div>
</div>


{/* === Autres variantes === */}
<div className="mt-4 flex items-center justify-between">
  <h4 className="text-md font-semibold">Autres variantes</h4>
  <button
    type="button"
    onClick={addVariantRow}
    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
  >
    + Ajouter une variante
  </button>
</div>

{extraVariants.length > 0 && (
  <div className="mt-3 space-y-4">
    {extraVariants.map((v, idx) => (
      <div
        key={idx}
        className="border rounded-xl bg-white/70 p-3 space-y-3"
      >
        <div className="flex justify-between items-center">
          <span className="font-medium text-sm">
            Variante #{idx + 2}
          </span>
          <button
            type="button"
            onClick={() => removeVariantRow(idx)}
            className="px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs"
          >
            Supprimer
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-700">Nom variante</label>
            <input
              type="text"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
              value={v.nom}
              onChange={(e) =>
                updateVariantRow(idx, "nom", e.target.value)
              }
              placeholder="Nom de la variante"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-700">SKU</label>
            <input
              type="text"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
              value={v.sku}
              onChange={(e) =>
                updateVariantRow(idx, "sku", e.target.value)
              }
              placeholder="SKU"
            />
          </div>
{/* Couleur de cette variante */}
<div className="flex flex-col gap-1">
  <label
    id={`variante-${idx}-couleur-label`}
    className="text-xs text-gray-700"
  >
    Couleur
  </label>
  <ComboCreate
    aria-labelledby={`variante-${idx}-couleur-label`}
    options={colorOptions}
    value={
      v.couleur === "__custom__"
        ? v.couleur_libre
          ? { id: "__custom__", label: v.couleur_libre }
          : null
        : colorOptions.find((o) => String(o.id) === String(v.couleur)) ?? null
    }
    onChange={(opt) => {
      if (!opt) {
        updateVariantRow(idx, "couleur", "");
        updateVariantRow(idx, "couleur_libre", "");
        return;
      }
      if (colorOptions.some((o) => String(o.id) === String(opt.id))) {
        // couleur venant de la liste
        updateVariantRow(idx, "couleur", String(opt.id ?? ""));
        updateVariantRow(idx, "couleur_libre", "");
      } else {
        // couleur libre
        updateVariantRow(idx, "couleur", "__custom__");
        updateVariantRow(idx, "couleur_libre", opt.label);
      }
    }}
    placeholder="-- Couleur --"
    allowCreate
    dropdownPlacement="bottom-start"
    className="w-full"
    menuClassName="z-50"
  />
</div>
<div className="flex flex-col gap-1">
  <label className="text-xs text-gray-700">Capacité stockage</label>
  <input
    type="number"
    className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
    value={v.capacite_stockage ?? ""}
    onChange={(e) =>
      updateVariantRow(
        idx,
        "capacite_stockage" as any,
        e.target.value === "" ? "" : Number(e.target.value)
      )
    }
    placeholder="Ex: 64"
  />
</div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-700">Prix</label>
            <input
              type="number"
              step="0.01"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
              value={v.prix ?? ""}
              onChange={(e) =>
                updateVariantRow(
                  idx,
                  "prix",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="Prix"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-700">Prix promo</label>
            <input
              type="number"
              step="0.01"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
              value={v.prix_promo ?? ""}
              onChange={(e) =>
                updateVariantRow(
                  idx,
                  "prix_promo",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="Prix promo"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-700">Stock</label>
            <input
              type="number"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC] text-sm"
              value={v.stock ?? ""}
              onChange={(e) =>
                updateVariantRow(
                  idx,
                  "stock",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="Stock"
            />
          </div>

          <div className="flex items-center gap-2 mt-4">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={v.promo_active}
                onChange={(e) =>
                  updateVariantRow(idx, "promo_active", e.target.checked)
                }
                className="w-4 h-4 outline-[#00A9DC]"
              />
              Promo active
            </label>
          </div>
        </div>
      </div>
    ))}
  </div>
)}


{/* ===== Spécifications dynamiques ===== */}
<div className="mt-6">
  <h3 className="text-lg font-semibold">Spécifications</h3>

  {/* Pas encore de catégorie sélectionnée */}
  {!hasCategory && (
    <p className="text-sm text-gray-500 mt-1">
      Sélectionne d’abord une catégorie pour voir ses spécifications.
    </p>
  )}

  {/* Catégorie sélectionnée, mais aucun attribut côté backend */}
  {hasCategory && !(attrsProduct?.length || attrsVariant?.length) && (
    <p className="text-sm text-gray-500 mt-1">
      Aucun attribut défini pour cette catégorie.
    </p>
  )}

  {/* Catégorie sélectionnée + attributs disponibles */}
  {hasCategory && !!(attrsProduct?.length || attrsVariant?.length) && (
    <div className="mt-3 space-y-4">
      {/* Produit */}
      {!!attrsProduct?.length && (
        <div className="rounded-xl border p-4 bg-white/60">
          <h4 className="font-semibold mb-3">Niveau Produit</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(attrsProduct ?? []).map((a: AttrMeta) => (
              <div key={`p_${a.code}`} className="flex flex-col gap-1">
                <label className="text-sm text-gray-700">
                  {a.libelle}{" "}
                  <span className="text-gray-400">({a.code})</span>
                </label>
                {renderAttrInput("product", a, prodAttrs[a.code], (v) =>
                  setProdAttrs((m) => ({ ...m, [a.code]: v }))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variante */}
      {!!attrsVariant?.length && (
        <div className="rounded-xl border p-4 bg-white/60">
          <h4 className="font-semibold mb-3">Niveau Variante</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(attrsVariant ?? [])
              .filter(
                (a: AttrMeta) =>
                  !(
                    a.code === "couleur" &&
                    (formData.couleur || formData.couleur_libre)
                  )
              )
              .map((a: AttrMeta) => (
                <div key={`v_${a.code}`} className="flex flex-col gap-1">
                  <label className="text-sm text-gray-700">
                    {a.libelle}{" "}
                    <span className="text-gray-400">({a.code})</span>
                  </label>
                  {renderAttrInput("variant", a, varAttrs[a.code], (v) =>
                    setVarAttrs((m) => ({ ...m, [a.code]: v }))
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )}
</div>

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg hover:bg-green-800 transition">
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
