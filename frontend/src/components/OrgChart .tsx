import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

type OrgNodeProps = {
  title: string;
  name: string;
  subtitle?: string;
  accent?: "primary" | "success" | "warning";
};

const accentStyles: Record<NonNullable<OrgNodeProps["accent"]>, string> = {
  primary: "border-[#00A9DC] bg-[#EAF8FD] text-[#035D75]",
  success: "border-emerald-500 bg-emerald-50 text-emerald-900",
  warning: "border-amber-500 bg-amber-50 text-amber-900",
};

function OrgNode({ title, name, subtitle, accent = "primary" }: OrgNodeProps) {
  return (
    <div
      className={[
        "w-full max-w-sm rounded-xl border p-4 shadow-sm",
        "backdrop-blur-sm",
        accentStyles[accent],
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {title}
      </p>
      <h3 className="mt-1 text-base md:text-lg font-bold">{name}</h3>
      {subtitle ? (
        <p className="mt-2 text-sm opacity-80 leading-snug">{subtitle}</p>
      ) : null}
    </div>
  );
}

const OrgChart: React.FC = () => {
  const { t } = useTranslation();

  const presidentName = "Mougoue Christian";
  const coPresidentName = "MESSINGA MESSINGA Valère";
  const techLeadName = "Mogou Kamta Hernandez";
  const salesDirectorName = "Marie Dongmo";
  const financeLeadName = t("org.name.placeholder");

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      aria-label={t("org.aria")}
      className="w-full pb-12 md:pb-16"
    >
      <div className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10 pt-10 md:pt-14">
        {/* TITRE */}
        <div className="text-center">
          <h2 className="font-semibold text-md md:text-lg lg:text-xl xl:text-2xl">
            {t("org.title")}
          </h2>
        </div>

        {/* MOBILE */}
        <div className="mt-10 md:hidden space-y-6">
          <OrgNode title={t("org.role.presidentFounder")} name={presidentName} />

          <div className="pl-4 border-l-2 border-[#00A9DC]/40">
            <OrgNode
              title={t("org.role.coPresidentFounder")}
              name={coPresidentName}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* TECH */}
            <div className="pl-4 border-l-2 border-[#00A9DC]/25">
              <OrgNode
                title={t("org.role.techLead")}
                name={techLeadName}
                subtitle={t("org.subtitle.tech.mobile")}
                accent="success"
              />
              <div className="mt-3 pl-4 border-l-2 border-emerald-500/30">
                <OrgNode
                  title={t("org.role.team")}
                  name={t("org.team.technicians")}
                  subtitle={t("org.subtitle.team.tech.mobile")}
                  accent="success"
                />
              </div>
            </div>

            {/* SALES */}
            <div className="pl-4 border-l-2 border-[#00A9DC]/25">
              <OrgNode
                title={t("org.role.salesDirector")}
                name={salesDirectorName}
                subtitle={t("org.subtitle.sales.mobile")}
                accent="warning"
              />
              <div className="mt-3 pl-4 border-l-2 border-amber-500/30">
                <OrgNode
                  title={t("org.role.team")}
                  name={t("org.team.sellers")}
                  subtitle={t("org.subtitle.team.sales.mobile")}
                  accent="warning"
                />
              </div>
            </div>

            {/* FINANCE */}
            <div className="pl-4 border-l-2 border-[#00A9DC]/25">
              <OrgNode
                title={t("org.role.financeLead")}
                name={financeLeadName}
                subtitle={t("org.subtitle.finance.mobile")}
              />
            </div>
          </div>
        </div>

        {/* DESKTOP */}
        <div className="relative mt-12 hidden md:block">
          <div className="relative mx-auto max-w-6xl rounded-2xl border border-[#00A9DC]/15 bg-white/60 p-8 shadow-sm">
            {/* ✅ LIGNES SVG (barre descendue => espace sous Co-président) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1200 720"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <style>
                  {`
                    .l { stroke: rgba(0,169,220,.60); stroke-width: 3; fill: none; }
                    .s { stroke: rgba(0,169,220,.35); stroke-width: 2; fill: none; }
                  `}
                </style>
              </defs>

              {/* Centres colonnes: 200 / 600 / 1000 */}

              {/* Président -> Co-président */}
              <path className="l" d="M600 120 L600 210" />

              {/* ✅ Co-président -> barre (allongé pour créer l'espace) */}
              <path className="l" d="M600 210 L600 340" />

              {/* ✅ Barre horizontale (descendue) */}
              <path className="l" d="M200 340 L1000 340" />

              {/* Descente vers les 3 responsables */}
              <path className="l" d="M200 340 L200 410" />
              <path className="l" d="M600 340 L600 410" />
              <path className="l" d="M1000 340 L1000 410" />

              {/* Vers équipes */}
              <path className="s" d="M200 545 L200 600" />
              <path className="s" d="M600 545 L600 600" />
            </svg>

          {/* Row 1 */}
<div className="flex justify-center">
  <div style={{ width: 520 }}>
    <OrgNode
      title={t("org.role.presidentFounder")}
      name={presidentName}
    />
  </div>
</div>

<div className="h-20" />

{/* Row 2 */}
<div className="flex justify-center">
  <div style={{ width: 520 }}>
    <OrgNode
      title={t("org.role.coPresidentFounder")}
      name={coPresidentName}
    />
  </div>
</div>
            {/* ✅ IMPORTANT : on ne pousse plus “en bas” inutilement */}
            <div className="h-16" />

            {/* Row 3 */}
            <div className="grid grid-cols-3 gap-8 items-start justify-items-center">
              {/* Tech */}
              <div className="space-y-6 w-full">
                <OrgNode
                  title={t("org.role.techLead")}
                  name={techLeadName}
                  subtitle={t("org.subtitle.tech.desktop")}
                  accent="success"
                />
                <div className="pl-6">
                  <OrgNode
                    title={t("org.role.team")}
                    name={t("org.team.technicians")}
                    subtitle={t("org.subtitle.team.tech.desktop")}
                    accent="success"
                  />
                </div>
              </div>

              {/* Commercial */}
              <div className="space-y-6 w-full">
                <OrgNode
                  title={t("org.role.salesDirector")}
                  name={salesDirectorName}
                  subtitle={t("org.subtitle.sales.desktop")}
                  accent="warning"
                />
                <div className="pl-6">
                  <OrgNode
                    title={t("org.role.team")}
                    name={t("org.team.sellers")}
                    subtitle={t("org.subtitle.team.sales.desktop")}
                    accent="warning"
                  />
                </div>
              </div>

              {/* Finance */}
              <div className="space-y-6 w-full">
                <OrgNode
                  title={t("org.role.financeLead")}
                  name={financeLeadName}
                  subtitle={t("org.subtitle.finance.desktop")}
                  accent="primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default OrgChart;