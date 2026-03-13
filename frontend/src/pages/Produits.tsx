import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTopButton from "../components/ScrollToTopButton";
import Presentation from "../components/Presentation";
import ContactSection from "../components/ContactSection";
import AchatProduitModal from "../components/AchatProduitModal";
import { useNavigate, useParams } from "react-router-dom";

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

  const [showOrderModal, setShowOrderModal] = React.useState(false);

  const { categorySlug } = useParams();
  const navigate = useNavigate();

  console.log(categorySlug);

  const handleOrder = (p: ProduitMini) => {
    setSelectedProduct(p);

    if (categorySlug && categorySlug !== "tous") {
      navigate(`/produits/${categorySlug}/${p.slug}`);
    } else {
      navigate(`/produit/${p.slug}`);
    }

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