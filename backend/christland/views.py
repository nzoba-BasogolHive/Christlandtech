
from decimal import Decimal
from typing import Iterable
from rest_framework import status, generics
from django.db.models import Q, Min, Max
from django.db.models.functions import Coalesce  # ✅ pour annoter min/max prix
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.db.models import QuerySet
from django.http import JsonResponse
from django.core.mail import EmailMessage
from django.utils import timezone
from datetime import datetime, time
from django.utils.decorators import method_decorator
from django.views.decorators.vary import vary_on_headers
from django.core.cache import cache
import logging
logger = logging.getLogger(__name__)
from decimal import Decimal, InvalidOperation
from rest_framework.permissions import BasePermission
# import requests
from django.http import JsonResponse
from django.core.cache import cache
from datetime import datetime
from django.utils import timezone
from urllib.parse import urlparse
from django.conf import settings
from christland.models import TextTranslation
from .models import (
    Categories, Produits, VariantesProduits, ImagesProduits,
    Marques, Couleurs, CategorieAttribut,
    Attribut, ValeurAttribut, SpecProduit, SpecVariante, ArticlesBlog, MessagesContact, Produits, VariantesProduits, Categories, Marques, 
    Couleurs, ArticlesBlog,Utilisateurs,DashboardActionLog,

)
from django.core.cache import cache
from django.contrib.contenttypes.models import ContentType
from django.utils.cache import _generate_cache_key  # optionnel
from django.views.decorators.vary import vary_on_headers
from django.utils.decorators import method_decorator
from christland.services.i18n_translate import translate_field_for_instance
from rest_framework.permissions import AllowAny, IsAuthenticated
from .auth_jwt import JWTAuthentication, make_access_token, make_refresh_token, decode_jwt_raw
# import jwt
from django.db.models import Sum
from django.utils.text import slugify
from christland.services.text_translate import translate_text
from .serializers import (
    ProduitCardSerializer,
    ProduitsSerializer,
    ArticleDashboardSerializer,
    ArticleEditSerializer,
    ArticleCreateSerializer,
    CategorieMiniSerializer,
    CouleurMiniSerializer,
    CategoryDashboardSerializer,
     _etat_label, 
     get_request_lang,
)
from rest_framework.pagination import PageNumberPagination
from django.core.mail import send_mail
import json
from django.views.decorators.csrf import csrf_exempt
from django.utils.text import slugify
from django.db import transaction
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.core.files.storage import default_storage
from rest_framework.parsers import MultiPartParser, FormParser
import os, uuid
from django.db import IntegrityError, transaction
from django.db.models import F
from rest_framework import status, permissions
from django.contrib.auth.hashers import check_password, make_password



def _children_qs(cat: Categories):
    """
    Retourne les enfants d'une catégorie en utilisant le bon related_name.
    Ici: related_name='enfants'
    """
    rel = getattr(cat, "enfants", None)
    if rel is not None:
        return rel.all()
    # fallback ultra sûr
    return Categories.objects.filter(parent=cat)

def _to_bool(raw, default=False):
    """
    Convertit proprement une valeur venant du front en booléen.
    Accepte: True/False, 1/0, "true"/"false", "1"/"0", "on"/"off", "yes"/"no"
    """
    if raw is None:
        return default

    if isinstance(raw, bool):
        return raw

    if isinstance(raw, (int, float)):
        return bool(raw)

    s = str(raw).strip().lower()

    if s in ("1", "true", "yes", "y", "on"):
        return True
    if s in ("0", "false", "no", "n", "off", ""):
        return False

    return default



def _as_int(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return None

def _product_min_price(prod: Produits) -> Decimal | None:
    prices = []
    for v in prod.variantes.all():
        prix = v.prix_actuel()
        if prix is not None:
            prices.append(prix)
    return min(prices) if prices else None

def _descendants_ids(cat: Categories) -> list[int]:
    todo = [cat]
    ids = []
    while todo:
        c = todo.pop()
        ids.append(c.id)
        todo.extend(list(_children_qs(c)))
    return ids

def _product_main_image_url(request, prod: Produits) -> str | None:
    img = prod.images.filter(principale=True).first() or prod.images.order_by("position", "id").first()
    return _abs_media(request, img.url if img else None)



def _image_accessor_name() -> str:
    """
    Retourne le nom du related name pour les images produit (ex: 'images', 'imagesproduits_set', etc.).
    On autodétecte le backward accessor vers ImagesProduits.
    """
    for f in Produits._meta.get_fields():
        if getattr(f, "is_relation", False) and getattr(f, "auto_created", False) and getattr(f, "one_to_many", False):
            if getattr(f, "related_model", None) and f.related_model is ImagesProduits:
                return f.get_accessor_name()
    # fallback le plus courant
    return "images"


def _apply_faceted_filters(qs, params, cate_ids: Iterable[int]):
    # 1) marque
    brand = params.get("brand")
    if brand:
        slugs = [s.strip() for s in brand.split(",") if s.strip()]
        qs = qs.filter(marque__slug__in=slugs)

    # 0) état produit
    etat = params.get("etat")
    if etat:
        etats = [s.strip() for s in etat.split(",") if s.strip()]
        qs = qs.filter(etat__in=etats)

    # 2) couleur
    color = params.get("color")
    if color:
        cs = [s.strip() for s in color.split(",") if s.strip()]
        qs = qs.filter(variantes__couleur__slug__in=cs)

    # 3) prix
    pmin = params.get("price_min")
    pmax = params.get("price_max")
    if pmin:
        try:
            val = Decimal(pmin)
            qs = qs.filter(Q(variantes__prix_promo__gte=val) | Q(variantes__prix__gte=val))
        except Exception:
            pass
    if pmax:
        try:
            val = Decimal(pmax)
            qs = qs.filter(Q(variantes__prix_promo__lte=val) | Q(variantes__prix__lte=val))
        except Exception:
            pass

    # 4) attributs dynamiques attr_<code>
    for key, val in params.items():
        if not key.startswith("attr_") or key.endswith("_min") or key.endswith("_max"):
            continue
        code = key[5:]
        values = [v.strip() for v in val.split(",") if v.strip()]
        try:
            attr = Attribut.objects.get(code=code, actif=True)
        except Attribut.DoesNotExist:
            continue

        q_attr = Q(specs__attribut=attr) | Q(variantes__specs__attribut=attr)

        if attr.type == Attribut.CHOIX:
            qs = qs.filter(
                q_attr & (
                    Q(specs__valeur_choice__slug__in=values) |
                    Q(variantes__specs__valeur_choice__slug__in=values)
                )
            )
        elif attr.type == Attribut.TEXTE:
            regex = "|".join(values)
            qs = qs.filter(
                q_attr & (
                    Q(specs__valeur_text__iregex=regex) |
                    Q(variantes__specs__valeur_text__iregex=regex)
                )
            )
        else:
            q_num = Q()
            nums = []
            for v in values:
                try:
                    nums.append(Decimal(v))
                except Exception:
                    pass
            if nums:
                q_num |= Q(specs__valeur_int__in=nums) | Q(variantes__specs__valeur_int__in=nums)
                q_num |= Q(specs__valeur_dec__in=nums) | Q(variantes__specs__valeur_dec__in=nums)

            vmin = params.get(f"attr_{code}_min")
            vmax = params.get(f"attr_{code}_max")
            if vmin:
                try:
                    dv = Decimal(vmin)
                    q_num &= (
                        Q(specs__valeur_int__gte=dv) | Q(variantes__specs__valeur_int__gte=dv) |
                        Q(specs__valeur_dec__gte=dv) | Q(variantes__specs__valeur_dec__gte=dv)
                    )
                except Exception:
                    pass
            if vmax:
                try:
                    dv = Decimal(vmax)
                    q_num &= (
                        Q(specs__valeur_int__lte=dv) | Q(variantes__specs__valeur_int__lte=dv) |
                        Q(specs__valeur_dec__lte=dv) | Q(variantes__specs__valeur_dec__lte=dv)
                    )
                except Exception:
                    pass

            if q_num:
                qs = qs.filter(q_attr & q_num)

    return qs.distinct()



def _soft_delete(obj, user=None):
    obj.is_deleted = True
    obj.deleted_at = timezone.now()
    if hasattr(obj, "deleted_by_id"):
        obj.deleted_by = user
    obj.save(update_fields=["is_deleted", "deleted_at", "deleted_by"] if hasattr(obj, "deleted_by_id") else ["is_deleted", "deleted_at"])

def _soft_restore(obj):
    obj.is_deleted = False
    obj.deleted_at = None
    if hasattr(obj, "deleted_by_id"):
        obj.deleted_by = None
    obj.save(update_fields=["is_deleted", "deleted_at", "deleted_by"] if hasattr(obj, "deleted_by_id") else ["is_deleted", "deleted_at"])

def _get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")

def log_dashboard_action(request, obj, action: str, before=None, after=None):
    try:
        ct = ContentType.objects.get_for_model(obj.__class__)

        user = getattr(request, "user", None)
        # ✅ compatible avec User Django OU ton modèle custom
        actor = user if user and getattr(user, "id", None) else None

        DashboardActionLog.objects.create(
            actor=actor,
            action=action,
            content_type=ct,
            object_id=str(obj.pk),
            before=before,
            after=after,
            ip=_get_client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:1000],
        )
    except Exception as e:
        logger.exception("DashboardActionLog failed: %s", e)


class SmallPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 100


# -----------------------------
# 1) Liste produits (query params)
# -----------------------------

from rest_framework.response import Response

class CategoryProductList(generics.ListAPIView):
    serializer_class = ProduitCardSerializer
    pagination_class = SmallPagination

    def get_queryset(self):
        cat_slug = (self.request.query_params.get("category") or "tous").strip().lower()
        sub_slug = (self.request.query_params.get("subcategory") or "").strip().lower()

        if sub_slug:
            sub = get_object_or_404(Categories, slug=sub_slug, est_actif=True, is_deleted=False)
            cat_ids = [sub.id]
        elif cat_slug and cat_slug != "tous":
            cat = get_object_or_404(Categories, slug=cat_slug, est_actif=True, is_deleted=False)
            cat_ids = _descendants_ids(cat)
        else:
            cat_ids = list(
                Categories.objects.filter(est_actif=True, is_deleted=False).values_list("id", flat=True)
            )

        qs = (
            Produits.objects
            .filter(est_actif=True, visible=1, is_deleted=False, categorie_id__in=cat_ids)
            .select_related("categorie", "marque")
            .prefetch_related("images", "variantes")
            .distinct()
        )

        qs = _apply_faceted_filters(qs, self.request.query_params, cat_ids)

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            lang = get_request_lang(self.request)

            terms = [t.strip() for t in q.split() if t.strip()]
            base_q = Q()
            if terms:
                for term in terms:
                    base_q &= (
                        Q(nom__icontains=term) |
                        Q(slug__icontains=term) |
                        Q(description_courte__icontains=term) |
                        Q(description_long__icontains=term) |
                        Q(marque__nom__icontains=term) |
                        Q(categorie__nom__icontains=term)
                    )

            ids_match: set[int] = set()
            if base_q:
                ids_match |= set(qs.filter(base_q).values_list("id", flat=True))

            if lang != "fr":
                translated_sources = (
                    TextTranslation.objects.filter(
                        source_lang="fr",
                        target_lang=lang,
                        translated_text__icontains=q,
                    )
                    .values_list("source_text", flat=True)
                )
                source_texts = list(set(translated_sources))
                if source_texts:
                    ids_match |= set(
                        qs.filter(nom__in=source_texts).values_list("id", flat=True)
                    )

            if ids_match:
                qs = qs.filter(id__in=ids_match).distinct()
            else:
                qs = qs.none()

        sort = self.request.query_params.get("sort")
        if sort in ("price_asc", "price_desc"):
            qs = qs.annotate(
                _min_price_tmp=Coalesce(
                    Min("variantes__prix_promo"),
                    Min("variantes__prix"),
                )
            )
            qs = qs.order_by(
                "_min_price_tmp" if sort == "price_asc" else "-_min_price_tmp",
                "-id",
            )
        elif sort == "new":
            qs = qs.order_by("-cree_le", "-id")
        else:
            qs = qs.order_by("-id")

        return qs

    @method_decorator(vary_on_headers("Accept-Language", "X-Lang"))
    def list(self, request, *args, **kwargs):
        lang = (
            request.query_params.get("lang")
            or request.headers.get("X-Lang")
            or request.headers.get("Accept-Language", "fr")
        )
        lang = (lang or "fr").split(",")[0].split("-")[0]

        # ✅ clé de cache DÉFINIE AVANT utilisation
        cache_key = f"products_v2:{lang}:{request.get_full_path()}"

        cached = cache.get(cache_key)
        if cached is not None:
            logger.info("CategoryProductList CACHE HIT %s", cache_key)
            return Response(cached)

        logger.info("CategoryProductList CACHE MISS %s", cache_key)

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
        else:
            serializer = self.get_serializer(queryset, many=True)
            response = Response(serializer.data)

        # ⏱️ 60 secondes, tu peux monter à 120–300 si tu veux
        cache.set(cache_key, response.data, 60)

        return response


# -----------------------------
# 2) Facettes/filters (query params)
# -----------------------------

