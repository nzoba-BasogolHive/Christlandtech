
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadProductImage, createDashboardCategory } from "../hooks/useFetchQuery";

/* ---------- Toast réutilisable ---------- */
const Toast: React.FC<{
  kind: "success" | "error";
  msg: string;
  onClose(): void;
}> = ({ kind, msg, onClose }) => {
  const role = kind === "error" ? "alert" : "status";
  const live = kind === "error" ? "assertive" : "polite";

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-lg px-4 py-3 text-white ${
        kind === "success" ? "bg-emerald-600" : "bg-rose-600"
      }`}
      role={role}
      aria-live={live}
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <span className="font-semibold">
          {kind === "success" ? "Succès" : "Erreur"}
        </span>
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
};

/* ---------- Types locaux ---------- */
type CategoryFormState = {
  nom: string;
  slug: string; // (optionnel) le backend peut aussi le générer
  description: string;
  image_url: string;
  est_actif: boolean;
};

type SubCategoryFormState = {
  nom: string;
  description: string;
  image_url: string;
  est_actif: boolean;
};

const CathegorieForm: React.FC = () => {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);

  const [formData, setFormData] = useState<CategoryFormState>({
    nom: "",
    slug: "",
    description: "",
    image_url: "",
    est_actif: true,
  });

  const [imageUploading, setImageUploading] = useState(false);

  // 🟢 Sous-catégories dynamiques
  const [subCategories, setSubCategories] = useState<SubCategoryFormState[]>([]);

  /* ---------- Helpers ---------- */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const t = e.currentTarget;
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      setFormData((p) => ({ ...p, [t.name]: t.checked }));
      return;
    }
    setFormData((p) => ({ ...p, [t.name]: t.value }));
  };

  // Upload image catégorie principale
  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);
      const { url } = await uploadProductImage(file, formData.nom || undefined);

      setFormData((prev) => ({
        ...prev,
        image_url: url,
      }));

      setToast({
        kind: "success",
        msg: "Image uploadée avec succès.",
      });
    } catch (err: any) {
      setToast({
        kind: "error",
        msg: err?.message || "Échec de l’upload de l’image.",
      });
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image_url: "",
    }));
  };

  /* ---------- Sous-catégories ---------- */
  const addSubCategory = () => {
    setSubCategories((prev) => [
      ...prev,
      { nom: "", description: "", image_url: "", est_actif: true },
    ]);
  };

  const removeSubCategory = (index: number) => {
    setSubCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubChange = (
    index: number,
    field: keyof SubCategoryFormState,
    value: string | boolean
  ) => {
    setSubCategories((prev) =>
      prev.map((sub, i) => (i === index ? { ...sub, [field]: value } : sub))
    );
  };

  const handleSubImageFileChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);
      const { url } = await uploadProductImage(
        file,
        subCategories[index].nom || undefined
      );

      setSubCategories((prev) =>
        prev.map((sub, i) =>
          i === index ? { ...sub, image_url: url } : sub
        )
      );
    } catch {
      setToast({
        kind: "error",
        msg: "Erreur upload image sous-catégorie.",
      });
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  /* ---------- Validation & submit ---------- */
const validateRequired = (): string | null => {
  if (!formData.nom.trim()) {
    return "Le nom de la catégorie est requis.";
  }

  // 👉 Règle "tout ou rien" pour les sous-catégories
  for (let i = 0; i < subCategories.length; i++) {
    const sub = subCategories[i];

    // ligne complètement vide => on ignore
    const isEmptyLine =
      !sub.nom.trim() &&
      !sub.description.trim() &&
      !sub.image_url;

    if (isEmptyLine) {
      continue;
    }

    // il y a quelque chose : on exige un nom
    if (!sub.nom.trim()) {
      return `Veuillez renseigner le nom de la sous-catégorie #${i + 1}.`;
    }

    
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

    try {
      setSubmitting(true);

      // 1) Création de la catégorie PRINCIPALE (parent = null)
      const parentCreated = await createDashboardCategory({
        nom: formData.nom.trim(),
        slug: formData.slug?.trim() || undefined,
        description: formData.description,
        parent: null,
        image_url: formData.image_url || null,
        est_actif: formData.est_actif,
      });

      // 2) Création de chaque sous-catégorie liée au parentCreated.id
      for (const sub of subCategories) {
        if (!sub.nom.trim()) continue; // ignore les lignes vides

        await createDashboardCategory({
          nom: sub.nom.trim(),
          description: sub.description,
          parent: parentCreated.id, // 🔗 parent_id = catégorie principale
          image_url: sub.image_url || null,
          est_actif: sub.est_actif,
        });
      }

      setToast({
        kind: "success",
        msg: "Catégorie et sous-catégories créées avec succès.",
      });
// console.log("REDIRECT TO:", "/dashboard?tab=categories");
setTimeout(() => {
  navigate(
    { pathname: "/dashboard", search: "?tab=categories" },
    {
      replace: true,
      state: {
        flash: "Catégorie créée ✅",
        tab: "categories", // ✅ AJOUT
      },
    }
  );
}, 500);
    } catch (e: any) {
      setToast({
        kind: "error",
        msg: e?.message || "Erreur lors de l'enregistrement.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    // 🔽 max-h + overflow-y-auto = scroll à l’intérieur de la carte
    <div
      className="bg-gray-50 rounded-xl shadow-lg w-full lg:w-4/5 max-h-[75vh] overflow-y-auto overscroll-contain pr-2 pb-6"
      role="region"
      aria-labelledby="category-form-heading"
      aria-busy={submitting || imageUploading}
    >
      {toast && (
        <Toast
          kind={toast.kind}
          msg={toast.msg}
          onClose={() => setToast(null)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-6 space-y-6"
        noValidate
      >
        <h2
          id="category-form-heading"
          className="text-xl font-semibold mb-2"
        >
          Ajouter une catégorie
        </h2>

        {/* Nom catégorie principale */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nom" className="text-sm text-gray-700">
              Nom de la catégorie <span className="text-red-600">*</span>
            </label>
            <input
              id="nom"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              placeholder="Nom de la catégorie *"
              className="border rounded-lg p-2 bg-gray-100 w-full outline-[#00A9DC]"
              required
              aria-required="true"
            />
          </div>
        </div>

        {/* Image catégorie principale */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-700" htmlFor="cat-image-input">
            Image de la catégorie
          </label>

          <input
            id="cat-image-input"
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="block w-full text-sm text-gray-700
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-lg file:border-0
                       file:text-sm file:font-semibold
                       file:bg-[#00A9DC] file:text-white
                       hover:file:bg-[#0797c4]"
            aria-describedby={imageUploading ? "category-image-help" : undefined}
          />

          {imageUploading && (
            <span
              id="category-image-help"
              className="text-xs text-gray-500"
            >
              Upload de l’image en cours...
            </span>
          )}

          {formData.image_url && (
            <div className="flex items-center gap-4 mt-2">
              <img
                width={300}
                height={300}
                src={formData.image_url}
                alt={formData.nom || "Aperçu de la catégorie"}
                loading="lazy"
                className="h-20 w-20 object-cover rounded-lg border"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/Dispositivos.webp";
                }}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-sm text-red-600 hover:underline"
              >
                Supprimer l’image
              </button>
            </div>
          )}
        </div>

        {/* Sous-catégories (bloc scrollable si long) */}
        <div
          className="border rounded-xl p-4 bg-white space-y-3 max-h-80 overflow-y-auto"
          aria-label="Sous-catégories de la catégorie"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm md:text-base">
              Sous-catégories (optionnel)
            </h3>
            <button
              type="button"
              onClick={addSubCategory}
              className="text-xs md:text-sm px-3 py-1 rounded-full bg-[#00A9DC] text-white hover:bg-[#0797c4]"
              aria-label="Ajouter une nouvelle sous-catégorie"
            >
              + Ajouter une sous-catégorie
            </button>
          </div>

          {subCategories.length === 0 && (
            <p className="text-xs text-gray-500">
              Vous pouvez ajouter plusieurs sous-catégories (Nom, Description, Image).
            </p>
          )}

          {subCategories.map((sub, index) => (
            <div
              key={index}
              className="border rounded-lg p-3 bg-gray-50 space-y-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Sous-catégorie #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSubCategory(index)}
                  className="text-xs text-red-600 hover:underline"
                  aria-label={`Supprimer la sous-catégorie numéro ${index + 1}`}
                >
                  Supprimer
                </button>
              </div>

              {/* Nom */}
              <label className="block text-xs text-gray-700">
                Nom
                <input
                  type="text"
                  value={sub.nom}
                  onChange={(e) =>
                    handleSubChange(index, "nom", e.target.value)
                  }
                  placeholder="Nom de la sous-catégorie"
                  className="mt-1 border rounded-lg p-2 w-full text-sm"
                />
              </label>

              {/* Description */}
              <label className="block text-xs text-gray-700">
                Description
                <textarea
                  value={sub.description}
                  onChange={(e) =>
                    handleSubChange(index, "description", e.target.value)
                  }
                  placeholder="Description"
                  className="mt-1 border rounded-lg p-2 w-full text-sm"
                />
              </label>

              {/* Upload image */}
              <div>
                <label
                  htmlFor={`subcat-image-${index}`}
                  className="block text-xs text-gray-700"
                >
                  Image de la sous-catégorie
                </label>
                <input
                  id={`subcat-image-${index}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSubImageFileChange(index, e)}
                  className="mt-1 block w-full text-xs"
                />
                {sub.image_url && (
                  <img
                    width={300}
                    height={300}
                    src={sub.image_url}
                    loading="lazy"
                    alt={sub.nom || `Image sous-catégorie ${index + 1}`}
                    className="mt-2 h-16 w-16 object-cover rounded-md border"
                  />
                )}
              </div>

              {/* Actif ? */}
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sub.est_actif}
                  onChange={(e) =>
                    handleSubChange(index, "est_actif", e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span>Sous-catégorie active</span>
              </label>
            </div>
          ))}
        </div>

        {/* Description catégorie principale */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="description"
            className="text-sm text-gray-700"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Description de la catégorie"
            className="border rounded-lg p-3 bg-gray-100 w-full h-28 resize-none outline-[#00A9DC]"
          />
        </div>

        {/* Statut */}
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="est_actif"
              checked={formData.est_actif}
              onChange={handleChange}
              className="w-5 h-5 outline-[#00A9DC]"
            />
            <span className="text-gray-700">Catégorie active</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            aria-disabled={submitting}
            className="bg-[#00A9DC] disabled:opacity-60 text-white px-5 py-2 rounded-lg hover:bg-[#0797c4] transition"
          >
            {submitting ? "Création..." : "Créer la catégorie"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CathegorieForm;
