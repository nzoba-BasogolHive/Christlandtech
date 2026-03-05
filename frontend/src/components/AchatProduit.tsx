
import * as React from "react";
import { FiChevronRight, FiChevronDown } from "react-icons/fi";
import { MdOutlineWhatsapp } from "react-icons/md";
import { FaTelegramPlane } from "react-icons/fa";
import { SiSignal } from "react-icons/si";
import { useTranslation } from "react-i18next";
import ReactCountryFlag from "react-country-flag";
// @ts-ignore : la lib n'a pas de types, on ignore juste l'erreur TS
import { allCountries } from "country-telephone-data";

import { useFetchQuery, api, type ApiProduct } from "../hooks/useFetchQuery";

import logo from "../assets/images/logo.webp";
import ordi from "../assets/images/achat/779c4768-1ab0-4692-92a5-718c01baf4f8.jfif";
import cana from "../assets/images/achat/0cbf9c9c-7cfd-4c3d-ae29-e2b2b0471cfe.jfif";

const ACCENT = "bg-[#00A8E8] text-white border-[#00A8E8]";
const ACCENT_HOVER = "hover:opacity-90";
const WHATSAPP_DEFAULT_PHONE = "+237691554641";
const TELEGRAM_USERNAME = "Val237"; // ton compte service client, sans @
// const SIGNAL_NUMBER = "+237691554641"; // si tu veux un numéro Signal fixe

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='16'%3EImage indisponible%3C/text%3E%3C/svg%3E";

type CanalContact = "whatsapp" | "signal" | "telegram";

type CountryOption = {
  code: string; // "CM", "FR", ...
  name: string;
  dial: string; // "+237"
};

// la forme réelle des objets de la lib
type RawCountry = {
  name: string;
  iso2: string;
  dialCode: string;
};

const COUNTRY_OPTIONS: CountryOption[] = (allCountries as RawCountry[])
  .map((c) => ({
    name: c.name,
    code: c.iso2.toUpperCase(),
    dial: `+${c.dialCode}`,
  }))
  .filter((c) => c.name && c.code && c.dial);

// Type minimal du produit utilisé par le bouton Commander
export type ProduitMini = {
  id: number;
  slug: string;
  nom: string;
  ref?: string;
  image?: string;
};

type Props = {
  produit?: ProduitMini | null;
  productId?: number;
  productSlug?: string;
  refEl?: React.RefObject<HTMLDivElement | null>;
  onClose?: () => void; // 🔹 appelé après envoi pour fermer le modal
  compact?: boolean; // ✅ AJOUT (mode modal / compact)
};

const getPrimaryImage = (p?: ApiProduct | null): string | undefined => {
  if (!p?.images?.length) return undefined;
  const primary = p.images.find((im) => im.principale) ?? p.images[0];
  return primary?.url || undefined;
};

const toMini = (p: ApiProduct): ProduitMini => ({
  id: p.id,
  slug: p.slug,
  nom: p.nom,
  ref: p.slug?.toUpperCase(),
  image: getPrimaryImage(p),
});