class CategoryFilters(APIView):
    """
    GET /api/catalog/filters/?category=tous|<slug_cat>&subcategory=<slug_sub>
    -> renvoie les filtres disponibles (options) selon le périmètre.
    """
    def get(self, request):
        lang = get_request_lang(request)
        cat_slug = (request.query_params.get("category") or "tous").strip().lower()
        sub_slug = (request.query_params.get("subcategory") or "").strip().lower()

        if sub_slug:
            sub = get_object_or_404(Categories, slug=sub_slug, est_actif=True)
            cat = sub
            cat_ids = [sub.id]
        elif cat_slug and cat_slug != "tous":
            cat = get_object_or_404(Categories, slug=cat_slug, est_actif=True)
            cat_ids = _descendants_ids(cat)
        else:
            cat = None
            cat_ids = list(
                Categories.objects
                .filter(est_actif=True, is_deleted=False)
                .values_list("id", flat=True)
            )

        base = Produits.objects.filter(
            est_actif=True,
            visible=1,
            is_deleted=False,
            categorie_id__in=cat_ids,
        )

        # États (neuf / occasion / reconditionné)
        states_qs = (
            base.exclude(etat__isnull=True)
                .exclude(etat__exact="")
                .values_list("etat", flat=True)
                .distinct()
        )
        
        states = []
        for v in states_qs:
            label = _etat_label(v, request=request)  # FR ou EN auto
            states.append({"value": v, "label": label})

        # Marques
        marques_qs = (
            Marques.objects
            .filter(produits__in=base)
            .distinct()
            .order_by("nom")
        )
        marques = [
            {"nom": m.nom, "slug": m.slug, "logo_url": m.logo_url}
            for m in marques_qs
        ]

        # Couleurs (SANS traduction pour alléger)
        couleurs_qs = (
            Couleurs.objects
            .filter(variantes__produit__in=base)
            .distinct()
            .order_by("nom")
        )

        couleurs = []
        for c in couleurs_qs:
            name = c.nom or ""
            # ❌ plus de translate_text ici (perf)
            couleurs.append({
                "nom": name,
                "slug": c.slug,
                "code_hex": c.code_hex,
            })

        # Fallback global si aucune couleur dans la catégorie
        if not couleurs:
            fallback_qs = (
                Couleurs.objects
                .filter(est_active=True)
                .order_by("nom")
            )
            for c in fallback_qs:
                name = c.nom or ""
                couleurs.append({
                    "nom": name,
                    "slug": c.slug,
                    "code_hex": c.code_hex,
                })

        # Prix min/max
        prix_aggr = VariantesProduits.objects.filter(
            produit__in=base
        ).aggregate(
            min=Min("prix_promo"), min_fallback=Min("prix"),
            max=Max("prix_promo"), max_fallback=Max("prix"),
        )
        price_min = prix_aggr["min"] or prix_aggr["min_fallback"]
        price_max = prix_aggr["max"] or prix_aggr["max_fallback"]

        # Attributs dynamiques (inchangé)
        try:
            from .models import CategorieAttribut
            ca_qs = (
                CategorieAttribut.objects
                .filter(categorie_id__in=cat_ids)
                .select_related("attribut")
                .order_by("ordre")
            )
        except Exception:
            ca_qs = []

        attrs_meta = []
        seen = set()
        for ca in ca_qs:
            a = ca.attribut
            if a.id in seen or not a.actif:
                continue
            seen.add(a.id)
            meta = {
                "code": a.code,
                "libelle": a.libelle,
                "type": a.type,
            }
            if a.type == Attribut.CHOIX:
                meta["options"] = list(
                    ValeurAttribut.objects
                    .filter(attribut=a)
                    .values("valeur", "slug")
                    .order_by("valeur")
                )
            attrs_meta.append(meta)

        # Séparation produit / variante
        prod_attr_codes = set(
            SpecProduit.objects
            .filter(produit__in=base)
            .values_list("attribut__code", flat=True)
            .distinct()
        )
        var_attr_codes = set(
            SpecVariante.objects
            .filter(variante__produit__in=base)
            .values_list("attribut__code", flat=True)
            .distinct()
        )

        def is_variant_attr(code: str) -> bool:
            c = (code or "").lower()

            # ✅ Ces attributs doivent TOUJOURS être au niveau VARIANTE
            ALWAYS_VARIANT = {
                "couleur",
                "capacite_stockage",
            }

            if c in ALWAYS_VARIANT:
                return True

            return c == "couleur" or (c in var_attr_codes and c not in prod_attr_codes)

        attributes_product = [m for m in attrs_meta if not is_variant_attr(m["code"])]
        attributes_variant = [m for m in attrs_meta if is_variant_attr(m["code"])]

        # Catégorie courante
        category_data = {"nom": cat.nom, "slug": cat.slug} if cat else None

        payload = {
            "category": category_data,
            "brands": marques,
            "colors": couleurs,
            "price": {
                "min": float(price_min) if price_min else None,
                "max": float(price_max) if price_max else None,
            },
            "states": states,
            "attributes_product": attributes_product,
            "attributes_variant": attributes_variant,
        }
        return Response(payload)


class CategoryListBase(APIView):
    """
    Liste des catégories (niveau 1 ou toutes)
    Traduction gérée par CategorieMiniSerializer
    """
    def get(self, request):
        level = (request.query_params.get("level") or "1").strip()
        qs = Categories.objects.filter(est_actif=True, is_deleted=False)
        if str(level) == "1":
            qs = qs.filter(parent__isnull=True)

        qs = qs.order_by("nom")

        # 🔁 on passe par le serializer pour déclencher I18nTranslateMixin
        serializer = CategorieMiniSerializer(
            qs, many=True, context={"request": request}
        )
        data = serializer.data

        # 👉 si tu veux garder image_url + position, on enrichit
        def abs_media(path):
            if not path:
                return None
            p = str(path).strip()
            if p.lower().startswith(("http://", "https://", "data:")):
                return p
            base = request.build_absolute_uri(settings.MEDIA_URL)
            return f"{base.rstrip('/')}/{p.lstrip('/')}"

        for item, c in zip(data, qs):
            item["image_url"] = abs_media(getattr(c, "image_url", None))
            item["position"] = getattr(c, "position", None)
            item["parent_id"] = c.parent_id 

        return Response(data)


