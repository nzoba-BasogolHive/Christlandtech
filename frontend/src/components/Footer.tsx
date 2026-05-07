import React, { useEffect, useState } from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaXTwitter,
  FaPhone,
  FaEnvelope,
  FaWhatsapp,
} from "react-icons/fa6";
import logo from "../assets/images/logo.webp";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [openPdf, setOpenPdf] = useState(false);
  const currentYear = new Date().getFullYear()
  const footerLinks: { key: string; to: string }[] = [
    { key: "Accueil", to: "/" },
    { key: "A propos", to: "/a-propos" },
    { key: "Produits", to: "/produits" },
    { key: "Services", to: "/services" },
    { key: "Assistance", to: "/assistance" },
  ];

  const whatsappLink = "https://chat.whatsapp.com/Ciwi9gaLI7f7PfgZbggAXD?mode=git";
  const privacyPdfHref = `${import.meta.env.BASE_URL}docs/Politique_confidentialité.pdf`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (openPdf) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openPdf]);

  return (
    <>
      <footer className="bg-[#090808] text-white pt-8 pb-6">
        <div className="mx-auto w-full max-w-screen-2xl px-6 sm:px-10 lg:px-16">
          {/* Top */}
          <div className="flex items-start gap-6">
            <Link
              to="/"
              className="flex items-center gap-4 min-w-0  shrink-0"
              aria-label={t("Accueil")}
            >
              <div className="h-10 md:h-14 w-10 md:w-14 rounded-full bg-white/10 ring-1 ring-white/10 overflow-hidden">
                <img
                  src={logo}
                  width={300}
                  height={300}
                  alt="CHRISTLAND TECH"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

              <div className="leading-5 whitespace-nowrap">
                <span className="font-semibold tracking-wide text-[13px] sm:text-sm md:text-lg lg:text-xl">
                  CHRISTLAND
                </span>{" "}
                <span className="font-extrabold text-[#00A8E8] text-[13px] sm:text-sm md:text-lg lg:text-xl">
                  TECH
                </span>
              </div>
            </Link>

            <nav
              className="ml-auto flex items-center gap-5 text-white text-lg lg:text-xl mt-2"
              aria-label={t("Réseaux sociaux") || "Social links"}
            >
              <a
                href="#"
                aria-label="X"
                className="hover:text-[#00A9DC] transition-colors"
              >
                <FaXTwitter />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="hover:text-[#00A9DC] transition-colors"
              >
                <FaLinkedinIn />
              </a>
              <a
                href="https://web.facebook.com/profile.php?id=61566481138265"
                aria-label="Facebook"
                className="hover:text-[#00A9DC] transition-colors"
              >
                <FaFacebookF />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="hover:text-[#00A9DC] transition-colors"
              >
                <FaInstagram />
              </a>
              <a
                href="#"
                aria-label="YouTube"
                className="hover:text-[#00A9DC] transition-colors"
              >
                <FaYoutube />
              </a>
            </nav>
          </div>

          {/* Contenu */}
          {/* ✅ swap violet(links) <-> vert(contact) : on met CONTACT en 2e colonne, LIENS en 4e colonne */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* 1) Siège */}
            <div>
              <h2 className="font-semibold text-white text-lg lg:text-xl mb-2">
                {t("siege")}
              </h2>
              <p className="text-sm lg:text-base text-white/85">
                Cameroun, Yaoundé
              </p>
              <p className="text-sm lg:text-base text-white/85">
                Monté Jouvence
              </p>
            </div>

            {/* 2) ✅ Contact (était en 4e) */}
            <div className="md:justify-self-center">
              <p className="font-semibold text-white mb-2 lg:text-lg">
                {t("footer.questions.title")}
              </p>

              <div className="text-sm lg:text-base text-white/85 space-y-2">
                <a
                  href="mailto:info@christland.tech"
                  className="hover:underline inline-flex items-center gap-2"
                >
                  <FaEnvelope /> info@christland.tech
                </a>

                <div className="flex flex-wrap items-center gap-2">
                  <FaPhone />
                  <a href="tel:+237691554641" className="hover:underline">
                    +237 691554641
                  </a>
                  <span className="text-white/40">/</span>
                  <a href="tel:+237676089671" className="hover:underline">
                    676089671
                  </a>
                </div>

                <div className="pt-2 flex flex-col items-start gap-1">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-white/10 hover:bg-white/15 transition px-4 py-2 text-sm lg:text-base"
                    aria-label="WhatsApp"
                  >
                    <FaWhatsapp className="text-[#25D366]" />
                    WhatsApp
                  </a>

                  <span className="text-xs lg:text-sm text-white/60">
                    {t("footer.whatsapp.join")}
                  </span>
                </div>
              </div>
            </div>

            {/* 3) Support */}
            <div className="text-sm lg:text-base text-white/80 md:justify-self-center">
              <p className="font-semibold text-white mb-2 lg:text-lg">
                {t("footer.support.title")}
              </p>
              <p>{t("footer.support.line1")}</p>
              <p>{t("footer.support.line2")}</p>
              <p>{t("footer.support.line3")}</p>
            </div>

            {/* 4) ✅ Liens (était en 2e) */}
            <nav className="space-y-2 md:justify-self-end" aria-label="Liens">
              {footerLinks.map((link) => (
                <Link
                  key={link.key}
                  to={link.to}
                  className="block text-sm lg:text-base text-white/85 hover:text-[#00A9DC] transition-colors"
                >
                  {t(link.key)}
                </Link>
              ))}
            </nav>
          </div>

          {/* ✅ Légal : JAUNE en haut, ROUGE en dessous */}
          <div className="mt-10 border-t border-white/10 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))]">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              {/* Colonne gauche : 2 lignes */}
              <div className="text-sm lg:text-base text-white/80">
                {/* Ligne 1 (JAUNE) */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <span>{t("footer.legal.title")}</span>

                  <button
                    type="button"
                    onClick={() => setOpenPdf(true)}
                    className="hover:text-[#00A9DC] transition-colors underline underline-offset-4"
                  >
                    {t("footer.legal.privacy")}
                  </button>
                </div>

                {/* Ligne 2 (ROUGE) — en dessous */}
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                  <span>{t("footer.legal.shipping")}</span>
                  <span>{t("footer.copyright", { year: currentYear })}</span>
                </div>   
              </div>

              {/* Droite : Développé par Basogol-Hive (seul, bien visible) */}
              {/* <a
                href="https://basogolhive.com"
                target="_blank"
                rel="noreferrer"
                className="text-sm lg:text-base text-white/80 hover:text-[#00A9DC] transition-colors underline underline-offset-4"
              >
                {t("footer.dev")}
              </a> */}
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL PDF */}
      {openPdf && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenPdf(false)}
        >
          <div
            className="w-full max-w-5xl h-[85vh] rounded-2xl bg-neutral-950 border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm sm:text-base font-semibold">
                {t("footer.privacy.modalTitle")}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={privacyPdfHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white hover:bg-[#00A8E8] transition"
                >
                  {t("footer.privacy.fullscreen")}
                </a>

                <button
                  type="button"
                  onClick={() => setOpenPdf(false)}
                  className="text-sm px-3 py-1.5 rounded-md bg-white hover:bg-[#00A8E8] transition"
                >
                  {t("footer.privacy.close")}
                </button>
              </div>
            </div>

            <iframe
              src={privacyPdfHref}
              title="Politique de confidentialité PDF"
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;