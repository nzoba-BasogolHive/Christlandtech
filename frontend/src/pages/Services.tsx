
import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTopButton from "../components/ScrollToTopButton";

import ServiceIntro from "../components/ServiceIntro";
import ServicesBloc from "../components/ServicesBloc";
import ServicesExtra from "../components/ServicesExtra";
import ContactSection from "../components/ContactSection";


const Services: React.FC = () => {
  React.useEffect(() => {
  
  }, []);

  return (
    <div>
      <Navbar />

      <ServiceIntro />
      <ServicesBloc />
      <ServicesExtra />
      <ContactSection id="contact" />

      <Footer />
      <ScrollToTopButton />
    </div>
  );
};

export default Services;
