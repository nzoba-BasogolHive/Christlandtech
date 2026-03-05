import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTopButton from "../components/ScrollToTopButton";

import Sponsor from "../components/Sponsor";
import HeroCarousel from "../components/HeroCarousel";
import ContactSection from "../components/ContactSection";
import ServiceSection from "../components/ServiceSection";
import CategoriesCarousel from "../components/CategoriesCarousel";
import Nouveautes from "../components/Nouveautes";

const Accueil: React.FC = () => {
  return (
    <>
      <Navbar />

      <div className="space-y-10 md:space-y-14 lg:space-y-20">
        <section className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10">
          {/* ✅ SEO H1 + texte (visible mais discret) */}
          <header className="mb-4">
            <h1 className="text-lg font-semibold leading-tight sm:text-xl">
              Vente d&apos;ordinateurs et laptops à Yaoundé et partout au Cameroun
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Vous cherchez où acheter un laptop à Yaoundé ? Christland Tech est spécialisé dans la vente
              d&apos;ordinateurs portables, PC de bureau et accessoires informatiques, avec livraison partout au Cameroun.
            </p>
          </header>

          <HeroCarousel />
        </section>

        <section className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10">
          <CategoriesCarousel />
        </section>
      </div>

      <Sponsor />
      <Nouveautes />
      <ServiceSection />
      <ContactSection id="contact" />

      <ScrollToTopButton />
      <Footer />
    </>
  );
};

export default Accueil;