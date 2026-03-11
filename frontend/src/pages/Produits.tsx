import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTopButton from "../components/ScrollToTopButton";
import Presentation from "../components/Presentation";
import ContactSection from "../components/ContactSection";
import AchatProduitModal from "../components/AchatProduitModal";
import { useParams } from "react-router-dom";
export type ProduitMini = {
  id: number;
  slug: string;
  nom: string;
  ref?: string;
  image?: string;
};

const Produits: React.FC = () => {
  const [selectedProduct, setSelectedProduct] =
    React.useState<ProduitMini | null>(null);
  const { categorySlug } = useParams();

  const [showOrderModal, setShowOrderModal] = React.useState(false);

  console.log(categorySlug);
  
  const handleOrder = (p: ProduitMini) => {
    setSelectedProduct(p);
    setShowOrderModal(true);
  };

  const handleCloseOrderModal = () => {
    setShowOrderModal(false);
    setSelectedProduct(null);
  };

  return (
    <>
      <Navbar />
      <main className="pt-1 md:pt-10">
        <Presentation onOrder={handleOrder} />

        {/* ✅ Bloc SEO visible (texte que Google indexe) */}
        {/* <section className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10 mt-6">
          <div className="max-w-4xl">
            <h1 className="text-2xl md:text-3xl font-bold">
              Acheter des ordinateurs et laptops à Yaoundé – Christland Tech
            </h1>

            <p className="mt-4 text-base md:text-lg text-gray-700">
              Découvrez nos produits high-tech au Cameroun : ordinateurs
              portables (laptops), PC de bureau, smartphones, TV, accessoires et
              équipements informatiques. Commandez facilement et profitez de
              prix compétitifs, de produits garantis et d’une livraison rapide à
              Yaoundé, Douala et partout au Cameroun.
            </p>
          </div>
        </section> */}

        {/* ✅ UN SEUL MODAL */}
        {selectedProduct && (
          <AchatProduitModal
            open={showOrderModal}
            produit={selectedProduct}
            onClose={handleCloseOrderModal}
          />
        )}

        <ContactSection id="contact" />
        <ScrollToTopButton />
        <Footer />
      </main>
    </>
  );
};

export default Produits;