class CategoryListPublic(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(vary_on_headers("Accept-Language", "X-Lang"))
    def get(self, request):
        # langue actuelle (pour que le cache respecte les traductions)
        lang = (
            request.query_params.get("lang")
            or request.headers.get("X-Lang")
            or request.headers.get("Accept-Language", "fr")
        )
        lang = (lang or "fr").split(",")[0].split("-")[0]

        # 🔑 CLE DE CACHE
        cache_key = f"categories_public:{lang}:{request.get_full_path()}"

        # 🔁 TENTATIVE DE LECTURE DANS LE CACHE
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # -------------------------- #
        #        LOGIQUE NORMALE     #
        # -------------------------- #
        qs = (
            Categories.objects
            .filter(est_actif=True, is_deleted=False)
            .order_by("nom")
        )

        serializer = CategorieMiniSerializer(
            qs, many=True, context={"request": request}
        )
        data = serializer.data

        # --- Fonction helper pour rendre l’image absolue ---
        def abs_media(path):
            if not path:
                return None
            p = str(path).strip()
            if p.lower().startswith(("http://", "https://", "data:")):
                return p
            base = request.build_absolute_uri(settings.MEDIA_URL)
            return f"{base.rstrip('/')}/{p.lstrip('/')}"

        # ------ 1️⃣ Préparation : on relie les objets et leur dict ------
        pairs = list(zip(qs, data))

        # ------ 2️⃣ On enrichit chaque item ------
        for c, item in pairs:
            item["image_url"] = abs_media(getattr(c, "image_url", None))
            item["position"] = getattr(c, "position", None)
            item["parent_id"] = c.parent_id
            item["children"] = []   # 👈 IMPORTANT ici !

        # ------ 3️⃣ On construit les sous-catégories ------
        by_id = {c.id: item for c, item in pairs}
        for c, item in pairs:
            if c.parent_id:
                parent_item = by_id.get(c.parent_id)
                if parent_item:
                    parent_item["children"].append({
                        "id": c.id,
                        "nom": item["nom"],
                        "slug": item["slug"],
                    })

        # 💾 ON MET EN CACHE 5 MINUTES
        cache.set(cache_key, data, 300)

        return Response(data)

class CategoryListDashboard(CategoryListBase):
    permission_classes = [IsAuthenticated]          # ✅ protégé
    authentication_classes = [JWTAuthentication]

class CategoryListTop(APIView):
    """
    GET /christland/api/catalog/categories/top/
    👉 Ne renvoie que les catégories parents (niveau 1), sans sous-catégories
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(vary_on_headers("Accept-Language", "X-Lang"))
    def get(self, request):
        # langue actuelle
        lang = (
            request.query_params.get("lang")
            or request.headers.get("X-Lang")
            or request.headers.get("Accept-Language", "fr")
        )
        lang = (lang or "fr").split(",")[0].split("-")[0]

        # 🔑 CLE DE CACHE
        cache_key = f"categories_top:{lang}:{request.get_full_path()}"

        # 🔁 CACHE
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # -------- LOGIQUE NORMALE --------
        qs = (
            Categories.objects
            .filter(est_actif=True, is_deleted=False, parent__isnull=True)
            .order_by("nom")
        )
        serializer = CategorieMiniSerializer(
            qs, many=True, context={"request": request}
        )
        data = serializer.data

        # Ajouter position + parent_id (même si parent_id est None ici)
        for item, c in zip(data, qs):
            item["position"] = getattr(c, "position", None)
            item["parent_id"] = c.parent_id

        # 💾 5 minutes
        cache.set(cache_key, data, 300)

        return Response(data)

class ProductMiniView(APIView):
    """
    GET /christland/api/catalog/product/<pk_or_slug>/mini/
    -> { id, slug, nom, ref, image }
    - ref : premier SKU de variante si dispo, sinon slug produit
    - image : image principale (ou première) du produit
    Traduction gérée automatiquement par les serializers
    """
    def get(self, request, pk_or_slug: str):
        qs = Produits.objects.filter(est_actif=True, visible=1 , is_deleted=False)\
                             .select_related("categorie", "marque")\
                             .prefetch_related("images", "variantes")

        if pk_or_slug.isdigit():
            prod = get_object_or_404(qs, id=int(pk_or_slug))
        else:
            prod = get_object_or_404(qs, slug=pk_or_slug)

        # Image principale
        img = prod.images.filter(principale=True).first() or prod.images.order_by("position", "id").first()
        img_url = _abs_media(request, img.url if img else None) or ""

        # Référence (SKU ou slug)
        sku = (prod.variantes
               .exclude(sku__isnull=True)
               .exclude(sku__exact="")
               .values_list("sku", flat=True)
               .first()) or prod.slug
        payload = {
            "id": prod.id,
            "slug": prod.slug,   # ← traduit automatiquement si besoin
            "nom": prod.nom,     # ← traduit automatiquement par le serializer
            "ref": sku,
            "image": img_url,
        }

        return Response(payload) 
    
# --------- Helpers ----------
def _abs_media(request, value):
    if not value:
        return None
    v = str(value).strip()
    if not v:
        return None

    # URL absolue -> inchangée
    if v.lower().startswith(("http://", "https://", "data:")):
        return v

    # normaliser en chemin
    if not v.startswith("/"):
        v = "/" + v

    media_prefix = "/" + settings.MEDIA_URL.strip("/")  # ex: "/media"

    # si déjà sous /media/... -> ne rien rajouter
    if v.startswith(media_prefix + "/"):
        path = v
    else:
        # sinon on colle MEDIA_URL devant
        path = media_prefix + v

    return request.build_absolute_uri(path) if request else path

def _strip_media(url_or_path: str) -> str:
    s = (url_or_path or "").strip()
    if not s:
        return ""

    # URL absolue -> on garde seulement le path
    if s.lower().startswith(("http://", "https://")):
        s = urlparse(s).path or ""

    # retire /media/ si présent
    media_url = "/" + settings.MEDIA_URL.strip("/") + "/"  # "/media/"
    if s.startswith(media_url):
        s = s[len(media_url):]   # "uploads/..."
    s = s.lstrip("/")
    return s

# Nouvelle fonction propre – plus de _tr
from christland.services.text_translate import translate_text
from .serializers import get_request_lang  # tu l'as déjà importé plus haut

def _serialize_article(a: ArticlesBlog, request) -> dict:
    """
    Sérialise un article blog (utilisé par BlogPostsView)
    avec traduction automatique en fonction de la langue.
    """
    lang = get_request_lang(request) or "fr"
    lang = (lang or "fr").split(",")[0].split("-")[0].lower()

    # valeurs brutes FR
    title = a.titre or ""
    excerpt = a.extrait or ""
    content = a.contenu or ""

    # 🔁 si langue ≠ fr → on passe par translate_text (cache + Google)
    if lang != "fr":
        if title:
            title = translate_text(
                text=title,
                target_lang=lang,
                source_lang="fr",
            )
        if excerpt:
            excerpt = translate_text(
                text=excerpt,
                target_lang=lang,
                source_lang="fr",
            )
        if content:
            content = translate_text(
                text=content,
                target_lang=lang,
                source_lang="fr",
            )

    return {
        "id": a.id,
        "slug": a.slug,  # ❗ on NE traduit PAS le slug pour garder les URLs stables
        "title": title,
        "excerpt": excerpt,
        "content": content,
        "image": _abs_media(request, getattr(a, "image_couverture", None)),
    }



class BlogHeroView(APIView):
    def get(self, request):
        a = ArticlesBlog.objects.filter(is_deleted=False).order_by("id").first()
        if not a:
            return Response({"title": "", "slug": ""})

        lang = get_request_lang(request) or "fr"
        lang = (lang or "fr").split(",")[0].split("-")[0].lower()

        # 🎯 Traduction du titre (si langue ≠ fr)
        title = a.titre or ""
        if lang != "fr" and title:
            title = translate_text(
                text=title,
                target_lang=lang,
                source_lang="fr",
            )

        # 🎯 Traduction du slug (puisqu’il n’est pas un lien technique)
        slug_text = a.slug or ""
        if lang != "fr" and slug_text:
            # On remplace les tirets avant traduction pour avoir un texte naturel
            slug_text_clean = slug_text.replace("-", " ").strip()

            slug_text = translate_text(
                text=slug_text_clean,
                target_lang=lang,
                source_lang="fr",
            )

        return Response({
            "title": title,
            "slug": slug_text,   # 👈 Maintenant le slug est bien traduit
        })


class BlogPostsView(APIView):
    """
    GET /christland/api/blog/posts/
    -> { "top": [...tous sauf les 2 derniers...], "bottom": [...2 derniers...] }
    L’ordre est chronologique (id ASC) pour que "les 2 derniers" restent en bas.
    """
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    
    def get(self, request):
        qs: QuerySet[ArticlesBlog] = ArticlesBlog.objects.filter(is_deleted=False).order_by("id")

        items = list(qs)

        if not items:
            return Response({"top": [], "bottom": []})

        if len(items) >= 2:
            top_items = items[:-2]
            bottom_items = items[-2:]
        else:
            top_items = []
            bottom_items = items

        data = {
            "top": [_serialize_article(a, request) for a in top_items],
            "bottom": [_serialize_article(a, request) for a in bottom_items],
        }
        return Response(data)


# --- helpers pour sérialiser uniquement les specs remplies ---

def _spec_value_from_obj(spec) -> str | None:
    """Retourne la valeur normalisée en string depuis SpecProduit/SpecVariante, ou None si vide."""
    if getattr(spec, "valeur_choice", None):
        return spec.valeur_choice.valeur
    if getattr(spec, "valeur_text", None):
        # "true"/"false" déjà gérés côté création ; on renvoie tel quel
        return spec.valeur_text
    if getattr(spec, "valeur_int", None) is not None:
        return str(spec.valeur_int)
    if getattr(spec, "valeur_dec", None) is not None:
        return str(spec.valeur_dec)
    return None


def _specs_to_filled_list(specs_qs):
    """
    Convertit un queryset de SpecProduit/SpecVariante en liste d'objets
    {code, type, libelle, unite?, value} **UNIQUEMENT** si une valeur est présente.
    """
    items = []
    for sp in specs_qs.select_related("attribut", "valeur_choice"):
        attr = sp.attribut
        if not attr or not attr.actif:
            continue
        val = _spec_value_from_obj(sp)
        if val in (None, ""):
            continue
        items.append({
            "code": attr.code,
            "type": attr.type,         # côté front tu as déjà un mapping -> "text|int|dec|bool|choice"
            "libelle": attr.libelle or attr.code,
            "unite": getattr(attr, "unite", "") or "",
            "value": val,
        })
    return items



# -----------------------------
# ESPACE ADMINISTRATEUR
# -----------------------------

# views.py
# views.py
class ProduitsListCreateView(generics.ListCreateAPIView):
    serializer_class = ProduitsSerializer
    pagination_class = SmallPagination
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        include_deleted = _to_bool(
            self.request.query_params.get("include_deleted"),
            default=False
        )
        active_only = str(
            self.request.query_params.get("active_only") or "1"
        ).lower() in ("1", "true", "yes")

        qs = Produits.objects.all()

        if active_only:
            qs = qs.filter(est_actif=True)
        else:
            qs = qs.filter(est_actif=False)

        if not include_deleted:
            qs = qs.filter(is_deleted=False)

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(nom__icontains=q)

        # ✅ filtre par catégorie parente -> inclut ses sous-catégories
        category_id = self.request.query_params.get("category_id") or self.request.query_params.get("categorie")
        category_slug = (self.request.query_params.get("category_slug") or "").strip().lower()

        if category_id:
            cat = Categories.objects.filter(
                id=_as_int(category_id),
                is_deleted=False,
                est_actif=True,
            ).first()
            if cat:
                cat_ids = _descendants_ids(cat)
                qs = qs.filter(categorie_id__in=cat_ids)

        elif category_slug:
            cat = Categories.objects.filter(
                slug=category_slug,
                is_deleted=False,
                est_actif=True,
            ).first()
            if cat:
                cat_ids = _descendants_ids(cat)
                qs = qs.filter(categorie_id__in=cat_ids)

        qs = (
            qs.order_by("-cree_le", "-id")
              .select_related("marque", "categorie")
              .prefetch_related("images", "variantes")
              .distinct()
        )

        return qs


class DashboardProductRestoreView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, pk: int):
        p = get_object_or_404(Produits.objects.all(), pk=pk)

        before = {
            "is_deleted": getattr(p, "is_deleted", None),
            "deleted_at": getattr(p, "deleted_at", None),
            "deleted_by_id": getattr(p, "deleted_by_id", None),
        }

        _soft_restore(p)
        p.refresh_from_db()

        after = {
            "is_deleted": getattr(p, "is_deleted", None),
            "deleted_at": getattr(p, "deleted_at", None),
            "deleted_by_id": getattr(p, "deleted_by_id", None),
        }

        try:
            log_dashboard_action(
                request=request,
                action=DashboardActionLog.ACTION_RESTORE,
                target=p,
                before=before,
                after=after,
            )
        except Exception:
            pass

        return Response({"ok": True, "message": "Produit restauré."}, status=200)




class ProduitsDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /christland/api/dashboard/produits/<id>/

    ✅ Soft delete:
      - DELETE -> is_deleted=True, deleted_at, deleted_by
      - Par défaut GET/PUT/PATCH refusent un produit soft-deleted
      - Si tu veux accéder à un supprimé: ?include_deleted=1
    """
    queryset = Produits.objects.all()
    serializer_class = ProduitsSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["disable_i18n"] = True
        return ctx

    # ✅ On contrôle l'accès aux supprimés
    def get_queryset(self):
        include_deleted = str(self.request.query_params.get("include_deleted") or "").lower() in ("1", "true", "yes")
        qs = Produits.objects.all()
        if not include_deleted:
            # si ton champ s'appelle différemment adapte ici
            qs = qs.filter(is_deleted=False)
        return qs

    def get_object(self):
        # Utilise le queryset filtré ci-dessus (important)
        qs = self.get_queryset()
        return get_object_or_404(qs, pk=self.kwargs.get("pk"))

    # ✅ Soft delete à la place de delete()
    def delete(self, request, *args, **kwargs):
        obj = self.get_object()

        if getattr(obj, "is_deleted", False):
            return Response({"ok": True, "message": "Produit déjà supprimé."}, status=200)

        before = {"id": obj.pk, "nom": getattr(obj, "nom", None), "is_deleted": obj.is_deleted}

        _soft_delete(obj, user=request.user)

        after = {"id": obj.pk, "nom": getattr(obj, "nom", None), "is_deleted": obj.is_deleted}

        log_dashboard_action(request, obj, DashboardActionLog.ACTION_DELETE, before=before, after=after)

        return Response({"ok": True, "message": "Produit supprimé (soft delete)."}, status=200)

    def perform_update(self, serializer):
        obj = self.get_object()

        before = {
            "id": obj.pk,
            "nom": getattr(obj, "nom", None),
            "description_courte": getattr(obj, "description_courte", None),
            "description_long": getattr(obj, "description_long", None),
            "slug": getattr(obj, "slug", None),
            "is_deleted": getattr(obj, "is_deleted", None),
        }

        updated = serializer.save()

        after = {
            "id": updated.pk,
            "nom": getattr(updated, "nom", None),
            "description_courte": getattr(updated, "description_courte", None),
            "description_long": getattr(updated, "description_long", None),
            "slug": getattr(updated, "slug", None),
            "is_deleted": getattr(updated, "is_deleted", None),
        }

        log_dashboard_action(self.request, updated, DashboardActionLog.ACTION_UPDATE, before=before, after=after)


    # (Optionnel mais recommandé) -> message propre si on essaie de modifier un produit supprimé
    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if getattr(obj, "is_deleted", False):
            return Response(
                {"detail": "Ce produit est supprimé. Veuillez le restaurer avant de le modifier."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

class DashboardArticlesListCreateView(generics.ListCreateAPIView):
    serializer_class = ArticleDashboardSerializer
    pagination_class = SmallPagination
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get_serializer_class(self):
        # 👉 GET = liste d’articles (dashboard)
        if self.request.method == "GET":
            return ArticleDashboardSerializer
        # 👉 POST = création d’article
        if self.request.method == "POST":
            return ArticleCreateSerializer
        # fallback
        return ArticleDashboardSerializer
    
    
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    
    def perform_create(self, serializer):
        obj = serializer.save()
        log_dashboard_action(self.request, obj, DashboardActionLog.ACTION_CREATE, after={"id": obj.pk})

    
    def get_queryset(self):
        q = (self.request.query_params.get("q") or "").strip()
        include_deleted = str(self.request.query_params.get("include_deleted") or "").lower() in ("1","true","yes")

        qs = (
            ArticlesBlog.objects
            .select_related("categorie", "auteur")
        )
        if not include_deleted:
            qs = qs.filter(is_deleted=False)

        qs = qs.order_by("-cree_le", "-id")

        if q:
            qs = qs.filter(
                Q(titre__icontains=q) |
                Q(extrait__icontains=q) |
                Q(contenu__icontains=q)
            )
        return qs

class DashboardArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/DELETE /christland/api/dashboard/articles/<id>/
    """
    queryset = ArticlesBlog.objects.all().order_by("-id")
    serializer_class = ArticleDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ArticleEditSerializer
        return ArticleDashboardSerializer

    def get_object(self):
        pk = self.kwargs.get("pk")
        include_deleted = str(self.request.query_params.get("include_deleted") or "").lower() in ("1", "true", "yes")

        qs = ArticlesBlog.objects.all()
        if not include_deleted:
            qs = qs.filter(is_deleted=False)

        return get_object_or_404(qs, pk=pk)

    def delete(self, request, *args, **kwargs):
        a = self.get_object()

        # déjà supprimé
        if getattr(a, "is_deleted", False):
            return Response({"ok": True, "message": "Article déjà supprimé."}, status=status.HTTP_200_OK)

        # BEFORE log
        before = {
            "id": a.pk,
            "titre": getattr(a, "titre", None),
            "slug": getattr(a, "slug", None),
            "is_deleted": getattr(a, "is_deleted", None),
        }

        # soft delete
        _soft_delete(a, user=request.user)
        a.refresh_from_db(fields=["is_deleted", "deleted_at", "deleted_by"])

        # AFTER log
        after = {
            "id": a.pk,
            "titre": getattr(a, "titre", None),
            "slug": getattr(a, "slug", None),
            "is_deleted": getattr(a, "is_deleted", None),
            "deleted_at": str(getattr(a, "deleted_at", None)),
            "deleted_by_id": getattr(a, "deleted_by_id", None),
        }

        # ✅ traçabilité
        log_dashboard_action(request, a, DashboardActionLog.ACTION_DELETE, before=before, after=after)

        return Response({"ok": True, "message": "Article supprimé (soft delete)."}, status=status.HTTP_200_OK)

    
class DashboardArticleEditView(generics.RetrieveAPIView):
    """
    ✅ GET /christland/api/dashboard/articles/<id>/edit/
    → ne renvoie que: id, titre, slug, extrait, contenu, image, publie_le
    """
    queryset = ArticlesBlog.objects.filter(is_deleted=False)
    serializer_class = ArticleEditSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx



class DashboardArticleRestoreView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, pk: int):
        a = get_object_or_404(ArticlesBlog.objects.all(), pk=pk)

        if not getattr(a, "is_deleted", False):
            return Response({"ok": True, "message": "Article déjà actif."}, status=200)

        before = {
            "is_deleted": getattr(a, "is_deleted", None),
            "deleted_at": getattr(a, "deleted_at", None),
            "deleted_by_id": getattr(a, "deleted_by_id", None),
        }

        _soft_restore(a)
        a.refresh_from_db()

        after = {
            "is_deleted": getattr(a, "is_deleted", None),
            "deleted_at": getattr(a, "deleted_at", None),
            "deleted_by_id": getattr(a, "deleted_by_id", None),
        }

        try:
            log_dashboard_action(
                request=request,
                action=DashboardActionLog.ACTION_RESTORE,
                target=a,
                before=before,
                after=after,
            )
        except Exception:
            pass

        return Response({"ok": True, "message": "Article restauré."}, status=200)



# views.py
class BlogLatestView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or "2")
        except ValueError:
            limit = 2

        qs = ArticlesBlog.objects.filter(is_deleted=False).order_by("-cree_le", "-id")[:max(1, limit)]

        lang = get_request_lang(request) or "fr"
        lang = (lang or "fr").split(",")[0].split("-")[0].lower()

        data = []
        for a in qs:
            title = a.titre or ""
            excerpt = a.extrait or ""

            if lang != "fr":
                if title:
                    title = translate_text(title, target_lang=lang, source_lang="fr")
                if excerpt:
                    excerpt = translate_text(excerpt, target_lang=lang, source_lang="fr")

            data.append({
                "id": a.id,
                "slug": a.slug,   # pas traduit
                "title": title,
                "excerpt": excerpt,
                "image": _abs_media(request, getattr(a, "image_couverture", None)),
            })

        return Response(data, status=200)

from christland.services.text_translate import translate_text

class LatestProductsView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(vary_on_headers("Accept-Language", "X-Lang"))
    def get(self, request):
        # langue demandée
        lang = request.query_params.get("lang") or request.headers.get("X-Lang") or "fr"
        lang = (lang or "fr").split(",")[0].split("-")[0].lower()

        cache_key = f"latest:{lang}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # on récupère les 10 derniers produits actifs & visibles
        qs = (
            Produits.objects
            .filter(est_actif=True, visible=1, is_deleted=False)
            .select_related("marque", "categorie", "categorie__parent")  # 🔹 + parent
            .prefetch_related(
                "images",
                "variantes",
                "specs", "specs__attribut", "specs__valeur_choice",
                "variantes__specs", "variantes__specs__attribut", "variantes__specs__valeur_choice"
            )
            .order_by("-cree_le", "-id")[:10]
        )

        # base : on laisse le serializer faire son travail (nom, description, etc.)
        serializer = ProduitCardSerializer(qs, many=True, context={"request": request})
        base_data = list(serializer.data)

        results = []

        for item, prod in zip(base_data, qs):
            # on part de l'objet sérialisé
            obj = dict(item)

            # ---------- Specs (comme avant) ----------
            specs_text = ""
            if prod.specs.exists():
                specs_text = " | ".join([
                    sp.valeur_text
                    or (sp.valeur_choice.valeur if sp.valeur_choice else "")
                    or str(sp.valeur_int or sp.valeur_dec or "")
                    for sp in prod.specs.all()[:5]
                    if sp.valeur_text
                    or sp.valeur_choice
                    or sp.valeur_int is not None
                    or sp.valeur_dec is not None
                ])
            elif prod.variantes.exists():
                var = prod.variantes.first()
                if var and var.specs.exists():
                    specs_text = " | ".join([
                        sp.valeur_text
                        or (sp.valeur_choice.valeur if sp.valeur_choice else "")
                        or str(sp.valeur_int or sp.valeur_dec or "")
                        for sp in var.specs.all()[:5]
                        if sp.valeur_text
                        or sp.valeur_choice
                        or sp.valeur_int is not None
                        or sp.valeur_dec is not None
                    ])
            obj["specs"] = specs_text.strip()

            # ---------- Image principale ----------
            main_img = prod.images.filter(principale=True).first() or prod.images.order_by("position", "id").first()
            obj["image"] = _abs_media(request, main_img.url if main_img else None)


            # ---------- Prix min ----------
          # On garde le price calculé par le serializer
            obj["price"] = item.get("price")

                       # État (utilise le helper i18n)
            obj["state"] = _etat_label(prod.etat, request=request)

            # ---------- Catégorie pour les onglets ----------
# ---------- Catégorie / Sous-catégorie pour les onglets ----------
            if prod.categorie:
                cat = prod.categorie

                # 1) on remonte jusqu'à la catégorie racine
                root = cat
                # si tu as max 2 niveaux, ça suffit ; sinon la boucle gère plusieurs niveaux
                while getattr(root, "parent_id", None):
                    root = root.parent

                # 2) nom traduit de la catégorie racine
                root_name = root.nom or ""
                if lang != "fr" and root_name:
                    root_name = translate_text(
                        text=root_name,
                        target_lang=lang,
                        source_lang="fr",
                    )

                # 🔹 catégorie utilisée pour les onglets = catégorie racine
                obj["category"] = {
                    "id": root.id,
                    "nom": root_name,
                    "slug": root.slug,
                }

                # (optionnel) exposer aussi la sous-catégorie si tu veux
                if cat.id != root.id:
                    sub_name = cat.nom or ""
                    if lang != "fr" and sub_name:
                        sub_name = translate_text(
                            text=sub_name,
                            target_lang=lang,
                            source_lang="fr",
                        )

                    obj["subcategory"] = {
                        "id": cat.id,
                        "nom": sub_name,
                        "slug": cat.slug,
                    }
                else:
                    obj["subcategory"] = None
            else:
                obj["category"] = None
                obj["subcategory"] = None

            results.append(obj)
 
        cache.set(cache_key, results, 60)

        return Response(results)


from .models import MessagesContact

def _serialize_contact(m: MessagesContact) -> dict:
    return {
        "id": m.id,
        "nom": m.nom or "",
        "email": m.email or "",
        "telephone": m.telephone or "",
        "sujet": m.sujet or "",
        "message": m.message or "",
        "cree_le": m.cree_le,
    }

class ContactMessageView(APIView):
    """
    POST /christland/api/contact/messages/
      body: {nom?, email?, telephone?, sujet, message}
      -> enregistre + (essaie) d'envoyer un email

    GET  /christland/api/contact/messages/?limit=50
      -> derniers messages
    """

    permission_classes = [AllowAny]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def post(self, request):
        nom = (request.data.get("nom") or "").strip()
        email = (request.data.get("email") or "").strip()           # optionnel
        telephone = (request.data.get("telephone") or "").strip()   # optionnel
        sujet = (request.data.get("sujet") or "").strip()
        message = (request.data.get("message") or "").strip()

        # --- validation simple ---
        if not sujet or not message:
            return Response(
                {"detail": "sujet et message sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- 1) Enregistrer en base ---
        try:
            mc = MessagesContact.objects.create(
                nom=nom,
                email=email,
                telephone=telephone,
                sujet=sujet,
                message=message,
                cree_le=timezone.now(),
            )
        except Exception as e:
            # si la sauvegarde BD plante → vrai 500
            return Response(
                {"detail": "Erreur lors de l'enregistrement du message."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # --- 2) Envoi de l'email (ne doit PAS faire planter l'API) ---
        to_addr = getattr(settings, "CONTACT_INBOX", None)
        from_addr = getattr(settings, "DEFAULT_FROM_EMAIL", None)

        mail_sent = False

        if to_addr and from_addr:
            body = (
                f"Nom: {nom or '-'}\n"
                f"Email: {email or '-'}\n"
                f"Téléphone: {telephone or '-'}\n\n"
                f"Message:\n{message}"
            )

            mail = EmailMessage(
                subject=f"CHRISTLAND TECH - {sujet}",
                body=body,
                from_email=from_addr,
                to=[to_addr],
                headers={"Reply-To": email} if email else None,
            )

            try:
                # en prod on ne veut pas de 500 si le SMTP a un souci
                mail.send(fail_silently=True)
                mail_sent = True
            except Exception:
                mail_sent = False  # on ignore l'erreur, mais on indique l'état

        return Response(
            {
                "ok": True,
                "message": "Message enregistré.",
                "email_envoye": mail_sent,
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or "50")
        except ValueError:
            limit = 50

        qs = MessagesContact.objects.all().order_by("-cree_le", "-id")[: max(1, limit)]

        def _serialize_contact(m):
            return {
                "id": m.id,
                "nom": m.nom,
                "email": m.email,
                "telephone": m.telephone,
                "sujet": m.sujet,
                "message": m.message,
                "cree_le": m.cree_le,
            }

        return Response([_serialize_contact(m) for m in qs])
from rest_framework.permissions import IsAuthenticated  # si besoin


class DashboardProductEditDataView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get(self, request, pk: int):
        qs = (
            Produits.objects
            .select_related("marque", "categorie")
            .prefetch_related(
                "images",
                "variantes",
                "variantes__couleur",
                "specs", "specs__attribut", "specs__valeur_choice",
                "variantes__specs", "variantes__specs__attribut", "variantes__specs__valeur_choice",
            )
        )
        prod = get_object_or_404(qs, pk=pk)

        images = [{
            "url": _abs_media(request, im.url),
            "alt_text": im.alt_text or "",
            "position": im.position,
            "principale": bool(im.principale),
        } for im in prod.images.all().order_by("position", "id") if im.url]

        all_vars = list(prod.variantes.all().order_by("id"))

        cat = prod.categorie
        parent_cat = cat.parent if cat and cat.parent_id else None

        payload = {
            "id": prod.id,
            "nom": prod.nom or "",
            "slug": prod.slug or "",
            "description_courte": prod.description_courte or "",
            "description_long": prod.description_long or "",
            "etat": prod.etat or "neuf",
            "est_actif": bool(prod.est_actif),
            "visible": prod.visible,
            "garantie_mois": getattr(prod, "garantie_mois", None),
            "poids_grammes": prod.poids_grammes,
            "dimensions": prod.dimensions or "",
            "marque": (
                {"id": prod.marque.id, "slug": prod.marque.slug, "nom": prod.marque.nom}
                if prod.marque_id else None
            ),
            "categorie": (
                {
                    "id": parent_cat.id,
                    "slug": parent_cat.slug,
                    "nom": parent_cat.nom,
                    "parent_id": parent_cat.parent_id,
                } if parent_cat else (
                    {
                        "id": cat.id,
                        "slug": cat.slug,
                        "nom": cat.nom,
                        "parent_id": cat.parent_id,
                    } if cat else None
                )
            ),
            "sous_categorie": (
                {"id": cat.id, "slug": cat.slug, "nom": cat.nom}
                if cat and cat.parent_id else None
            ),
            "images": images,
            "product_attributes": _specs_to_filled_list(prod.specs.all()) if hasattr(prod, "specs") else [],
        }

        variants_payload = []
        for v in all_vars:
            variants_payload.append({
                "id": v.id,
                "nom": v.nom or "",
                "sku": v.sku or "",
                "code_barres": v.code_barres or "",
                "attributes": _specs_to_filled_list(v.specs.all()) if hasattr(v, "specs") else [],
                "prix": v.prix,
                "prix_promo": v.prix_promo,
                "promo_active": bool(v.promo_active),
                "promo_debut": _dtlocal(v.promo_debut),
                "promo_fin": _dtlocal(v.promo_fin),
                "stock": v.stock,
                "prix_achat": getattr(v, "prix_achat", None),
                "variante_poids_grammes": getattr(v, "poids_grammes", None),
                "variante_est_actif": bool(getattr(v, "est_actif", True)),
                "couleur": (
                    {"id": v.couleur.id, "slug": v.couleur.slug, "nom": v.couleur.nom}
                    if v.couleur_id else None
                ),
            })

        payload["variants"] = variants_payload
        payload["variantes"] = variants_payload

        if all_vars:
            first = all_vars[0]
            payload["variant"] = variants_payload[0]
            payload["variant_attributes"] = _specs_to_filled_list(first.specs.all()) if hasattr(first, "specs") else []
        else:
            payload["variant"] = None
            payload["variant_attributes"] = []

        return Response(payload, status=status.HTTP_200_OK)

    # -------- UPDATE --------
    @transaction.atomic
    def put(self, request, pk: int):
        def _snapshot_product(prod: Produits):
            prod.refresh_from_db()
            prod = (
                Produits.objects
                .select_related("marque", "categorie")
                .prefetch_related("images", "variantes", "variantes__couleur")
                .get(pk=prod.pk)
            )
            return {
                "id": prod.id,
                "nom": prod.nom,
                "slug": prod.slug,
                "description_courte": prod.description_courte,
                "description_long": prod.description_long,
                "etat": prod.etat,
                "est_actif": bool(prod.est_actif),
                "visible": prod.visible,
                "garantie_mois": getattr(prod, "garantie_mois", None),
                "poids_grammes": str(prod.poids_grammes) if prod.poids_grammes is not None else None,
                "dimensions": prod.dimensions,
                "marque_id": prod.marque_id,
                "categorie_id": prod.categorie_id,
                "images": [
                    {"url": im.url, "alt_text": im.alt_text, "position": im.position, "principale": bool(im.principale)}
                    for im in prod.images.all().order_by("position", "id")
                ],
                "variants": [
                    {
                        "id": v.id,
                        "nom": v.nom,
                        "sku": v.sku,
                        "code_barres": v.code_barres,
                        "prix": str(v.prix) if v.prix is not None else None,
                        "prix_promo": str(v.prix_promo) if v.prix_promo is not None else None,
                        "promo_active": bool(v.promo_active),
                        "promo_debut": v.promo_debut.isoformat() if v.promo_debut else None,
                        "promo_fin": v.promo_fin.isoformat() if v.promo_fin else None,
                        "stock": v.stock,
                        "prix_achat": str(getattr(v, "prix_achat", None)) if getattr(v, "prix_achat", None) is not None else None,
                        "poids_grammes": str(getattr(v, "poids_grammes", None)) if getattr(v, "poids_grammes", None) is not None else None,
                        "est_actif": bool(getattr(v, "est_actif", True)),
                        "couleur_id": v.couleur_id,
                    }
                    for v in prod.variantes.all().order_by("id")
                ],
            }

        try:
            prod = get_object_or_404(
                Produits.objects.select_related("marque", "categorie").prefetch_related(
                    "images", "variantes", "variantes__specs", "specs"
                ),
                pk=pk
            )

            before = _snapshot_product(prod)

            data = request.data

            # ---- Produit : champs simples ----
            for fld in [
                "nom","description_courte", "description_long",
                "garantie_mois", "poids_grammes", "dimensions", "etat", "visible", "est_actif"
            ]:
                if fld in data:
                    setattr(prod, fld, data.get(fld))

            # ---- Catégorie / Sous-catégorie (optionnelles) ----
            cat_obj = None
            if "sous_categorie" in data and data["sous_categorie"]:
                cat_obj = Categories.objects.filter(id=_as_int(data["sous_categorie"])).first()
            elif "categorie" in data and data["categorie"]:
                cat_obj = Categories.objects.filter(id=_as_int(data["categorie"])).first()

            if cat_obj:
                prod.categorie = cat_obj

            # ---- Marque ----
            if "marque" in data and data["marque"]:
                m, _note = _resolve_marque_verbose(data["marque"])
                if m:
                    prod.marque = m

            if "nom" in data:
                prod.nom = data.get("nom") or ""

                # ✅ slug suit automatiquement le nom
                prod.slug = slugify(prod.nom)[:140]

            prod.save()

            # ---- VARIANTS ----
            variants_payload = data.get("variants") or []

            def _set_if_present(obj, key, source, transform=lambda x: x):
                if key in source:
                    setattr(obj, key, transform(source.get(key)))

            if variants_payload:
                existing_vars = {v.id: v for v in prod.variantes.all()}
                keep_ids: list[int] = []

                for v_data in variants_payload:
                    v_id = _as_int(v_data.get("id"))
                    if v_id and v_id in existing_vars:
                        var = existing_vars[v_id]
                    else:
                        var = VariantesProduits(produit=prod)

                    _set_if_present(var, "nom",         v_data, lambda v: v or prod.nom or "")
                    _set_if_present(var, "sku",         v_data, lambda v: v or "")
                    _set_if_present(var, "code_barres", v_data, lambda v: v or "")
                    _set_if_present(var, "prix",        v_data)
                    _set_if_present(var, "prix_promo",  v_data)

                    var.promo_active = _to_bool(v_data.get("promo_active"), default=False)
                    var.promo_debut  = _parse_dt_local(v_data.get("promo_debut"))
                    var.promo_fin    = _parse_dt_local(v_data.get("promo_fin"))

                    _set_if_present(var, "stock",      v_data, lambda v: v or 0)
                    _set_if_present(var, "prix_achat", v_data)

                    if "variante_poids_grammes" in v_data:
                        var.poids_grammes = v_data.get("variante_poids_grammes")

                    var.est_actif = _to_bool(v_data.get("variante_est_actif"), default=False)

                    if "couleur" in v_data:
                        var.couleur = _resolve_couleur(v_data.get("couleur"))

                    var.save()
                    keep_ids.append(var.id)

                    # attrs par variante
                    for item in v_data.get("attributes") or []:
                        code = (item.get("code") or "").strip().lower()
                        if not code:
                            continue
                        if code == "couleur" and var.couleur_id:
                            continue

                        attr = _get_or_create_attr(code, item.get("type"), item.get("libelle"), item.get("unite"))
                        if not attr or not attr.actif:
                            continue
                        _write_spec_variante(var, attr, item.get("value"))

                    if var.couleur_id:
                        attr_c = _get_or_create_attr("couleur", Attribut.CHOIX, "Couleur")
                        va_c   = _upsert_valeur_choice(attr_c, var.couleur.nom)
                        SpecVariante.objects.update_or_create(
                            variante=var, attribut=attr_c,
                            defaults={"valeur_choice": va_c, "valeur_text": None, "valeur_int": None, "valeur_dec": None},
                        )

                if keep_ids:
                    VariantesProduits.objects.filter(produit=prod).exclude(id__in=keep_ids).delete()

                var = prod.variantes.order_by("id").first()
            else:
                var = prod.variantes.order_by("id").first()
                if not var:
                    var = VariantesProduits.objects.create(produit=prod, nom=prod.nom or "", prix=0)

                _set_if_present(var, "nom",         data, lambda v: v or prod.nom or "")
                _set_if_present(var, "sku",         data, lambda v: v or "")
                _set_if_present(var, "code_barres", data, lambda v: v or "")
                _set_if_present(var, "prix",        data)
                _set_if_present(var, "prix_promo",  data)

                var.promo_active = _to_bool(data.get("promo_active"), default=False)
                var.promo_debut  = _parse_dt_local(data.get("promo_debut"))
                var.promo_fin    = _parse_dt_local(data.get("promo_fin"))

                _set_if_present(var, "stock",      data, lambda v: v or 0)
                _set_if_present(var, "prix_achat", data)

                if "variante_poids_grammes" in data:
                    var.poids_grammes = data.get("variante_poids_grammes")

                var.est_actif = _to_bool(data.get("variante_est_actif"), default=False)

                if "couleur" in data:
                    var.couleur = _resolve_couleur(data.get("couleur"))

                var.save()

                if var.couleur_id:
                    attr_c = _get_or_create_attr("couleur", Attribut.CHOIX, "Couleur")
                    va_c   = _upsert_valeur_choice(attr_c, var.couleur.nom)
                    SpecVariante.objects.update_or_create(
                        variante=var, attribut=attr_c,
                        defaults={"valeur_choice": va_c, "valeur_text": None, "valeur_int": None, "valeur_dec": None},
                    )

            # ---- Images ----
            if "images" in data:
                imgs = _clean_images_payload(data.get("images"))
                prod.images.all().delete()
                for i, im in enumerate(imgs, start=1):
                    ImagesProduits.objects.create(
                        produit=prod,
                        url=im["url"],
                        alt_text=im.get("alt_text", "") or "",
                        position=im.get("position") or i,
                        principale=bool(im.get("principale", False)),
                    )

            # ---- Attributs Produit ----
            for it in data.get("product_attributes", []) or []:
                code = (it.get("code") or "").strip().lower()
                if not code:
                    continue
                raw_value = it.get("value", None)
                if raw_value in (None, "", [], {}):
                    continue
                attr = _get_or_create_attr(code, it.get("type"), it.get("libelle"), it.get("unite"))
                if not attr or not attr.actif:
                    continue
                _write_spec_produit(prod, attr, raw_value)

            # ---- Attributs Variante ----
            for it in data.get("variant_attributes", []) or []:
                code = (it.get("code") or "").strip().lower()
                if not code:
                    continue
                if code == "couleur" and var and var.couleur_id:
                    continue
                attr = _get_or_create_attr(code, it.get("type"), it.get("libelle"), it.get("unite"))
                if not attr or not attr.actif:
                    continue
                _write_spec_variante(var, attr, it.get("value"))

            # ✅ LOG UPDATE
            after = _snapshot_product(prod)
            try:
                log_dashboard_action(
                    request=request,
                    action=DashboardActionLog.ACTION_UPDATE,
                    target=prod,
                    before=before,
                    after=after,
                )
            except Exception:
                pass

            return Response(
                {"ok": True, "message": "Produit mis à jour.", "id": prod.id},
                status=status.HTTP_200_OK,
            )

        except IntegrityError as ie:
            field, human = _integrity_to_field_error(ie)
            payload_err = {"error": "Erreur de données", "detail": human or str(ie)}
            if field:
                payload_err["field"] = field
                payload_err.setdefault("field_errors", {})[field] = human
            return Response(payload_err, status=status.HTTP_400_BAD_REQUEST)


class MarquesListView(APIView):
    """
    GET /christland/api/catalog/marques/?q=&active_only=1
    -> [{id, nom, slug, logo_url}]
    Traduction gérée automatiquement par MarqueMiniSerializer
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        active_only = request.query_params.get("active_only", "").lower() in ("1", "true", "yes")

        qs = Marques.objects.all().order_by("nom")
        if active_only:
            qs = qs.filter(Q(est_active=True) | Q(est_active__isnull=True))
        if q:
            qs = qs.filter(Q(nom__icontains=q) | Q(slug__icontains=q))

        data = [
            {
                "id": m.id,
                "nom": m.nom,          # ← traduit automatiquement
                "slug": m.slug,
                "logo_url": m.logo_url,
            }
            for m in qs
        ]

        return Response(data)


class CouleursListView(APIView):
    """
    GET /christland/api/catalog/couleurs/?q=&active_only=1
    -> [{id, nom, slug, code_hex, est_active}]
    Traduction gérée automatiquement par CouleurMiniSerializer
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        active_only = request.query_params.get("active_only", "").lower() in ("1", "true", "yes")

        qs = Couleurs.objects.all().order_by("nom")
        if active_only:
            qs = qs.filter(est_active=True)
        if q:
            qs = qs.filter(Q(nom__icontains=q) | Q(slug__icontains=q))

        serializer = CouleurMiniSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(serializer.data)
# views.py (ajoute/replace ces parties)
import re
from django.db.utils import IntegrityError

from django.db.utils import IntegrityError
import re

def _integrity_to_field_error(exc: IntegrityError):
    msg = str(exc)

    # 🔹 1) Contrainte CHECK sur la promo
    if "promo_inferieure_au_prix_normal_si_active" in msg:
        return "prix_promo", (
            "Le prix promotionnel ne doit pas être supérieur au prix normal "
            "lorsque la promotion est activée."
        )

    # 🔹 2) Attributs obligatoires manquants (notre propre IntegrityError)
    if "Attribut(s) obligatoire(s) manquant(s)" in msg:
        return "attributes", msg

    # 🔹 3) Contrainte UNIQUE (SQLite)
    m = re.search(r"UNIQUE constraint failed:\s*([^.]+)\.([^.]+)\.([^\s]+)", msg, re.I)
    if m:
        field = m.group(3)
        return field, "Cette valeur existe déjà."

    # 🔹 4) Contrainte UNIQUE (Postgres)
    m = re.search(r'violates unique constraint\s+"([^"]+)"', msg, re.I)
    if m:
        parts = m.group(1).split("_")
        if parts and parts[-1] in ("key", "uniq", "unique"):
            parts = parts[:-1]
        if parts:
            return parts[-1], "Cette valeur existe déjà."

    # 🔹 5) fallback
    return None, "Erreur de données : contrainte non respectée."


# ---------- Helpers uniques ----------
def _as_int(val):
    try:
        return int(val)
    except Exception:
        return None

def _resolve_marque_verbose(val):
    """
    -> (obj|None, note:str|None)
    - id (int/"12") -> récupère
    - nom (str)     -> get_or_create
    - None/""       -> None
    note ∈ {"created","exists"} quand créé/existant, sinon None
    """
    if val in (None, ""):
        return None, None

    maybe_id = _as_int(val)
    if maybe_id:
        obj = Marques.objects.filter(id=maybe_id).first()
        return (obj, "exists" if obj else None)

    name = str(val).strip()
    if not name:
        return None, None

    obj, created = Marques.objects.get_or_create(
        nom=name,
        defaults={"slug": slugify(name)}
    )
    return obj, ("created" if created else "exists")

def _resolve_couleur(val):
    """
    Résout une couleur à partir de :
      - un id (int / "12")
      - un nom ("Beige", "beige", " BEIGE ")
    en respectant la contrainte UNIQUE sur Couleurs.slug.
    """
    if val in (None, ""):
        return None

    # 1) id numérique ?
    maybe_id = _as_int(val)
    if maybe_id:
        return Couleurs.objects.filter(id=maybe_id).first()

    # 2) nom -> slug
    name = str(val).strip()
    if not name:
        return None

    slug = slugify(name)
    if not slug:
        return None

    # 3) On essaie d'abord de récupérer par slug ou nom__iexact
    existing = Couleurs.objects.filter(
        Q(slug=slug) | Q(nom__iexact=name)
    ).first()
    if existing:
        # Optionnel : si le nom est vide ou différent, on peut le rafraîchir
        if not existing.nom:
            existing.nom = name
            existing.save(update_fields=["nom"])
        return existing

    # 4) Sinon on crée ; si une autre requête a créé entre-temps,
    #    on rattrape l'IntegrityError et on relit.
    try:
        return Couleurs.objects.create(nom=name, slug=slug)
    except IntegrityError:
        return Couleurs.objects.filter(slug=slug).first()

def _clean_images_payload(images):
    """
    Accepte:
      - ["https://...jpg", ...] OU
      - [{url, alt_text?, position?, principale?}, ...]
    -> Nettoie, force une seule 'principale', normalise position->int|None
       et stocke l'URL en chemin relatif (uploads/...) pour éviter /media/media
    """
    out = []
    for it in (images or []):
        if isinstance(it, str):
            url_raw = it.strip()
            alt = ""
            pos = None
            principale = False
        elif isinstance(it, dict):
            url_raw = (it.get("url") or "").strip()
            alt = (it.get("alt_text") or "").strip()
            pos = it.get("position", None)
            try:
                pos = int(pos) if pos not in (None, "") else None
            except Exception:
                pos = None
            principale = bool(it.get("principale", False))
        else:
            continue

        # ✅ Remplacement ici : on stocke "uploads/..." (ou "" si vide)
        url = _strip_media(url_raw)
        if not url:
            continue

        out.append({
            "url": url,
            "alt_text": alt,
            "position": pos,
            "principale": principale,
        })

    if not out:
        return []

    # Forcer une seule principale (la première true sinon la 1ère image)
    if not any(x["principale"] for x in out):
        out[0]["principale"] = True
    else:
        seen = False
        for x in out:
            if x["principale"] and not seen:
                seen = True
            else:
                x["principale"] = False

    return out



def _parse_dt_local(s: str | None):
    """
    Accepte:
      - '2025-10-24' (date seule)
      - '2025-10-24T14:30' ou '2025-10-24T14:30:45'
      - '24/10/2025 14:30' ou '24/10/2025 14:30:45'
    Retourne un datetime aware (TZ serveur) ou None.
    """
    if not s:
        return None

    s = str(s).strip()

    # ✅ 1) date seule YYYY-MM-DD
    try:
        d = datetime.strptime(s, "%Y-%m-%d").date()
        dt = datetime.combine(d, time.min)  # 00:00
        return timezone.make_aware(dt, timezone.get_current_timezone())
    except ValueError:
        pass

    # ✅ 2) datetime formats
    for fmt in (
        "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S",
        "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S"
    ):
        try:
            dt = datetime.strptime(s, fmt)
            return timezone.make_aware(dt, timezone.get_current_timezone())
        except ValueError:
            continue

    return None

def _dtlocal(dt):
    if not dt:
        return None
    dt = timezone.localtime(dt)  # ✅ convertit en timezone locale
    return dt.strftime("%Y-%m-%dT%H:%M")  # ✅ format datetime-local



# ---------- Upload image ----------
class UploadProductImageView(APIView):
    """
    POST /christland/api/uploads/images/
    form-data:
      - file: <image>
      - alt_text: (optionnel)
    -> { url, alt_text }
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        f = request.FILES.get("file")
        if not f:
            return Response({"error": "Aucun fichier reçu (clé 'file')."}, status=400)

        name, ext = os.path.splitext(f.name)
        safe_name = slugify(name) or "image"
        unique = uuid.uuid4().hex[:8]
        rel_dir = "uploads/produits"
        rel_path = f"{rel_dir}/{safe_name}-{unique}{ext.lower()}"

        # assure le dossier
        full_dir = os.path.join(settings.MEDIA_ROOT, rel_dir)
        os.makedirs(full_dir, exist_ok=True)

        # sauvegarde (retourne path relatif depuis MEDIA_ROOT)
        saved_path = default_storage.save(rel_path, f)

        # construit URL absolue
        media_url = settings.MEDIA_URL.rstrip("/")
        abs_url = request.build_absolute_uri(f"{media_url}/{saved_path}")

        return Response({
            "url": abs_url,
            "alt_text": request.data.get("alt_text") or ""
        }, status=201)

# ---------- ATTRIBUTS: helpers génériques ----------
def _get_or_create_attr(code: str, type_hint: str | None = None, libelle: str | None = None, unite: str | None = None):
    """
    Récupère/Crée un Attribut par code. Si création:
    - type = type_hint ou TEXTE par défaut
    - libelle = libelle ou code
    - unite si fournie
    """
    code = (code or "").strip().lower()
    if not code:
        return None
    attr, created = Attribut.objects.get_or_create(
        code=code,
        defaults={
            "libelle": libelle or code.replace("_", " ").title(),
            "type": (type_hint if type_hint in dict(Attribut.TYPES) else Attribut.TEXTE),
            "unite": unite or "",
            "ordre": 0,
            "actif": True,
        },
    )
    # si déjà existant et on te donne une unite, on peut la compléter sans casser
    if not created and unite and not attr.unite:
        attr.unite = unite
        attr.save(update_fields=["unite"])
    return attr

def _upsert_valeur_choice(attr: Attribut, raw_value: str):
    """Crée/retourne ValeurAttribut pour un attribut CHOIX."""
    val = (str(raw_value or "")).strip()
    if not val:
        return None
    slug = slugify(val)[:140] or uuid.uuid4().hex[:8]
    va, _ = ValeurAttribut.objects.get_or_create(
        attribut=attr, slug=slug,
        defaults={"valeur": val},
    )
    return va

def _coerce_numeric(value):
    """Essaie de caster en int puis decimal, sans jamais laisser les deux à None."""
    if value is None or value == "":
        return None, None

    s = str(value).strip()

    iv = None
    dv = None

    # toujours tenter int
    try:
        iv = int(s)
    except Exception:
        iv = None

    # toujours tenter Decimal (même si int a marché)
    try:
        dv = Decimal(s)
    except InvalidOperation:
        dv = None

    return iv, dv

def _write_spec_produit(produit: Produits, attr: Attribut, raw_value):
    """
    Écrit/Met à jour SpecProduit selon le type de l'attribut.
    ⚠️ IMPORTANT :
      - si raw_value est vide / None / invalide -> on NE TOUCHE PAS à la spec existante
        (pas d'update, pas de delete)
    """

    # 👉 1) si aucune valeur envoyée -> on ne modifie rien
    if raw_value in (None, "", [], {}):
        return

    if attr.type == Attribut.CHOIX:
        va = _upsert_valeur_choice(attr, raw_value)
        if not va:
            return
        SpecProduit.objects.update_or_create(
            produit=produit,
            attribut=attr,
            defaults={
                "valeur_choice": va,
                "valeur_text": None,
                "valeur_int": None,
                "valeur_dec": None,
            },
        )

    elif attr.type in (Attribut.TEXTE, Attribut.BOOLEEN):
        # bool -> "true"/"false" en texte lisible
        if attr.type == Attribut.BOOLEEN:
            txt = str(bool(raw_value)).lower()
        else:
            txt = str(raw_value).strip()
            if txt == "":
                # valeur vide -> on ne change rien
                return

        SpecProduit.objects.update_or_create(
            produit=produit,
            attribut=attr,
            defaults={
                "valeur_text": txt,
                "valeur_choice": None,
                "valeur_int": None,
                "valeur_dec": None,
            },
        )

    else:
        # ENTIER / DECIMAL
        iv, dv = _coerce_numeric(raw_value)
        if iv is None and dv is None:
            # valeur numérique invalide -> ne rien faire
            return

        SpecProduit.objects.update_or_create(
            produit=produit,
            attribut=attr,
            defaults={
                "valeur_int": iv if attr.type == Attribut.ENTIER else None,
                "valeur_dec": dv if attr.type == Attribut.DECIMAL else None,
                "valeur_text": None,
                "valeur_choice": None,
            },
        )


def _write_spec_variante(variante: VariantesProduits, attr: Attribut, raw_value):
    """
    Idem pour SpecVariante.
    - ne modifie la spec que si une vraie valeur est envoyée
    """

    # 👉 1) si aucune valeur envoyée -> on ne modifie rien
    if raw_value in (None, "", [], {}):
        return

    if attr.type == Attribut.CHOIX:
        va = _upsert_valeur_choice(attr, raw_value)
        if not va:
            return
        SpecVariante.objects.update_or_create(
            variante=variante,
            attribut=attr,
            defaults={
                "valeur_choice": va,
                "valeur_text": None,
                "valeur_int": None,
                "valeur_dec": None,
            },
        )

    elif attr.type in (Attribut.TEXTE, Attribut.BOOLEEN):
        if attr.type == Attribut.BOOLEEN:
            txt = str(bool(raw_value)).lower()
        else:
            txt = str(raw_value).strip()
            if txt == "":
                return

        SpecVariante.objects.update_or_create(
            variante=variante,
            attribut=attr,
            defaults={
                "valeur_text": txt,
                "valeur_choice": None,
                "valeur_int": None,
                "valeur_dec": None,
            },
        )

    else:
        iv, dv = _coerce_numeric(raw_value)
        if iv is None and dv is None:
            return

        SpecVariante.objects.update_or_create(
            variante=variante,
            attribut=attr,
            defaults={
                "valeur_int": iv if attr.type == Attribut.ENTIER else None,
                "valeur_dec": dv if attr.type == Attribut.DECIMAL else None,
                "valeur_text": None,
                "valeur_choice": None,
            },
        )

def _validate_required_attributes(categorie: Categories | None, product_attrs: list[dict], variant_attrs: list[dict]):
    """
    Vérifie que tous les attributs marqués 'obligatoire=True' pour la catégorie
    sont bien présents soit côté produit, soit côté variante.
    """
    if not categorie:
        return None  # pas de catégorie -> on ne valide pas ici
    try:
        req = list(
            CategorieAttribut.objects
            .filter(categorie=categorie, obligatoire=True, attribut__actif=True)
            .select_related("attribut")
            .values_list("attribut__code", flat=True)
        )
    except Exception:
        return None

    if not req:
        return None

    present_codes = { (a.get("code") or "").strip().lower() for a in (product_attrs or []) } | \
                    { (a.get("code") or "").strip().lower() for a in (variant_attrs or []) }

    missing = [c for c in req if c not in present_codes]
    if missing:
        return f"Attribut(s) obligatoire(s) manquant(s): {', '.join(missing)}"
    return None



# ---------- Création produit + variante + images ----------
@method_decorator(csrf_exempt, name="dispatch")
class AddProductWithVariantView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    
    def post(self, request, *args, **kwargs):
        

        # ✅ Utiliser directement les données déjà parsées par DRF
        # (NE PLUS LIRE request.body)
        if isinstance(request.data, dict):
            payload = request.data.copy()
        else:
            # au cas où ce soit un QueryDict
            payload = dict(request.data)


        # ===== CATEGORIE / SOUS-CATEGORIE =====
        raw_sub = payload.get("sous_categorie")
        raw_cat = payload.get("categorie")

        categorie = None

        # 1) d'abord la sous-catégorie si envoyée
        if raw_sub:
            sub_id = _as_int(raw_sub)
            if sub_id:
                categorie = Categories.objects.filter(id=sub_id).first()
            else:
                categorie = Categories.objects.filter(slug=str(raw_sub).strip()).first()

        # 2) sinon on tombe en fallback sur categorie
        elif raw_cat:
            cat_id = _as_int(raw_cat)
            if cat_id:
                categorie = Categories.objects.filter(id=cat_id).first()
            else:
                categorie = Categories.objects.filter(slug=str(raw_cat).strip()).first()


        # ===== VALIDATIONS SIMPLES =====
        nom = (payload.get("nom") or "").strip()
        if not nom:
            return JsonResponse({"field": "nom", "error": "Le nom du produit est requis."}, status=400)
        # description courte (OBLIGATOIRE)
        description_courte = (payload.get("description_courte") or "").strip()
        if not description_courte:
            return JsonResponse(
                {"field": "description_courte", "error": "La description courte est requise."},
                status=400
            )

        # etat (neuf | reconditionné | occasion)
        etat_raw = (payload.get("etat") or "").strip().lower()
        if etat_raw in ("reconditionne", "reconditionné", "reconditionne'", "reconditionnee"):
            etat_value = "reconditionné"
        elif etat_raw in ("neuf",):
            etat_value = "neuf"
        elif etat_raw in ("occasion",):
            etat_value = "occasion"
        else:
            etat_value = "neuf"

        raw_visible = payload.get("visible", 1)
        try:
            visible = int(raw_visible)
        except (TypeError, ValueError):
            visible = 1

        if visible not in (0, 1):
            return JsonResponse(
                {"field": "visible", "error": "Visible doit être 1 (oui) ou 0 (non)."},
                status=400
            )


        # ===== VARIANTS =====
        variants_payload = payload.get("variants") or []

        # rétro-compatibilité : si pas de "variants", on construit une seule variante
        if not variants_payload:
            variants_payload = [{
                "nom": payload.get("variante_nom") or nom,
                "sku": payload.get("sku"),
                "code_barres": payload.get("code_barres"),
                "prix": payload.get("prix"),
                "prix_promo": payload.get("prix_promo"),
                "promo_active": payload.get("promo_active"),
                "promo_debut": payload.get("promo_debut"),
                "promo_fin": payload.get("promo_fin"),
                "stock": payload.get("stock"),
                "couleur": payload.get("couleur"),
                "variante_poids_grammes": payload.get("variante_poids_grammes"),
                "variante_est_actif": payload.get("variante_est_actif", True),
                "prix_achat": payload.get("prix_achat"),
                "attributes": payload.get("variant_attributes") or [],
            }]

        # au moins une variante
        if not variants_payload:
            return JsonResponse(
                {"field": "variants", "error": "Au moins une variante est requise."},
                status=400
            )

        # chaque variante doit avoir un prix
        for idx, v in enumerate(variants_payload, start=1):
            if v.get("prix") in (None, ""):
                return JsonResponse(
                    {
                        "field": f"variants[{idx-1}].prix",
                        "error": "Le prix est requis pour chaque variante."
                    },
                    status=400
                )



        marque_raw = payload.get("marque", None)
        if not marque_raw:
            return JsonResponse({"field": "marque", "error": "La marque est requise."}, status=400)

        # ⚠️ NE *PAS* RÉÉCRASER categorie ICI (on garde celle trouvée juste au-dessus)
        # # catégorie (facultatif)
        # categorie = None
        # if payload.get("categorie"):
        #     categorie = Categories.objects.filter(id=_as_int(payload["categorie"])).first()

        # ===== COULEUR (facultatif) =====
        couleur = _resolve_couleur(payload.get("couleur"))
        if couleur:
            attr_couleur, _ = Attribut.objects.get_or_create(
                code="couleur",
                defaults={
                    "libelle": "Couleur",
                    "type": Attribut.CHOIX,
                    "ordre": 0,
                    "actif": True,
                },
            )
            ValeurAttribut.objects.get_or_create(
                attribut=attr_couleur,
                slug=(couleur.slug or slugify(couleur.nom or ""))[:140],
                defaults={"valeur": couleur.nom or ""},
            )

        # ===== IMAGES =====
        images_clean = _clean_images_payload(payload.get("images"))
        if not images_clean:
            return JsonResponse({"field": "images", "error": "Au moins une image est requise."}, status=400)

        # ===== MARQUE =====
        marque, marque_note = _resolve_marque_verbose(marque_raw)
        if not marque:
            return JsonResponse({"field": "marque", "error": "Marque introuvable/invalid."}, status=400)
        
        # ===== VÉRIFIER SI LE PRODUIT EXISTE DÉJÀ (même nom + même marque + même catégorie) =====
        duplicate_msg = (
            "Un produit avec ce nom existe déjà. "
            "Veuillez le modifier dans la liste des produits "
            "si vous avez de nouveaux éléments à ajouter."
        )

        existing_qs = Produits.objects.filter(nom__iexact=nom)

        # si on a réussi à résoudre la marque, on filtre aussi par marque
        if marque:
            existing_qs = existing_qs.filter(marque=marque)

        # si une catégorie est trouvée, on filtre aussi par catégorie
        if categorie:
            existing_qs = existing_qs.filter(categorie=categorie)

        if existing_qs.exists():
            return JsonResponse({"error": duplicate_msg}, status=400)
        

        # ===== SLUG PRODUIT =====
               # ===== SLUG PRODUIT =====
        raw_slug = (payload.get("slug") or "").strip()
        slug = slugify(raw_slug or nom) or "produit"


        # ===== CHAMPS VARIANTE SUPPLÉMENTAIRES =====
        promo_debut = _parse_dt_local(payload.get("promo_debut"))
        promo_fin   = _parse_dt_local(payload.get("promo_fin"))
        prix_achat  = payload.get("prix_achat") or None
        var_poids   = payload.get("variante_poids_grammes") or None
        var_actif   = bool(payload.get("variante_est_actif", True))

        try:
            with transaction.atomic():
                # ---------- PRODUIT ----------
                produit = Produits.objects.create(
                    nom=nom,
                    slug=slug,
                     description_courte=description_courte,
                    description_long=payload.get("description_long", "") or "",
                    garantie_mois=payload.get("garantie_mois") or None,
                    poids_grammes=payload.get("poids_grammes") or None,
                    dimensions=payload.get("dimensions", "") or "",
                    categorie=categorie,   # ✅ on garde la catégorie trouvée (id ou slug)
                    marque=marque,
                    est_actif=_to_bool(payload.get("est_actif"), default=False),
                    visible=(visible if visible in (0, 1) else 1),
                    etat=etat_value,
                )
                log_dashboard_action(
                    request,
                    produit,
                    DashboardActionLog.ACTION_CREATE,
                    after={"id": produit.pk, "nom": produit.nom, "slug": produit.slug}
                )

                variants_payload = payload.get("variants") or []

                # rétro-compatibilité : si pas de "variants", on construit une seule variante
                if not variants_payload:
                    variants_payload = [{
                        "nom": payload.get("variante_nom") or nom,
                        "sku": payload.get("sku"),
                        "code_barres": payload.get("code_barres"),
                        "prix": payload.get("prix"),
                        "prix_promo": payload.get("prix_promo"),
                        "promo_active": payload.get("promo_active"),
                        "promo_debut": payload.get("promo_debut"),
                        "promo_fin": payload.get("promo_fin"),
                        "stock": payload.get("stock"),
                        "couleur": payload.get("couleur"),
                        "variante_poids_grammes": payload.get("variante_poids_grammes"),
                        "variante_est_actif": payload.get("variante_est_actif", True),
                        "prix_achat": payload.get("prix_achat"),
                        "attributes": payload.get("variant_attributes") or [],
                    }]

                # ---------- IMAGES ----------
                for i, img in enumerate(images_clean, start=1):
                    ImagesProduits.objects.create(
                        produit=produit,
                        url=img["url"],
                        alt_text=img.get("alt_text", "") or "",
                        position=img.get("position", None) or i,
                        principale=bool(img.get("principale", False)),
                    )

                                # ---------- ATTRIBUTS: validation "obligatoire" ----------
                product_attrs = payload.get("product_attributes") or []

                # on agrège les attributs de TOUTES les variantes
                variant_attrs_all = []
                for v in variants_payload:
                    variant_attrs_all.extend(v.get("attributes") or [])

                miss_msg = _validate_required_attributes(categorie, product_attrs, variant_attrs_all)

                if miss_msg:
                    raise IntegrityError(miss_msg)

                # ---------- ATTRIBUTS PRODUIT ----------
                for item in product_attrs:
                    code = (item.get("code") or "").strip().lower()
                    if not code:
                        continue
                    type_hint = item.get("type")
                    libelle = item.get("libelle")
                    unite   = item.get("unite")
                    value   = item.get("value")

                    attr = _get_or_create_attr(code, type_hint, libelle, unite)
                    if not attr or not attr.actif:
                        continue
                    _write_spec_produit(produit, attr, value)

                             # ---------- VARIANTES (plusieurs) ----------
                variantes_creees = []

                for v in variants_payload:
                    v_nom    = v.get("nom") or nom
                    v_sku    = v.get("sku") or None
                    v_code   = v.get("code_barres") or ""
                    v_prix   = v.get("prix")
                    v_promo  = v.get("prix_promo") or None
                    v_pa     = v.get("prix_achat") or None
                    v_stock  = v.get("stock") or 0
                    v_poids  = v.get("variante_poids_grammes") or None
                    v_actif  = _to_bool(v.get("variante_est_actif"), default=True)
                    v_promo_debut = _parse_dt_local(v.get("promo_debut"))
                    v_promo_fin   = _parse_dt_local(v.get("promo_fin"))

                    v_couleur = _resolve_couleur(v.get("couleur"))

                    variante = VariantesProduits.objects.create(
                        produit=produit,
                        nom=v_nom,
                        sku=v_sku,
                        code_barres=v_code,
                        prix=v_prix,
                        prix_promo=v_promo,
                        promo_active=_to_bool(v.get("promo_active"), default=False),
                        promo_debut=v_promo_debut,
                        promo_fin=v_promo_fin,
                        stock=v_stock,
                        couleur=v_couleur,
                        poids_grammes=v_poids,
                        prix_achat=v_pa,
                        est_actif=v_actif,
                    )
                    variantes_creees.append(variante)

                    # ---------- ATTRIBUTS VARIANTE (pour CETTE variante) ----------
                    for item in v.get("attributes") or []:
                        code = (item.get("code") or "").strip().lower()
                        if not code:
                            continue
                        if code == "couleur" and variante.couleur_id:
                            # pas de doublon "couleur"
                            continue

                        type_hint = item.get("type")
                        libelle   = item.get("libelle")
                        unite     = item.get("unite")
                        value     = item.get("value")

                        attr = _get_or_create_attr(code, type_hint, libelle, unite)
                        if not attr or not attr.actif:
                            continue
                        _write_spec_variante(variante, attr, value)

                    # ---------- MIROIR ATTRIBUT "couleur" ----------
                    if variante.couleur_id:
                        attr_couleur = _get_or_create_attr("couleur", Attribut.CHOIX, "Couleur")
                        va_couleur   = _upsert_valeur_choice(attr_couleur, variante.couleur.nom)
                        SpecVariante.objects.update_or_create(
                            variante=variante, attribut=attr_couleur,
                            defaults={
                                "valeur_choice": va_couleur,
                                "valeur_text": None,
                                "valeur_int": None,
                                "valeur_dec": None,
                            },
                        )


            return JsonResponse(
                {
                    "ok": True,
                    "message": "Votre produit a bien été enregistré.",
                    "produit_id": produit.id,
                    "variante_ids": [v.id for v in variantes_creees],
                    "notes": {
                        "marque_message": (
                            "Marque créée." if (marque_note == "created")
                            else "Marque existante." if (marque_note == "exists")
                            else ""
                        )
                    },
                },
                status=201,
            )

        except IntegrityError as ie:
            field, human = _integrity_to_field_error(ie)
            payload_err = {
                "error": "Erreur de données",
                "detail": human or str(ie),
            }
            if field:
                payload_err["field"] = field
                payload_err["field_errors"] = {field: human}
            return JsonResponse(payload_err, status=400)


class ProductClickView(APIView):
    """
    POST /christland/api/catalog/products/<pk>/click/
    -> { ok: True, count: <nouvelle valeur> }
    Incrémente le compteur quand un utilisateur clique sur "Commander".
    """
    permission_classes = [AllowAny]
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx 
    
    def post(self, request, pk: int):
        prod = get_object_or_404(Produits.objects.all(), pk=pk)
        Produits.objects.filter(pk=prod.pk).update(commande_count=F('commande_count') + 1)
        prod.refresh_from_db(fields=['commande_count'])
        return Response({"ok": True, "count": prod.commande_count}, status=200)


class ProductPublicDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        prod = get_object_or_404(
            Produits.objects.filter(est_actif=True, visible=1, is_deleted=False)
            .select_related("categorie", "marque")
            .prefetch_related("images", "variantes"),
            slug=slug
        )

        img = prod.images.filter(principale=True).first() or prod.images.order_by("position", "id").first()

        data = {
            "id": prod.id,
            "slug": prod.slug,
            "nom": prod.nom,
            "description_courte": prod.description_courte,
            "description_long": prod.description_long,
            "image": _abs_media(request, img.url if img else None),
        }
        return Response(data)



class MostDemandedProductsView(APIView):
    """
    GET /christland/api/catalog/products/most-demanded/?limit=2
    -> [ {id, slug, nom, image, price, count}, ... ]
    """
    permission_classes = [AllowAny]          # ← rendu public
    authentication_classes = []   
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx 
    
    def get(self, request):
        limit = int(request.query_params.get("limit", 2))
        qs = Produits.objects.filter(est_actif=True, visible=1 , is_deleted=False)\
                             .select_related("marque", "categorie")\
                             .prefetch_related("images", "variantes")\
                             .order_by("-commande_count", "-id")[:limit]

        serializer = ProduitCardSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)      
    


def _prod_img(request, produit):
    img = produit.images.filter(principale=True).first() or produit.images.first()
    return _abs_media(request, getattr(img, "url", None)) if img else None

    
class AdminGlobalSearchView(APIView):
    """
    GET /christland/api/dashboard/search/?q=...&page=1&page_size=10
    - Produits: filtre SUR 'nom' uniquement
    - Articles: filtre SUR 'titre' OU 'extrait' OU 'contenu'
    - Les autres champs sont juste renvoyés (affichage)
    """

    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if not q:
            return Response({
                "count": 0,
                "next": None,
                "previous": None,
                "results": [],
            })

        # -------- Pagination safe --------
        try:
            page = max(1, int(request.query_params.get("page") or 1))
        except ValueError:
            page = 1
        try:
            page_size = max(1, min(50, int(request.query_params.get("page_size") or 10)))
        except ValueError:
            page_size = 10

        # -------- Produits: filtre UNIQUEMENT sur nom --------
        pqs = (
            Produits.objects
            .select_related("marque", "categorie")
            .prefetch_related("images", "variantes")
            .filter(Q(nom__icontains=q))              # 👈 uniquement nom
            .order_by("-cree_le", "-id")              # modifie_le n'existe pas -> on garde cree_le
        )

        prod_items = []
        for p in pqs[:200]:
            prod_items.append({
                "type": "product",
                "id": p.id,
                "title": p.nom or "",
                "excerpt": (p.description_courte or "")[:220],  # affichage seulement
                "image": _prod_img(request, p),
                "url": f"/Dashboard/Modifier/{p.id}",
                "created_at": getattr(p, "cree_le", None),
                "updated_at": None,
                "brand": getattr(p.marque, "nom", None),
                "category": getattr(p.categorie, "nom", None),
            })

        # -------- Articles: filtre sur titre OU extrait OU contenu --------
        axs = (
            ArticlesBlog.objects
            .filter(
                Q(titre__icontains=q) |
                Q(extrait__icontains=q) |
                Q(contenu__icontains=q)
            )
            .order_by("-modifie_le", "-cree_le", "-id")
        )

        article_items = []
        for a in axs[:200]:
            article_items.append({
                "type": "article",
                "id": a.id,
                "title": a.titre or "",
                "excerpt": (a.extrait or "")[:220],
                "image": _abs_media(request, getattr(a, "image_couverture", None)),
                "url": f"/Dashboard/Articles/{a.id}/edit",
                "created_at": getattr(a, "cree_le", None),
                "updated_at": getattr(a, "modifie_le", None),
            })

        # -------- Fusion + tri (updated, sinon created) --------
        items = prod_items + article_items

        def _key(x):
            ts = x.get("updated_at") or x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
            return (ts, x["id"])

        items.sort(key=_key, reverse=True)

        # -------- Pagination manuelle --------
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        results = items[start:end]

        base = request.build_absolute_uri(request.path)
        qs = request.GET.copy()
        qs["page_size"] = str(page_size)

        def _page_url(n):
            if n < 1 or (n - 1) * page_size >= total:
                return None
            qs["page"] = str(n)
            return f"{base}?{qs.urlencode()}"

        return Response({
            "count": total,
            "next": _page_url(page + 1),
            "previous": _page_url(page - 1),
            "results": results,
        }, status=status.HTTP_200_OK)


class DashboardStatsView(APIView):
    """
    GET /christland/api/dashboard/stats/

    Réponse:
    {
      "users": 123,               # nb d'utilisateurs
      "products_stock": 456,      # somme des stocks sur VariantesProduits.stock
      "products": 78,             # (optionnel) nombre de Produits (distinct produits)
      "articles": 12,             # nb d'articles blog
      "messages": 34              # nb de messages contact
    }
    """
   
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    
    def get(self, request):
            users_count = Utilisateurs.objects.count()
            articles_count = ArticlesBlog.objects.filter(is_deleted=False).count()
            messages_count = MessagesContact.objects.count()

            products_count = Produits.objects.filter(is_deleted=False).count()

            stock_total = (
                VariantesProduits.objects
                .filter(produit__is_deleted=False)
                .aggregate(total=Coalesce(Sum("stock"), 0))["total"]
            ) or 0

            data = {
                "users": users_count,
                "products": products_count,          # ✅ nombre de produits
                "products_stock": int(stock_total),  # ✅ stock total
                "articles": articles_count,
                "messages": messages_count,
            }
            return Response(data, status=status.HTTP_200_OK)  
 # --------------------------------------------------------------------
# Permissions
# --------------------------------------------------------------------
class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = getattr(request, "user", None)
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "admin")


# --------------------------------------------------------------------
# Register (admin only)
# POST /christland/api/dashboard/auth/register/
# body: { email, password, prenom?, nom? }
# --------------------------------------------------------------------
class RegisterView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]  # on laisse AllowAny, on gère la logique dedans
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    
    @csrf_exempt
    def post(self, request):
        already_has_admin = Utilisateurs.objects.filter(role="admin", actif=True).exists()
        if already_has_admin:
            u = getattr(request, "user", None)
            if not u or getattr(u, "role", "") != "admin":
                return Response({"detail": "Permission refusée."}, status=403)
        
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        prenom = (request.data.get("prenom") or "").strip()
        nom = (request.data.get("nom") or "").strip()

        if not email or not password:
            return Response({"detail": "Email et mot de passe requis."},
                            status=status.HTTP_400_BAD_REQUEST)

        if Utilisateurs.objects.filter(email=email).exists():
            return Response({"detail": "Cet email est déjà utilisé."},
                            status=status.HTTP_400_BAD_REQUEST)

        # y a-t-il déjà au moins un admin ?
        already_has_admin = Utilisateurs.objects.filter(role="admin", actif=True).exists()

        # si un admin existe, il faut être authentifié ET admin pour créer un autre admin
        if already_has_admin:
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                return Response({"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED)
            if getattr(user, "role", None) != "admin":
                return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)

        # => crée un ADMIN (comme tu le souhaites)
        u = Utilisateurs.objects.create(
            email=email,
            mot_de_passe_hash=make_password(password),
            prenom=prenom, nom=nom,
            actif=True, role="admin",
            cree_le=timezone.now(), modifie_le=timezone.now(),
        )
        return Response({
            "user": {"id": u.id, "email": u.email, "prenom": u.prenom, "nom": u.nom, "role": u.role}
        }, status=status.HTTP_201_CREATED)


# --------------------------------------------------------------------
# Refresh token -> new access
# POST /christland/api/dashboard/auth/refresh/
# body: { refresh }
# --------------------------------------------------------------------
class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    @csrf_exempt
    def post(self, request):
        token = (request.data.get("refresh") or "").strip()
        payload = decode_jwt_raw(token)  # ⬅️ on décode le JWT brut
        if not payload or payload.get("typ") != "refresh":
            return Response({"detail": "Refresh token invalide."}, status=status.HTTP_401_UNAUTHORIZED)

        uid = payload.get("uid")
        user = Utilisateurs.objects.filter(id=uid, actif=True).first()
        if not user:
            return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_401_UNAUTHORIZED)

        new_access = make_access_token(user)
        return Response({"access": new_access}, status=status.HTTP_200_OK)