const AchatProduit: React.FC<Props> = ({
  produit,
  productId,
  productSlug,
  refEl,
  onClose,
  compact,
}) => {
  const { t } = useTranslation();

  // 🔑 IDs accessibles pour les champs de formulaire
  const typeId = React.useId();
  const qteId = React.useId();
  const nomId = React.useId();
  const telId = React.useId();
  const countrySearchId = React.useId();

  // Décide si on doit fetcher
  const shouldFetch = !produit && (!!productId || !!productSlug);
  const detailPath = React.useMemo(() => {
    if (productId) return `/api/catalog/products/${productId}/`;
    if (productSlug)
      return `/api/catalog/products/${encodeURIComponent(productSlug)}/`;
    return "";
  }, [productId, productSlug]);

  // Chargement du produit
  const {
    data: fetched,
    loading: loadingProduct,
    error: productError,
  } = useFetchQuery<ApiProduct>(api(detailPath), {
    enabled: shouldFetch && !!detailPath,
    keepPreviousData: false,
  });

  const mini: ProduitMini | null = React.useMemo(() => {
    if (produit) return produit;
    if (fetched) return toMini(fetched);
    return null;
  }, [produit, fetched]);

  const isModal = !!onClose; // si onClose existe, on est dans le modal
  const isCompact = !!compact || isModal; // ✅ mode compact auto en modal

  // ------- État formulaire -------
  const [typeDemande, setTypeDemande] = React.useState("Devis");
  const [qte, setQte] = React.useState("");
  const [nom, setNom] = React.useState("");

  // téléphone : pays + numéro local
  const [country, setCountry] = React.useState<CountryOption>(
    COUNTRY_OPTIONS.find((c) => c.code === "CM") || COUNTRY_OPTIONS[0]
  );
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState("");
  const [telLocal, setTelLocal] = React.useState("");

  const [canal, setCanal] = React.useState<CanalContact>("whatsapp");
  const [submitting, setSubmitting] = React.useState(false);

  const filteredCountries = React.useMemo(() => {
    const term = countrySearch.trim().toLowerCase();
    if (!term) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dial.replace("+", "").includes(term)
    );
  }, [countrySearch]);

  // ------- Promo (slide vertical auto) -------
  const PROMOS = React.useMemo(
    () => [
      cana,
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1060&auto=format&fit=crop",
      ordi,
    ],
    []
  );

  const [promoIndex, setPromoIndex] = React.useState(0);
  const AUTO_MS = 3500;
  const timerRef = React.useRef<number | null>(null);

  const startAuto = React.useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setPromoIndex((i) => (i + 1) % PROMOS.length);
    }, AUTO_MS);
  }, [PROMOS.length]);

  const stopAuto = React.useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (isCompact) return; // ✅ pas de promo auto en compact
    startAuto();
    return stopAuto;
  }, [startAuto, stopAuto, isCompact]);

  React.useEffect(() => {
    if (isCompact) return;
    const onVis = () => (document.hidden ? stopAuto() : startAuto());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startAuto, stopAuto, isCompact]);

  // ------- Messageries externes -------
  const ensureRecipientPhone = (): string | null => {
    const p = WHATSAPP_DEFAULT_PHONE.replace(/\D/g, "");
    if (p.length < 7 || p.length > 15) {
      alert(
        "Numéro WhatsApp invalide. Utilisez le format international, sans + ni espaces."
      );
      return null;
    }
    return p;
  };

  const openChatChannel = (channel: CanalContact, fullMsg: string) => {
    const encoded = encodeURIComponent(fullMsg);

    if (channel === "whatsapp") {
      const recipient = ensureRecipientPhone();
      if (!recipient) return;
      window.open(`https://wa.me/${recipient}?text=${encoded}`, "_blank");
      return;
    }

    if (channel === "telegram") {
      window.open(`https://t.me/${TELEGRAM_USERNAME}?text=${encoded}`, "_blank");
      return;
    }

    // if (channel === "signal") {
    //   const openSignal = () => {
    //     window.open(`https://signal.me/#p/${SIGNAL_NUMBER}`, "_blank");
    //   };

    //   if (navigator.clipboard && window.isSecureContext) {
    //     navigator.clipboard
    //       .writeText(fullMsg)
    //       .then(() => {
    //         openSignal();
    //         alert(
    //           "Signal va s'ouvrir.\nLe message a été copié, il vous suffit de le coller dans la conversation et de l'envoyer."
    //         );
    //       })
    //       .catch(() => {
    //         window.prompt("Copiez ce message puis collez-le dans Signal :", fullMsg);
    //         openSignal();
    //       });
    //   } else {
    //     window.prompt("Copiez ce message puis collez-le dans Signal :", fullMsg);
    //     openSignal();
    //   }
    //   return;
    // }
  };

  const baseBtnClasses =
    "flex w-full max-w-[360px] sm:max-w-[420px] md:max-w-[480px] lg:max-w-[520px] mx-auto items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-[15px] font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";

  const channelBtnClasses: Record<CanalContact, string> = {
    whatsapp: "bg-[#25D366] hover:bg-[#1ebe57] text-white border-[#25D366]",
    signal: "bg-[#3a76f0] hover:bg-[#275ccd] text-white border-[#3a76f0]",
    telegram: "bg-[#229ED9] hover:bg-[#1b86b8] text-white border-[#229ED9]",
  };

  const renderSubmitIcon = () => {
    if (submitting) return null;
    switch (canal) {
      case "whatsapp":
        return <MdOutlineWhatsapp className="h-5 w-5" />;
      case "signal":
        return <SiSignal className="h-5 w-5" />;
      case "telegram":
        return <FaTelegramPlane className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const renderSubmitLabel = () => {
    if (submitting) return t("form.sending") || "Envoi…";
    switch (canal) {
      case "whatsapp":
        return t("form.button.whatsapp") || "Envoyer via WhatsApp";
      case "signal":
        return t("form.button.signal") || "Ouvrir Signal";
      case "telegram":
        return t("form.button.telegram") || "Envoyer via Telegram";
      default:
        return t("com.sen") || "Envoyer";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mini) return;

    if (!qte.trim() || !nom.trim() || !telLocal.trim()) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    const fullTel = `${country.dial} ${telLocal}`.trim();

    const fullMsg = `Bonjour, je suis intéressé par le produit : ${mini.nom} (${mini.ref ?? "—"})
Type de demande : ${typeDemande}
Quantité : ${qte || "—"}
Nom & Prénom : ${nom || "—"}
Téléphone : ${fullTel || "—"}`;

    setSubmitting(true);
    try {
      openChatChannel(canal, fullMsg);

      // ✅ ferme le modal si on est dedans
      if (onClose) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- États intermédiaires ----
  if (shouldFetch && loadingProduct) {
    return (
      <section ref={refEl} className="w-full">
        <div className="mx-auto max-w-screen-2xl px-4 py-10 text-center text-gray-600">
          Chargement du produit…
        </div>
      </section>
    );
  }

  if (shouldFetch && productError) {
    return (
      <section ref={refEl} className="w-full">
        <div className="mx-auto max-w-screen-2xl px-4 py-10 text-center text-red-600">
          Impossible de charger ce produit pour le moment.
        </div>
      </section>
    );
  }

  if (!mini) return <section ref={refEl} className="w-full" />;

  const translatePct = (promoIndex / PROMOS.length) * 100;
  const itemHeightPct = 100 / PROMOS.length;
  const imgSrc = mini.image || FALLBACK_IMG;

  // =======================
  // ✅ MODE COMPACT (MODAL)
  // =======================
  if (isCompact) {
    return (
      <section ref={refEl} className="w-full" aria-labelledby="achat-produit-titre">
        <div className="p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* LEFT: produit */}
            <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100">
                <div className="pt-[75%]" />
                <img
                  src={imgSrc}
                  alt={mini.nom}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain p-3"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                  }}
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold tracking-wider text-gray-500">
                  PRODUIT SÉLECTIONNÉ
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-gray-900">{mini.nom}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t("com.ref")} {mini.ref ?? "—"}
                </p>
              </div>
            </aside>

            {/* RIGHT: form */}
            <article className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="p-4 sm:p-6">
                <h2
                  id="achat-produit-titre"
                  className="text-lg sm:text-xl font-extrabold text-gray-900 text-center"
                >
                  {t("com.ach")}
                </h2>

                <div className="mt-4">
                  <button
                    type="button"
                    aria-disabled="true"
                    tabIndex={-1}
                    className={`w-full mx-auto inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-[15px] font-semibold ${ACCENT} ${ACCENT_HOVER}`}
                  >
                    {t("com.nom")} : {mini.nom}
                  </button>

                  <form className="mt-5" onSubmit={handleSubmit}>
                    <div className="grid gap-5 w-full max-w-[620px] mx-auto">
                      <div>
                        <label htmlFor={typeId} className="block text-sm font-semibold text-gray-800 mb-1">
                          {t("com.type")} <span className="text-red-500">*</span>
                        </label>
                        <select
                          id={typeId}
                          value={typeDemande}
                          onChange={(e) => setTypeDemande(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/30"
                        >
                          <option>{t("com.qo")}</option>
                          <option>{t("com.ac")}</option>
                          <option>{t("com.in")}</option>
                          <option>{t("com.di")}</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={qteId} className="block text-sm font-semibold text-gray-800 mb-1">
                          {t("com.quc")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id={qteId}
                          type="number"
                          min={1}
                          placeholder="Ex: 3"
                          value={qte}
                          onChange={(e) => setQte(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/30"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor={nomId} className="block text-sm font-semibold text-gray-800 mb-1">
                          {t("com.np")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id={nomId}
                          type="text"
                          placeholder="Ex: Nzogue Rachel"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/30"
                          required
                        />
                      </div>

                      {/* Téléphone */}
                      <div>
                        <label htmlFor={telId} className="block text-sm font-semibold text-gray-800 mb-1">
                          {t("com.tel")} <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <div className="flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#00A8E8]/30 focus-within:border-[#00A8E8]">
                            <button
                              type="button"
                              onClick={() => setCountryOpen((open) => !open)}
                              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 border-r border-gray-200"
                              aria-haspopup="listbox"
                              aria-expanded={countryOpen}
                              aria-controls="country-listbox"
                            >
                              <ReactCountryFlag
                                svg
                                countryCode={country.code}
                                className="h-4 w-6 rounded-sm shadow-sm"
                              />
                              <span className="font-medium text-gray-800">{country.dial}</span>
                              <FiChevronDown className="h-3 w-3 text-gray-500" aria-hidden="true" />
                            </button>

                            <input
                              id={telId}
                              type="tel"
                              value={telLocal}
                              onChange={(e) => setTelLocal(e.target.value)}
                              className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
                              placeholder="Ex : 699 99 99 99"
                              required
                            />
                          </div>

                          {countryOpen && (
                            <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                                <label htmlFor={countrySearchId} className="sr-only">
                                  Rechercher un pays
                                </label>
                                <input
                                  id={countrySearchId}
                                  type="text"
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  placeholder="Rechercher un pays"
                                  className="w-full text-sm bg-transparent outline-none"
                                />
                              </div>

                              <ul
                                id="country-listbox"
                                className="max-h-64 overflow-y-auto text-sm"
                                role="listbox"
                              >
                                {filteredCountries.map((c) => (
                                  <li key={c.code}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCountry(c);
                                        setCountryOpen(false);
                                        setCountrySearch("");
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left"
                                      role="option"
                                      aria-selected={c.code === country.code}
                                    >
                                      <ReactCountryFlag
                                        svg
                                        countryCode={c.code}
                                        className="h-4 w-6 rounded-sm shadow-sm"
                                      />
                                      <span className="flex-1 truncate">{c.name}</span>
                                      <span className="text-xs text-gray-500">{c.dial}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Canal */}
                      <fieldset className="mt-1">
                        <legend className="block text-gray-700 mb-2 text-sm">
                          {t("contact.channel.label") || "Canal de contact préféré"}
                        </legend>
                        <div className="flex flex-wrap gap-2" role="radiogroup">
                          {[
                            { key: "whatsapp", label: t("contact.channel.whatsapp") || "WhatsApp" },
                            // { key: "signal", label: t("contact.channel.signal") || "Signal" },
                            { key: "telegram", label: t("contact.channel.telegram") || "Telegram" },
                          ].map((opt) => {
                            const active = canal === (opt.key as CanalContact);
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setCanal(opt.key as CanalContact)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                                  active
                                    ? "bg-[#00A8E8] text-white border-[#00A8E8]"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                                role="radio"
                                aria-checked={active}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>

                      <div
                        className="pt-2 flex justify-center mt-2"
                        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
                      >
                        <button
                          type="submit"
                          disabled={submitting}
                          className={`${baseBtnClasses} ${channelBtnClasses[canal]}`}
                        >
                          {renderSubmitIcon()}
                          <span>{renderSubmitLabel()}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  }

  // =======================
  // ✅ MODE NORMAL (PAGE)
  // =======================
  return (
    <section ref={refEl} className="w-full" aria-labelledby="achat-produit-titre">
      <div
        className={
          isModal
            ? "mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4"
            : "mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 md:py-10"
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 lg:gap-8">
          {/* ---- CARTE PROMO ---- */}
          <article className="relative md:self-center" aria-label="Promotions Christland Tech">
            <div
              className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-black h-[360px] sm:h-[380px] md:h-[420px] lg:h-[460px]"
              onMouseEnter={stopAuto}
              onMouseLeave={startAuto}
            >
              <div
                className="absolute inset-0 transition-transform duration-500 ease-out"
                style={{
                  height: `${PROMOS.length * 100}%`,
                  transform: `translateY(-${translatePct}%)`,
                }}
              >
                {PROMOS.map((src, i) => (
                  <div key={i} className="w-full" style={{ height: `${itemHeightPct}%` }}>
                    <img
                      src={src}
                      width={300}
                      height={300}
                      alt={`Promotion ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
              <div className="relative h-full flex flex-col justify-between p-5 sm:p-6 text-white">
                <div className="space-y-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                  <h3 className="font-extrabold leading-tight tracking-wide text-[17px] sm:text-[18px]">
                    {t("com.ex")}
                    <br />
                  </h3>
                  <div className="text-3xl font-semibold opacity-90 pt-20">8:54</div>
                  <p className="lg:max-w-[40ch] md:max-w-[50ch] sm:max-w-[50ch] text-[11px] sm:text-[12px] lg:text-[15px] md:text-[15px] leading-relaxed opacity-90 pt-4">
                    {t("com.do")}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setPromoIndex((i) => (i + 1) % PROMOS.length)}
                    className="group inline-flex items-center gap-3 text-sm font-semibold"
                    aria-label={t("com.vo") || "Voir une autre promotion"}
                  >
                    <span className="tracking-wide">{t("com.vo")}</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black ring-2 ring-white/70 shadow-sm transition-transform duration-200 group-hover:translate-x-0.5">
                      <FiChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </article>

          {/* ---- CARTE ACHAT ---- */}
          <article className="relative md:self-center" aria-label="Achat produit">
  <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]">
    {/* Glow + ring */}
    <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-[#00A8E8]/10 blur-3xl" />
    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/5" />

    <div className="px-5 sm:px-7 md:px-10 py-7 md:py-9">
      <div
        className="
          grid grid-cols-1
          sm:grid-cols-[220px_minmax(0,1fr)]
          md:grid-cols-[260px_minmax(0,1fr)]
          lg:grid-cols-[320px_minmax(0,1fr)]
          xl:grid-cols-[360px_minmax(0,1fr)]
          2xl:grid-cols-[420px_minmax(0,1fr)]
          gap-7 md:gap-10 items-start
        "
      >
        {/* GAUCHE : image + infos */}
        <div className="flex flex-col">
          <div className="group relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
            <div className="pt-[78%]" />

            <img
              src={imgSrc}
              loading="lazy"
              width={300}
              height={300}
              alt={mini.nom}
              className="
                absolute inset-0 h-full w-full object-contain p-4
                drop-shadow-sm
                transition-transform duration-300
                group-hover:scale-[1.03]
              "
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
              }}
            />

            <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 rounded-2xl" />

            {/* Badge ref */}
            <div className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-black/5 backdrop-blur">
              {t("com.ref")} {mini.ref}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-[18px] md:text-[20px] font-extrabold tracking-tight text-gray-900">
              {mini.nom}
            </h3>
            <p className="mt-1 text-[12px] md:text-[13px] text-gray-500">
              {t("com.ref")} <span className="font-medium text-gray-700">{mini.ref}</span>
            </p>
          </div>
        </div>

        {/* DROITE : titre + bouton + FORM */}
        <div className="relative flex flex-col gap-4 md:gap-5 sm:pl-2 md:pl-4">
          {/* watermark */}
          <img
            src={logo}
            loading="lazy"
            width={300}
            height={300}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="
              pointer-events-none select-none
              absolute right-0 md:right-2 top-3
              w-[240px] sm:w-[300px] md:w-[340px] lg:w-[520px]
              opacity-[0.06]
            "
          />

          <div className="relative z-10">
            <div className="mx-auto w-full max-w-[680px]">
              <h2
                id="achat-produit-titre"
                className="text-center text-[18px] md:text-[22px] font-black tracking-wide text-gray-900"
              >
                {t("com.ach")}
              </h2>

              {/* Subtle divider */}
              <div className="mx-auto mt-3 h-[3px] w-16 rounded-full bg-[#00A8E8]/70" />

              {/* Product name pill */}
              <div className="mt-6">
                <button
                  type="button"
                  aria-disabled="true"
                  tabIndex={-1}
                  className={`
                    w-full sm:max-w-[560px] mx-auto
                    inline-flex items-center justify-center gap-2
                    rounded-2xl border border-[#00A8E8]/25
                    bg-gradient-to-r from-[#00A8E8] to-[#0087c2]
                    px-4 py-3.5
                    text-[15px] font-bold text-white
                    shadow-[0_10px_25px_-15px_rgba(0,168,232,0.9)]
                  `}
                >
                  {t("com.nom")} : <span className="truncate">{mini.nom}</span>
                </button>
              </div>

              {/* ====== FORM ====== */}
              <form className="mt-6" onSubmit={handleSubmit}>
                <div className="grid gap-6 w-full max-w-[680px] mx-auto pb-2">
                  {/* TYPE */}
                  <div>
                    <label htmlFor={typeId} className="block text-sm font-semibold text-gray-800 mb-1.5">
                      {t("com.type")} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id={typeId}
                      value={typeDemande}
                      onChange={(e) => setTypeDemande(e.target.value)}
                      className="
                        w-full rounded-xl border border-gray-300 bg-white
                        px-3.5 py-3 text-sm
                        shadow-sm
                        focus:border-[#00A8E8] focus:ring-4 focus:ring-[#00A8E8]/20
                        outline-none
                      "
                    >
                      <option>{t("com.qo")}</option>
                      <option>{t("com.ac")}</option>
                      <option>{t("com.in")}</option>
                      <option>{t("com.di")}</option>
                    </select>
                  </div>

                  {/* QTE */}
                  <div>
                    <label htmlFor={qteId} className="block text-sm font-semibold text-gray-800 mb-1.5">
                      {t("com.quc")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={qteId}
                      type="number"
                      min={1}
                      placeholder="Ex: 3"
                      value={qte}
                      onChange={(e) => setQte(e.target.value)}
                      className="
                        w-full rounded-xl border border-gray-300 bg-white
                        px-3.5 py-3 text-sm
                        shadow-sm
                        focus:border-[#00A8E8] focus:ring-4 focus:ring-[#00A8E8]/20
                        outline-none
                      "
                      required
                    />
                  </div>

                  {/* NOM */}
                  <div>
                    <label htmlFor={nomId} className="block text-sm font-semibold text-gray-800 mb-1.5">
                      {t("com.np")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={nomId}
                      type="text"
                      placeholder="Ex: Nzogue Rachel"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="
                        w-full rounded-xl border border-gray-300 bg-white
                        px-3.5 py-3 text-sm
                        shadow-sm
                        focus:border-[#00A8E8] focus:ring-4 focus:ring-[#00A8E8]/20
                        outline-none
                      "
                      required
                    />
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label htmlFor={telId} className="block text-sm font-semibold text-gray-800 mb-1.5">
                      {t("com.tel")} <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <div
                        className="
                          flex overflow-hidden rounded-xl border border-gray-300 bg-white
                          shadow-sm
                          focus-within:ring-4 focus-within:ring-[#00A8E8]/20
                          focus-within:border-[#00A8E8]
                        "
                      >
                        <button
                          type="button"
                          onClick={() => setCountryOpen((open) => !open)}
                          className="
                            flex items-center gap-2 px-3.5 py-3 text-sm
                            bg-gray-50 hover:bg-gray-100
                            border-r border-gray-200
                          "
                          aria-haspopup="listbox"
                          aria-expanded={countryOpen}
                          aria-controls="country-listbox"
                        >
                          <ReactCountryFlag
                            svg
                            countryCode={country.code}
                            className="h-4 w-6 rounded-sm shadow-sm"
                          />
                          <span className="font-semibold text-gray-800">{country.dial}</span>
                          <FiChevronDown className="h-3 w-3 text-gray-500" aria-hidden="true" />
                        </button>

                        <input
                          id={telId}
                          type="tel"
                          value={telLocal}
                          onChange={(e) => setTelLocal(e.target.value)}
                          className="flex-1 px-3.5 py-3 text-sm bg-transparent outline-none"
                          placeholder="Ex : 699 99 99 99"
                          required
                        />
                      </div>

                      {countryOpen && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                            <label htmlFor={countrySearchId} className="sr-only">
                              Rechercher un pays
                            </label>
                            <input
                              id={countrySearchId}
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Rechercher un pays"
                              className="w-full text-sm bg-transparent outline-none"
                            />
                          </div>

                          <ul
                            id="country-listbox"
                            className="max-h-64 overflow-y-auto text-sm"
                            role="listbox"
                          >
                            {filteredCountries.map((c) => (
                              <li key={c.code}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCountry(c);
                                    setCountryOpen(false);
                                    setCountrySearch("");
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                                  role="option"
                                  aria-selected={c.code === country.code}
                                >
                                  <ReactCountryFlag
                                    svg
                                    countryCode={c.code}
                                    className="h-4 w-6 rounded-sm shadow-sm"
                                  />
                                  <span className="flex-1 truncate">{c.name}</span>
                                  <span className="text-xs font-medium text-gray-500">{c.dial}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Canal */}
                  <fieldset className="mt-1">
                    <legend className="block text-gray-700 mb-2 text-sm font-semibold">
                      {t("contact.channel.label") || "Canal de contact préféré"}
                    </legend>

                    <div className="flex flex-wrap gap-2" role="radiogroup">
                      {[
                        { key: "whatsapp", label: t("contact.channel.whatsapp") || "WhatsApp" },
                        // { key: "signal", label: t("contact.channel.signal") || "Signal" },
                        { key: "telegram", label: t("contact.channel.telegram") || "Telegram" },
                      ].map((opt) => {
                        const active = canal === (opt.key as CanalContact);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setCanal(opt.key as CanalContact)}
                            className={`
                              px-3.5 py-2 rounded-xl text-xs font-semibold border transition
                              ${active
                                ? "bg-[#00A8E8] text-white border-[#00A8E8] shadow-[0_10px_22px_-18px_rgba(0,168,232,1)]"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              }
                            `}
                            role="radio"
                            aria-checked={active}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Submit */}
                  <div
                    className="pt-2 flex justify-center mt-2"
                    style={{ marginBottom: "env(safe-area-inset-bottom)" }}
                  >
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`${baseBtnClasses} ${channelBtnClasses[canal]}`}
                    >
                      {renderSubmitIcon()}
                      <span>{renderSubmitLabel()}</span>
                    </button>
                  </div>
                </div>
              </form>
              {/* ====== /FORM ====== */}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-3xl bg-gradient-to-t from-black/5 to-transparent" />
  </div>
</article>
        </div>
      </div>
    </section>
  );
};

export default AchatProduit;
