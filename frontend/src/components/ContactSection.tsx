import React, { useMemo, useState } from "react";
import { Mail, Phone, MapPin, User, AtSign, MessageSquare, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { sendContactMessage } from "../hooks/useFetchQuery";
import profil from "../assets/images/logo1.webp";

type ContactSectionProps = { id?: string };

type FieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

const Field: React.FC<FieldProps> = ({ id, label, icon, children }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 mb-1">
        {label}
      </label>

      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
};

const ContactSection: React.FC<ContactSectionProps> = ({ id }) => {
  const { t } = useTranslation();

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const nameId = "contact-name";
  const emailId = "contact-email";
  const phoneId = "contact-phone";
  const subjectId = "contact-subject";
  const messageId = "contact-message";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setErr(null);

    if (!nom.trim() || !email.trim() || !sujet.trim() || !message.trim()) {
      setErr(t("contact.validation.required"));
      return;
    }

    setSubmitting(true);
    try {
      await sendContactMessage({
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim() || undefined,
        sujet: sujet.trim(),
        message: message.trim(),
      });

      setOk(t("contact.success"));
      setNom("");
      setEmail("");
      setTelephone("");
      setSujet("");
      setMessage("");
    } catch (e: any) {
      setErr(e?.message || t("contact.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const containerVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 60 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
    }),
    []
  );

  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white/90 pl-10 pr-3 py-3 text-[14px] text-slate-900 " +
    "placeholder:text-slate-400 shadow-sm outline-none transition " +
    "focus:border-sky-300 focus:ring-4 focus:ring-sky-200/60";

  return (
    <motion.section
      id={id}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      aria-labelledby="contact-section-title"
      className="relative mx-auto my-8 md:my-12 w-full max-w-screen-xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-10"
    >
      <div
        className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-sky-100 ring-1 ring-slate-200/70 shadow-[0_25px_70px_rgba(2,132,199,0.10)]"
      />

      <div className="grid md:grid-cols-2 gap-10 lg:gap-16 p-6 sm:p-8 lg:p-10">
        {/* GAUCHE */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 text-sky-700 px-3 py-1 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {t("contact.badge")}
          </div>

          <h2 id="contact-section-title" className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("form.description")}
          </h2>

          <p className="mt-3 text-slate-600 leading-relaxed max-w-md">
            {t("com.con")}
          </p>

          <div className="mt-6 relative">
            <div className="absolute inset-0 -z-10 blur-2xl rounded-full bg-sky-200/60" />
            <img
              src={profil}
              width={300}
              height={300}
              alt="Christland Tech"
              loading="lazy"
              className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-lg"
            />
          </div>

          <div className="mt-6 w-full max-w-md space-y-3">
            <a
              href="mailto:info@christland.tech"
              className="group flex items-center gap-3 rounded-2xl bg-white/70 border border-slate-200 px-4 py-3 hover:bg-white transition"
            >
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                <Mail size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{t("contact.info.email")}</div>
                <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                  info@christland.tech
                </div>
              </div>
            </a>

            <a
              href="tel:+237691554641"
              className="group flex items-center gap-3 rounded-2xl bg-white/70 border border-slate-200 px-4 py-3 hover:bg-white transition"
            >
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                <Phone size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{t("contact.info.phone")}</div>
                <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                  +237 691 554 641
                </div>
              </div>
            </a>

            <a
              href="tel:+237676089671"
              className="group flex items-center gap-3 rounded-2xl bg-white/70 border border-slate-200 px-4 py-3 hover:bg-white transition"
            >
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                <Phone size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{t("contact.info.phone")}</div>
                <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                  +237 676 089 671
                </div>
              </div>
            </a>

            <div className="flex items-center gap-3 rounded-2xl bg-white/70 border border-slate-200 px-4 py-3">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                <MapPin size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{t("contact.info.location")}</div>
                <div className="text-sm font-semibold text-slate-900">
                  {t("contact.info.location.value")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DROITE */}
        <div className="rounded-3xl bg-white/80 border border-slate-200 shadow-sm p-5 sm:p-6 lg:p-8">
          {ok && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 text-sm" role="status" aria-live="polite">
              {ok}
            </div>
          )}
          {err && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-red-800 text-sm" role="alert">
              {err}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <Field id={nameId} label={t("name.input")} icon={<User size={18} />}>
              <input
                id={nameId}
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className={inputBase}
                autoComplete="name"
                placeholder={t("contact.placeholder.name")}
              />
            </Field>

            <Field id={emailId} label={t("email.input")} icon={<AtSign size={18} />}>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
                autoComplete="email"
                placeholder={t("contact.placeholder.email")}
              />
            </Field>

            <Field id={phoneId} label={t("phone.input")} icon={<Phone size={18} />}>
              <input
                id={phoneId}
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className={inputBase}
                autoComplete="tel"
                placeholder={t("contact.placeholder.phone")}
              />
            </Field>

            <Field id={subjectId} label={t("subject.input")} icon={<PenLine size={18} />}>
              <input
                id={subjectId}
                type="text"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                className={inputBase}
                placeholder={t("contact.placeholder.subject")}
              />
            </Field>

            <div>
              <label htmlFor={messageId} className="block text-[13px] font-medium text-slate-700 mb-1">
                {t("message.input")}
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-4 text-slate-400">
                  <MessageSquare size={18} />
                </div>

                <textarea
                  id={messageId}
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={
                    "w-full rounded-xl border border-slate-200 bg-white/90 pl-10 pr-3 py-3 text-[14px] text-slate-900 " +
                    "placeholder:text-slate-400 shadow-sm outline-none transition resize-none min-h-[190px] " +
                    "focus:border-sky-300 focus:ring-4 focus:ring-sky-200/60"
                  }
                  placeholder={t("contact.placeholder.message")}
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="
                  inline-flex items-center justify-center rounded-xl px-6 py-3
                  bg-sky-600 text-white font-semibold
                  shadow-[0_12px_30px_rgba(2,132,199,0.25)]
                  hover:bg-sky-700 transition
                  disabled:opacity-60 disabled:cursor-not-allowed
                  w-full sm:w-auto
                "
              >
                {submitting ? t("form.sending") : t("form.button")}
              </button>

              <div className="hidden sm:block text-xs text-slate-500">
                {t("contact.fastReply")}
              </div>
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  );
};

export default ContactSection;