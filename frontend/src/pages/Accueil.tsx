
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

// petit helper local


const Accueil: React.FC = () => {

  return (
    <>
      <Navbar />
<div className="space-y-10 md:space-y-14 lg:space-y-20">
  <section className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10">
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