# --------------------------------------------------------------------
# Login -> access + refresh
# POST /christland/api/dashboard/auth/login/
# body: { email, password }
# --------------------------------------------------------------------
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @csrf_exempt
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        if not email or not password:
            return Response({"detail": "Email et mot de passe requis."},
                            status=status.HTTP_400_BAD_REQUEST)

        user = Utilisateurs.objects.filter(email__iexact=email, actif=True).first()
        if not user or not user.mot_de_passe_hash:
            return Response({"detail": "Identifiants invalides."},
                            status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, user.mot_de_passe_hash):
            return Response({"detail": "Identifiants invalides."},
                            status=status.HTTP_401_UNAUTHORIZED)

        access = make_access_token(user)
        refresh = make_refresh_token(user)

        return Response({
            "access": access,
            "refresh": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "prenom": user.prenom,
                "nom": user.nom,
                "role": user.role,
            }
        }, status=status.HTTP_200_OK)


# --------------------------------------------------------------------
# Me (profil courant)
# GET /christland/api/dashboard/auth/me/
# --------------------------------------------------------------------
class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        u = request.user
        return Response({
            "id": u.id,
            "email": u.email,
            "prenom": u.prenom,
            "nom": u.nom,
            "role": u.role,
        }, status=status.HTTP_200_OK)

