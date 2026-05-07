import React, { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { useTranslation } from "react-i18next";

// ✅ Slide 1 — Desk
import heroDeskLg from "../assets/images/Plan de travail 8001_4500...jpg";
import heroDeskMd from "../assets/images/Plan de travail 2048_1536..jpg";
import heroDeskMobile from "../assets/images/slide_1_services.jpg";

// ✅ Slide 2 — IT
import heroItLg from "../assets/images/Plan de travail 8001_4500.jpg";
import heroItMd from "../assets/images/Plan de travail 2048_1536...jpg";
import heroItMobile from "../assets/images/slide_3_tech.jpg";

// ✅ Slide 3 — Tech
import heroTechLg from "../assets/images/Plan de travail 8001_4500..jpg";
import heroTechMd from "../assets/images/Plan de travail 2048_1536.jpg";
import heroTechMobile from "../assets/images/slide_2_produits.jpg";

type SlideConfig = {
  title: string;
  description: string;
  image: string;
  tabletImage: string;
  mobileImage: string;
  titleClass?: string;
  descClass?: string;
  position?: React.CSSProperties["objectPosition"];
};

const SLIDER_ID = "hero-main-carousel";

const slides: SlideConfig[] = [
  {
    image: heroDeskLg,
    tabletImage: heroDeskMd,
    mobileImage: heroDeskMobile,
    title: "hero.slides.it.title",
    description: "hero.slides.it.desc",
    titleClass: "text-white",
    descClass: "text-white/90",
    position: "50% 50%",
  },
  {
    image: heroItLg,
    tabletImage: heroItMd,
    mobileImage: heroItMobile,
    title: "hero.slides.desk.title",
    description: "hero.slides.desk.desc",
    titleClass: "text-white",
    descClass: "text-white/90",
    position: "50% 50%",
  },
  {
    image: heroTechLg,
    tabletImage: heroTechMd,
    mobileImage: heroTechMobile,
    title: "hero.slides.tech.title",
    description: "hero.slides.tech.desc",
    titleClass: "text-white",
    descClass: "text-white/90",
    position: "50% 50%",
  },
];

const HeroCarousel: React.FC = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [currentSlide, setCurrentSlide] = useState(0);
  const { t } = useTranslation();

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
  });

  useEffect(() => {
    if (!isInView || !instanceRef.current) return;

    const slider = instanceRef.current;
    const interval = setInterval(() => slider.next(), 5000);

    return () => clearInterval(interval);
  }, [instanceRef, isInView]);

  return (
    <section
      ref={containerRef}
      aria-label="Carrousel principal"
      aria-roledescription="carrousel"
      className="w-screen max-w-none relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
    >
      <div className="relative w-screen max-w-none overflow-hidden">
        <div
          ref={sliderRef}
          id={SLIDER_ID}
          className="keen-slider"
          aria-live="polite"
        >
          {slides.map((slide, index) => {
            const isFirst = index === 0;

            return (
              <div
                key={index}
                className="keen-slider__slide relative"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${slides.length}`}
              >
                <picture>
                  <source
                    media="(max-width: 767px)"
                    srcSet={slide.mobileImage}
                  />

                  <source
                    media="(min-width: 768px) and (max-width: 1023px)"
                    srcSet={slide.tabletImage}
                  />

                  <source
                    media="(min-width: 1024px)"
                    srcSet={slide.image}
                  />

                  <img
                    src={slide.image}
                    alt=""
                    width={1920}
                    height={1080}
                    loading={isFirst ? "eager" : "lazy"}
                    fetchPriority={isFirst ? "high" : "auto"}
                    decoding="async"
                    style={{
                      objectPosition: slide.position ?? "50% 50%",
                    }}
                    className="
                      w-screen max-w-none
                      h-[70vh] sm:h-[75vh] lg:h-[calc(100vh-140px)]
                      object-cover
                    "
                  />
                </picture>

                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 sm:px-8 md:px-12">
                  <motion.h2
                    initial={{ opacity: 0, y: 24 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7, delay: 0.15 }}
                    className={`
                      font-extrabold leading-[1.08]
                      text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl
                      max-w-[18ch] sm:max-w-3xl lg:max-w-5xl
                      ${slide.titleClass ?? "text-white"}
                    `}
                  >
                    {t(slide.title)}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 24 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className={`
                      font-semibold
                      mt-3 sm:mt-4 md:mt-6
                      text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl
                      max-w-[28ch] sm:max-w-xl md:max-w-2xl lg:max-w-3xl
                      ${slide.descClass ?? "text-white/90"}
                    `}
                  >
                    {t(slide.description)}
                  </motion.p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2"
          role="tablist"
        >
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => instanceRef.current?.moveToIdx(idx)}
              aria-label={`Aller au slide ${idx + 1}`}
              role="tab"
              aria-selected={idx === currentSlide}
              aria-controls={SLIDER_ID}
              className={`w-2.5 h-2.5 rounded-full ${
                idx === currentSlide ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;