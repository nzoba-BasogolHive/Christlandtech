
import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTopButton from "../components/ScrollToTopButton";

import ServiceIntro from "../components/ServiceIntro";
import ServicesBloc from "../components/ServicesBloc";
import ServicesExtra from "../components/ServicesExtra";
import ContactSection from "../components/ContactSection";

function setMeta(name: string, content: string) {
  let tag = document.querySelector(
    `meta[name="${name}"]`
  ) as HTMLMetaElement | null;

  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }

  tag.content = content;
}

const Services: React.FC = () => {
  React.useEffect(() => {
    document.title = "Nos services – Christland Tech";

    setMeta(
      "description",
      "Services Christland Tech : maintenance informatique, installation de réseaux, configuration, sauvegarde, cybersécurité, conseil et accompagnement pour entreprises et particuliers au Cameroun."
    );
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
