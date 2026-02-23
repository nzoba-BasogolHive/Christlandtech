import React from "react";
import { useBlogPosts, media } from "../hooks/useFetchQuery";
import { motion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";
import { useTranslation } from "react-i18next";

type Post = {
  id: number | string;
  image: string;
  title: string;
  excerpt: string;
};

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='16'%3EImage%20indisponible%3C/text%3E%3C/svg%3E";

const TWEEN_SLOW: Transition = {
  type: "tween",
  duration: 0.7,
  ease: [0.22, 1, 0.36, 1],
};

const pageEnter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: TWEEN_SLOW },
};

const listStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const cardFadeUpOnView: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const CardTop: React.FC<{ post: Post }> = ({ post }) => {
  const imgSrc = post.image || FALLBACK_IMG;

  return (
    <motion.article
      variants={cardFadeUpOnView}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="
        group relative overflow-hidden rounded-2xl
        border border-black/5 bg-white
        shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]
        transition
        hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-22px_rgba(0,0,0,0.45)]
      "
    >
      <div className="flex flex-col md:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
        {/* Image */}
        <div
          className="
            relative w-full aspect-[16/9]
            md:w-[240px] md:min-w-[240px] md:h-[155px] md:aspect-auto
            lg:w-[280px] lg:min-w-[280px] lg:h-[175px]
            overflow-hidden rounded-2xl
            ring-1 ring-black/5
          "
          role="img"
          aria-label={post.title}
          title={post.title}
        >
          <img
            width={600}
            height={400}
            src={imgSrc}
            alt={post.title}
            className="
              absolute inset-0 h-full w-full object-cover
              transition-transform duration-700 will-change-transform
              group-hover:scale-[1.08]
            "
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
        </div>

        {/* Texte */}
        <div className="flex-1 min-w-0">
          <h3
            className="
              font-semibold text-gray-900 leading-snug
              text-[clamp(13px,2.2vw,16px)]
              tracking-wide
              line-clamp-2
            "
          >
            {post.title}
          </h3>

          <p
            className="
              mt-2 text-gray-600 leading-6
              text-[clamp(12.5px,2vw,14.5px)]
              line-clamp-4
            "
          >
            {post.excerpt}
          </p>
        </div>
      </div>
    </motion.article>
  );
};

const CardBottom: React.FC<{ post: Post }> = ({ post }) => {
  const imgSrc = post.image || FALLBACK_IMG;

  return (
    <motion.article
      variants={cardFadeUpOnView}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="
        group relative overflow-hidden rounded-2xl
        border border-black/5 bg-white
        shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]
        transition
        hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-22px_rgba(0,0,0,0.45)]
      "
    >
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
        <div
          className="
            relative w-full aspect-[16/9]
            lg:w-[280px] lg:min-w-[280px] lg:h-[175px] lg:aspect-auto
            overflow-hidden rounded-2xl
            ring-1 ring-black/5
          "
          role="img"
          aria-label={post.title}
          title={post.title}
        >
          <img
            width={600}
            height={400}
            src={imgSrc}
            alt={post.title}
            className="
              absolute inset-0 h-full w-full object-cover
              transition-transform duration-700 will-change-transform
              group-hover:scale-[1.08]
            "
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="
              font-semibold text-gray-900 leading-snug
              text-[clamp(13px,2vw,15px)]
              tracking-wide
              line-clamp-2
            "
          >
            {post.title}
          </h3>
          <p
            className="
              mt-2 text-gray-600 leading-6
              text-[clamp(12.5px,2vw,14px)]
              line-clamp-3
            "
          >
            {post.excerpt}
          </p>
        </div>
      </div>
    </motion.article>
  );
};

const PostsSection: React.FC = () => {
  const { t } = useTranslation(); // ✅ ICI (obligatoire)
  const { data } = useBlogPosts();

  const postsTop: Post[] = React.useMemo(() => {
    const items = data?.top ?? [];
    return items.map((a: any) => {
      const rawImage = a.image || a.image_couverture || "";
      const img = rawImage ? media(rawImage) : "";
      const title = a.excerpt || a.extrait || "";
      const body = a.content || a.contenu || "";

      return {
        id: a.id,
        image: img || FALLBACK_IMG,
        title,
        excerpt: body,
      };
    });
  }, [data?.top]);

  const postsBottom: Post[] = React.useMemo(() => {
    const items = data?.bottom ?? [];
    return items.map((a: any) => {
      const rawImage = a.image || a.image_couverture || "";
      const img = rawImage ? media(rawImage) : "";
      const title = a.excerpt || a.extrait || "";
      const body = a.content || a.contenu || "";

      return {
        id: a.id,
        image: img || FALLBACK_IMG,
        title,
        excerpt: body,
      };
    });
  }, [data?.bottom]);

  if (!postsTop.length && !postsBottom.length) return null;

  return (
    <motion.section
      className="mx-auto w-full max-w-screen-2xl px-6 sm:px-8 lg:px-10 -mt-14"
      variants={pageEnter}
      initial="hidden"
      animate="show"
    >
      <div className="rounded-2xl bg-white/60 backdrop-blur border border-black/5 p-4 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm lg:text-lg md:text-md text-gray-500">
              {t("blog.subtitle")}
            </p>

            <h2
              className="
                mt-1 font-semibold tracking-wider text-[#0086c9] uppercase
                text-[clamp(13px,2.2vw,22px)]
              "
            >
              {t("blog.title")}
            </h2>
          </div>
        </div>

        {/* 4 du haut */}
        <motion.div
          variants={listStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mt-5 space-y-6">
            {postsTop.map((post) => (
              <CardTop key={post.id} post={post} />
            ))}
          </div>

          {/* 2 du bas */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {postsBottom.map((post) => (
              <CardBottom key={post.id} post={post} />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default PostsSection;