# ==========================
#   CATEGORIES - DASHBOARD
# ==========================

from django.db import IntegrityError
from django.utils import timezone
from django.utils.text import slugify
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

class DashboardCategoryListCreateView(generics.ListCreateAPIView):
    """
    GET  /christland/api/dashboard/categories/manage/
    POST /christland/api/dashboard/categories/manage/
    """
    queryset = Categories.objects.all().order_by("position", "cree_le", "id")
    serializer_class = CategoryDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()

        include_deleted = str(request.query_params.get("include_deleted") or "").lower() in ("1","true","yes")
        qs = Categories.objects.all()
        if not include_deleted:
            qs = qs.filter(is_deleted=False)

        qs = qs.order_by("position", "cree_le", "id")

        if q:
            qs = qs.filter(
                Q(nom__icontains=q) |
                Q(description__icontains=q)
            )

        paginator = SmallPagination()
        page = paginator.paginate_queryset(qs, request, view=self)

        rows = []
        for c in page:
            rows.append({
                "id": c.id,
                "nom": c.nom or "",
                "slug": c.slug or "",
                "description": c.description or "",
                "est_actif": bool(c.est_actif),
                "parent_id": c.parent_id,
                "parent_nom": c.parent.nom if c.parent_id else "",
                "position": c.position,
            })

        return paginator.get_paginated_response(rows)

    def post(self, request, *args, **kwargs):
        nom = (request.data.get("nom") or "").strip()
        description = (request.data.get("description") or "").strip()
        est_actif = bool(request.data.get("est_actif", False))
        position = request.data.get("position")  # peut être null / vide
        image_val = None
 
        # parent: on accepte "parent" ou "parent_id"
        parent_id = request.data.get("parent") or request.data.get("parent_id")
        parent = None
        if parent_id:
            try:
                parent = Categories.objects.get(pk=int(parent_id))
            except (Categories.DoesNotExist, ValueError, TypeError):
                return Response(
                    {"field": "parent", "error": "Catégorie parente invalide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not nom:
            return Response(
                {"field": "nom", "error": "Le nom de la catégorie est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ Vérifier si une catégorie avec ce NOM existe déjà
        # (insensible à la casse, à adapter si tu veux par parent)
# 1️⃣ catégorie ACTIVE déjà existante → bloquer
        existing_active = Categories.objects.filter(
            nom__iexact=nom,
            is_deleted=False
        ).first()

        if existing_active:
            return Response(
                {
                    "field": "nom",
                    "error": f"Cette catégorie existe déjà (« {nom} »).",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2️⃣ catégorie SUPPRIMÉE existante → on la RESTAURE
        existing_deleted = Categories.objects.filter(
            nom__iexact=nom,
            is_deleted=True
        ).first()

        if existing_deleted:
            slug_val = slugify(nom)

            existing_deleted.nom = nom
            existing_deleted.slug = slug_val
            existing_deleted.description = description
            existing_deleted.est_actif = est_actif
            existing_deleted.parent = parent
            existing_deleted.position = position
            if image_val:
                existing_deleted.image_url = image_val

            existing_deleted.is_deleted = False
            existing_deleted.deleted_at = None
            existing_deleted.deleted_by = None
            existing_deleted.save()

            log_dashboard_action(
                request,
                existing_deleted,
                DashboardActionLog.ACTION_RESTORE,
                after={"id": existing_deleted.pk, "nom": existing_deleted.nom}
            )

            return Response(
                {
                    "id": existing_deleted.id,
                    "nom": existing_deleted.nom,
                    "slug": existing_deleted.slug or "",
                    "description": existing_deleted.description,
                    "est_actif": existing_deleted.est_actif,
                    "image_url": _abs_media(request, existing_deleted.image_url) or "",
                    "parent_id": existing_deleted.parent_id,
                    "parent_nom": existing_deleted.parent.nom if existing_deleted.parent_id else "",
                    "position": existing_deleted.position,
                },
                status=status.HTTP_200_OK,
            )


        # ✅ slug automatique, mais SANS contrainte d'unicité
        slug_val = slugify(nom)

        # 🔹 Normaliser l'image (optionnelle pour parent ET sous-catégorie)
        raw_image = request.data.get("image_url")
        image_val = _strip_media(raw_image)  # stocke "uploads/..."

        # ✅ Image obligatoire si c'est une catégorie PARENTE (pas de parent)
        if parent is None and not image_val:
            return Response(
                {"field": "image_url", "error": "Veuillez renseigner une image pour cette catégorie."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # (optionnel) si tu veux stocker "" quand vide (si autorisé par le modèle)
        if not image_val:
            image_val = ""

        # Ici plus besoin d'IntegrityError pour l'unicité du slug/nom
        cat = Categories.objects.create(
            nom=nom,
            slug=slug_val,
            description=description,
            est_actif=est_actif,
            parent=parent,
            position=position,
            cree_le=timezone.now(),
            image_url=image_val,
        )
        log_dashboard_action(
            request,
            cat,
            DashboardActionLog.ACTION_CREATE,
            after={"id": cat.pk, "nom": cat.nom, "slug": cat.slug, "parent_id": cat.parent_id}
        )

        return Response(
            {   
                "id": cat.id,
                "nom": cat.nom,
                "slug": cat.slug or "",
                "description": cat.description,
                "est_actif": cat.est_actif,
                "image_url": _abs_media(request, cat.image_url) or "",
                "parent_id": cat.parent_id,
                "parent_nom": cat.parent.nom if cat.parent_id else "",
                "position": cat.position,
            },
            status=status.HTTP_201_CREATED,
        )

class DashboardCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /christland/api/dashboard/categories/manage/<id>/
    PUT    /christland/api/dashboard/categories/manage/<id>/
    DELETE /christland/api/dashboard/categories/manage/<id>/
    """
    queryset = Categories.objects.all()
    serializer_class = CategoryDashboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get_object(self):
        pk = self.kwargs.get("pk")
        include_deleted = str(self.request.query_params.get("include_deleted") or "").lower() in ("1", "true", "yes")
        qs = Categories.objects.all()
        if not include_deleted:
            qs = qs.filter(is_deleted=False)
        return get_object_or_404(qs, pk=pk)

    def get(self, request, pk: int):
        c = self.get_object()
        return Response(
            {
                "id": c.id,
                "nom": c.nom or "",
                "description": c.description or "",
                "slug": c.slug or "",
                "est_actif": bool(c.est_actif),
                "parent_id": c.parent_id,
                "parent_nom": c.parent.nom if c.parent_id else "",
                "position": c.position,
                "image_url": _abs_media(request, getattr(c, "image_url", None)) or "",

            }
        )

    def perform_update(self, serializer):
        """
        ✅ Correction : on utilise obj (pas updated) dans before,
        puis on save, puis on log.
        """
        obj = self.get_object()

        before = {
            "id": obj.pk,
            "nom": getattr(obj, "nom", None),
            "description": getattr(obj, "description", None),
            "slug": getattr(obj, "slug", None),
            "parent_id": getattr(obj, "parent_id", None),
            "position": getattr(obj, "position", None),
            "image_url": getattr(obj, "image_url", None),
            "is_deleted": getattr(obj, "is_deleted", None),
        }

        updated = serializer.save()

        after = {
            "id": updated.pk,
            "nom": getattr(updated, "nom", None),
            "description": getattr(updated, "description", None),
            "slug": getattr(updated, "slug", None),
            "parent_id": getattr(updated, "parent_id", None),
            "position": getattr(updated, "position", None),
            "image_url": getattr(updated, "image_url", None),
            "is_deleted": getattr(updated, "is_deleted", None),
        }

        # ✅ Log update
        log_dashboard_action(self.request, updated, DashboardActionLog.ACTION_UPDATE, before=before, after=after)

    def put(self, request, pk: int):
        c = self.get_object()

        # ---------- BEFORE (log) ----------
        before = {
            "id": c.pk,
            "nom": c.nom,
            "slug": c.slug,
            "description": c.description,
            "parent_id": c.parent_id,
            "position": c.position,
            "image_url": getattr(c, "image_url", None),
            "is_deleted": c.is_deleted,
        }

        nom = (request.data.get("nom") or "").strip()
        description = (request.data.get("description") or "").strip()
        est_actif = bool(request.data.get("est_actif", False))

        # position
        position_raw = request.data.get("position")
        if position_raw not in (None, ""):
            try:
                c.position = int(position_raw)
            except (TypeError, ValueError):
                return Response(
                    {"field": "position", "error": "La position doit être un nombre entier."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            c.position = None

        # parent
        parent_id = request.data.get("parent") or request.data.get("parent_id")
        parent = None
        if parent_id not in (None, ""):
            try:
                parent = Categories.objects.get(pk=int(parent_id))
            except (Categories.DoesNotExist, ValueError, TypeError):
                return Response(
                    {"field": "parent", "error": "Catégorie parente invalide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if parent.id == c.id:
                return Response(
                    {"field": "parent", "error": "Une catégorie ne peut pas être son propre parent."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not nom:
            return Response(
                {"field": "nom", "error": "Le nom de la catégorie est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # slug unique
        slug_val = slugify(nom)
        if Categories.objects.filter(slug=slug_val).exclude(pk=c.pk).exists():
            return Response(
                {
                    "field": "nom",
                    "error": (
                        f"Une catégorie avec ce nom existe déjà (« {nom} »). "
                        "Veuillez choisir un autre nom."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # image reçue ?
        raw_image = request.data.get("image_url", None)
        new_image = None
        if raw_image is not None:
            new_image = _strip_media(raw_image)  # stocke "uploads/..." ou ""

        if raw_image is not None:
            # si user a envoyé vide => on garde l'ancienne (ne pas effacer)
            if new_image:
                c.image_url = new_image

        # ✅ Image obligatoire si catégorie PARENTE (parent=None)
        # (donc si elle est parent actuellement OU si elle devient parent)
        will_be_parent = (parent is None)
        current_image = getattr(c, "image_url", None)

        if will_be_parent:
            if not (new_image or current_image):
                return Response(
                    {"field": "image_url", "error": "Veuillez renseigner une image pour cette catégorie parente."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # ✅ Image obligatoire si SOUS-CATEGORIE
            if not (new_image or current_image):
                return Response(
                    {"field": "image_url", "error": "Veuillez renseigner une image pour cette sous-catégorie."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # apply
        c.nom = nom
        c.description = description
        c.est_actif = est_actif
        c.parent = parent
        c.slug = slug_val or c.slug

        if raw_image is not None:
            # si user a envoyé vide => on garde l'ancienne (ne pas effacer)
            if new_image:
                c.image_url = new_image

        c.save()

        # ---------- AFTER (log) ----------
        c.refresh_from_db()
        after = {
            "id": c.pk,
            "nom": c.nom,
            "slug": c.slug,
            "description": c.description,
            "parent_id": c.parent_id,
            "position": c.position,
            "image_url": _abs_media(request, getattr(c, "image_url", None)) or "",
            "is_deleted": c.is_deleted,
        }

        # ✅ Log update (PUT)
        log_dashboard_action(request, c, DashboardActionLog.ACTION_UPDATE, before=before, after=after)

        return Response(
            {
                "id": c.id,
                "nom": c.nom,
                "slug": c.slug or "",
                "description": c.description,
                "est_actif": c.est_actif,
                "parent_id": c.parent_id,
                "parent_nom": c.parent.nom if c.parent_id else "",
                "position": c.position,
                "image_url": _abs_media(request, getattr(c, "image_url", None)) or "",

            },
            status=status.HTTP_200_OK,
        )
    def patch(self, request, pk: int):
        c = self.get_object()
        serializer = CategoryDashboardSerializer(c, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=200)
    def delete(self, request, pk: int):
        c = self.get_object()

        # 👉 récupérer l'ID de la catégorie + tous ses descendants
        def collect_ids(cat):
            ids = [cat.id]
            for child in Categories.objects.filter(parent=cat):
                ids.extend(collect_ids(child))
            return ids

        cat_ids = collect_ids(c)

        # 1️⃣ Produits dans la catégorie OU dans une sous-catégorie
        if Produits.objects.filter(categorie_id__in=cat_ids, is_deleted=False).exists():
            return Response(
                {
                    "error": (
                        "Impossible de supprimer cette catégorie car des produits y sont rattachés. "
                        "Veuillez d’abord supprimer ou déplacer ces produits vers une autre catégorie."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2️⃣ Sous-catégories restantes
        if Categories.objects.filter(parent=c, is_deleted=False).exists():
            return Response(
                {"error": "Impossible de supprimer une catégorie qui possède des sous-catégories."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------- BEFORE (log) ----------
        before = {
            "id": c.pk,
            "nom": c.nom,
            "slug": c.slug,
            "is_deleted": c.is_deleted,
        }

        # 3️⃣ OK -> soft delete
        _soft_delete(c, user=request.user)
        c.refresh_from_db(fields=["is_deleted", "deleted_at", "deleted_by"])

        # ---------- AFTER (log) ----------
        after = {
            "id": c.pk,
            "nom": c.nom,
            "slug": c.slug,
            "is_deleted": c.is_deleted,
            "deleted_at": str(getattr(c, "deleted_at", None)),
            "deleted_by_id": getattr(c, "deleted_by_id", None),
        }

        # ✅ Log delete
        log_dashboard_action(request, c, DashboardActionLog.ACTION_DELETE, before=before, after=after)
         
        cache.clear() 
        return Response({"ok": True, "message": "Catégorie supprimée (soft delete)."}, status=status.HTTP_200_OK)

class DashboardCategoryRestoreView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, pk: int):
        c = get_object_or_404(Categories.objects.all(), pk=pk)

        before = {
            "is_deleted": getattr(c, "is_deleted", None),
            "deleted_at": getattr(c, "deleted_at", None),
            "deleted_by_id": getattr(c, "deleted_by_id", None),
        }

        _soft_restore(c)
        c.refresh_from_db()

        after = {
            "is_deleted": getattr(c, "is_deleted", None),
            "deleted_at": getattr(c, "deleted_at", None),
            "deleted_by_id": getattr(c, "deleted_by_id", None),
        }

        try:
            log_dashboard_action(
                request=request,
                action=DashboardActionLog.ACTION_RESTORE,
                target=c,
                before=before,
                after=after,
            )
        except Exception:
            pass

        return Response({"ok": True, "message": "Catégorie restaurée."}, status=200)



class DashboardCategoriesSelectView(APIView):
    """
    GET /christland/api/dashboard/categories/select/
    -> [
         { "id": 1, "nom": "Informatique", "slug": "informatique", "parent_id": null },
         { "id": 2, "nom": "Ordinateurs portables", "slug": "ordinateurs-portables", "parent_id": 1 },
         ...
       ]
    ⚠️ AUCUNE TRADUCTION : on renvoie exactement les champs FR de la base.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()

        qs = Categories.objects.filter(is_deleted=False).order_by("nom")

        if q:
            qs = qs.filter(
                Q(nom__icontains=q) |
                Q(description__icontains=q)
            )

        data = [
            {
                "id": c.id,
                "nom": c.nom or "",
                "slug": c.slug or "",
                "parent_id": c.parent_id,
            }
            for c in qs
        ]
        return Response(data)
class DashboardCategoriesTreeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        qs = Categories.objects.filter(is_deleted=False).order_by("nom")

        by_id: dict[int, dict] = {}
        for c in qs:
            by_id[c.id] = {
                "id": c.id,
                "nom": c.nom or "",
                "slug": c.slug or "",
                "parent_id": c.parent_id,
                "children": [],
            }

        roots: list[dict] = []
        for c in qs:
            item = by_id[c.id]
            if c.parent_id and c.parent_id in by_id:
                by_id[c.parent_id]["children"].append(item)
            else:
                roots.append(item)

        return Response(roots, status=status.HTTP_200_OK)



class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        u = getattr(request, "user", None)
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "super_admin")