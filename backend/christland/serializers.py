from django.utils.text import slugify
from rest_framework import serializers
from django.conf import settings
from .models import (
    Categories, Marques, Couleurs,
    Produits, VariantesProduits, ImagesProduits,ArticlesBlog,
    Attribut, ValeurAttribut, SpecProduit, SpecVariante
)
from django.utils import timezone
from datetime import timezone as dt_timezone

from .serializers_i18n import I18nTranslateMixin
from urllib.parse import urlparse
from django.conf import settings
from django.db import transaction
# -------------------------
# Helpers (même logique que Produits)
# -------------------------

def _abs_media(request, value: str | None) -> str | None:
    """
    Transforme une valeur stockée (idéalement "uploads/..." ou "images/...")
    en URL absolue. Tolère aussi:
    - URL absolue http(s)
    - "/media/..."
    - "media/..."
    """
    if not value:
        return None

    s = str(value).strip()
    if not s:
        return None

    # URL absolue -> on laisse
    if s.lower().startswith(("http://", "https://", "data:")):
        return s

    # Normalise en path
    # ex: "media/uploads/x.png" -> "/media/uploads/x.png"
    if not s.startswith("/"):
        s = "/" + s

    media_prefix = "/" + settings.MEDIA_URL.strip("/")  # ex "/media"

    # Si ça commence par "/media/media/..." -> on corrige (anciens mauvais stocks)
    double = media_prefix + media_prefix + "/"
    if s.startswith(double):
        s = s[len(media_prefix):]  # retire 1 fois "/media"

    # Si déjà sous /media/... ok
    if s.startswith(media_prefix + "/"):
        path = s
    else:
        # Sinon, on préfixe MEDIA_URL
        path = media_prefix + s  # ex "/media" + "/uploads/x.png"

    return request.build_absolute_uri(path) if request else path


def _strip_media(url_or_path: str | None) -> str:
    """
    Convertit une URL ou un path en chemin relatif à MEDIA_ROOT.
    Exemples:
    - "http://127.0.0.1:8000/media/uploads/a.png" -> "uploads/a.png"
    - "/media/uploads/a.png" -> "uploads/a.png"
    - "media/uploads/a.png" -> "uploads/a.png"
    - "uploads/a.png" -> "uploads/a.png"
    - ""/None -> ""
    """
    s = (url_or_path or "").strip()
    if not s:
        return ""

    # URL absolue -> path
    if s.lower().startswith(("http://", "https://")):
        s = urlparse(s).path or ""

    # normalise
    if not s.startswith("/"):
        s = "/" + s

    media_prefix = "/" + settings.MEDIA_URL.strip("/") + "/"  # "/media/"

    # retire "/media/"
    if s.startswith(media_prefix):
        s = s[len(media_prefix):]  # "uploads/a.png"
    else:
        s = s.lstrip("/")  # "uploads/a.png" ou "images/..."

    # Nettoie un éventuel "media/" restant (cas "media/uploads/..")
    if s.startswith("media/"):
        s = s[len("media/"):]

    return s



def get_request_lang(request) -> str:
    """
    Récupère la langue à partir de ?lang= ou des headers.
    Retourne 'fr', 'en', etc.

    ✅ Dashboard : on force FR pour éviter toute traduction automatique.
    """
    if not request:
        return "fr"

    path = (getattr(request, "path", "") or "").lower()

    # ✅ adapte le prefix si ton dashboard est ailleurs
    if path.startswith("/christland/api/dashboard/"):
        return "fr"

    lang = (
        request.query_params.get("lang")
        or request.headers.get("X-Lang")
        or request.headers.get("Accept-Language", "fr")
    )
    return (lang or "fr").split(",")[0].split("-")[0].lower()


def _etat_label(etat_code: str | None, request=None, lang: str | None = None) -> str | None:
    """
    Traduit le code d'état ('neuf', 'occasion', 'reconditionne') 
    en label selon la langue (fr/en).
    """
    if not etat_code:
        return None

    if lang is None:
        lang = get_request_lang(request)

    mappings = {
        "fr": {
            "neuf": "Neuf",
            "occasion": "Occasion",
            "reconditionne": "Reconditionné",
        },
        "en": {
            "neuf": "New",
            "occasion": "Used",
            "reconditionne": "Refurbished",
        },
    }

    labels = mappings.get(lang, mappings["fr"])
    return labels.get(etat_code, etat_code.capitalize())


def _product_min_price(obj):
    """Retourne le prix actuel le plus bas parmi toutes les variantes"""
    prices = []
    for v in obj.variantes.all():
        prix = v.prix_actuel()
        if prix is not None:
            prices.append(prix)
    return min(prices) if prices else None


class CouleurMiniSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    i18n_fields = ["nom"]
    class Meta:
        model = Couleurs
        fields = ("nom", "slug", "code_hex")
        


class ImageProduitSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    i18n_fields = ["alt_text"]

    # ✅ writable
    url = serializers.CharField()

    class Meta:
        model = ImagesProduits
        fields = ("url", "alt_text", "position", "principale")

    def validate_url(self, value: str):
        # ✅ stocke proprement en BD: "uploads/..." au lieu de "http://127.0.0.1:8000/media/uploads/..."
        return _strip_media(value)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        request = self.context.get("request")

        # ✅ renvoie toujours une URL absolue côté front
        data["url"] = _abs_media(request, getattr(obj, "url", None))
        return data
    class Meta:
        model = ImagesProduits
        fields = ("url", "alt_text", "position", "principale")  # slug inutile ici

    def get_url(self, obj):
        request = self.context.get("request")

        # 1) Si tu as un vrai FileField (image/fichier/photo/...) on l'utilise
        for field in ("fichier", "image", "photo", "fichier_image"):
            f = getattr(obj, field, None)
            if f and hasattr(f, "url"):
                return request.build_absolute_uri(f.url) if request else f.url

        # 2) Sinon on utilise le texte 'url' venant de la BD (chemin relatif)
        val = getattr(obj, "url", None)
        if not val:
            return None

        val = str(val).strip()
        # déjà absolu ?
        if val.startswith("http://") or val.startswith("https://"):
            return val

        # déjà sous /media/ ?
        if val.startswith("/media/"):
            return request.build_absolute_uri(val) if request else val

        # chemin relatif -> prefixe MEDIA_URL
        path = f"{settings.MEDIA_URL.rstrip('/')}/{val.lstrip('/')}"
        return request.build_absolute_uri(path) if request else path



class VarianteSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    # + traduire le nom de la variante et la couleur imbriquée
    i18n_fields = ["nom"]
    i18n_nested = { "couleur": ["nom"] }
    
    couleur = CouleurMiniSerializer()
    prix_affiche = serializers.SerializerMethodField()
    promo_now = serializers.SerializerMethodField()
    variante_poids_grammes = serializers.SerializerMethodField()
    variante_est_actif = serializers.SerializerMethodField()

    
    class Meta:
        model = VariantesProduits
        fields = (
            "id",
            "sku",
            "code_barres",           # <- utilisé dans ProductEditForm
            "nom",
            "prix",
            "prix_promo",
            "prix_affiche",
            "promo_active",          # <- utilisé dans ProductEditForm
            "promo_debut",           # <- idem
            "promo_fin",             # <- idem
            "promo_now",
            "stock",
            "prix_achat",            # <- utilisé dans ProductEditForm
            "poids_grammes",
            "variante_poids_grammes",# alias pour le front
            "est_actif",
            "variante_est_actif",    # alias pour le front
            "couleur",
        )


    def get_variante_poids_grammes(self, obj):
            return obj.poids_grammes

    def get_variante_est_actif(self, obj):
        return obj.est_actif

    def get_prix_affiche(self, obj):
        # ✅ respecte promo_active + fenêtre de dates, déjà géré par ton modèle
        return obj.prix_actuel()


    def _to_aware_utc(self, dt):
        if not dt:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt.astimezone(dt_timezone.utc)

    def get_promo_now(self, obj):
        now_utc = timezone.now().astimezone(dt_timezone.utc)
        debut_utc = self._to_aware_utc(obj.promo_debut)
        fin_utc = self._to_aware_utc(obj.promo_fin)

        if not obj.promo_active or obj.prix_promo is None:
            return False
        if debut_utc and debut_utc > now_utc:
            return False
        if fin_utc and now_utc > fin_utc:
            return False
        return True


class MarqueMiniSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    # + traduire le nom de la marque
    i18n_fields = ["nom"]
    class Meta:
        model = Marques
        fields = ("nom", "slug", "logo_url")


class CategorieMiniSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    # + traduire le nom de catégorie
    i18n_fields = ["nom"]
    parent_slug = serializers.CharField(source="parent.slug", read_only=True)
    image_url = serializers.SerializerMethodField()  # 👈 nouveau

    class Meta:
        model = Categories
        fields = ("id", "nom", "slug", "parent_slug", "image_url")

    def get_image_url(self, obj):
        request = self.context.get("request")
        # obj.image_url contient "images/achat/..." ou "media/..."
        return _abs_media(request, getattr(obj, "image_url", None))


class CategoryDashboardSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(source="parent.id", read_only=True)
    parent_nom = serializers.CharField(source="parent.nom", read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = Categories
        fields = (
            "id", "nom", "slug", "description", "est_actif",
            "image_url", "position",
            "parent", "parent_id", "parent_nom",
            "children",
        )

    def get_children(self, obj):
        # ✅ lié à : parent = ForeignKey('self', related_name='enfants', ...)
        if hasattr(obj, "enfants"):
            qs = obj.enfants.all()
        else:
            # fallback sécurité
            qs = Categories.objects.filter(parent=obj)

        # ✅ soft delete + ordering
        qs = qs.filter(is_deleted=False).order_by("position", "id")

        return [{"id": c.id, "nom": c.nom, "slug": c.slug} for c in qs]
    
class CategoryEditSerializer(serializers.ModelSerializer):
    # champ côté front
    image = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Categories
        fields = ("id", "nom", "slug", "description", "est_actif", "position", "parent", "image")

    def to_representation(self, obj):
        data = super().to_representation(obj)
        request = self.context.get("request")

        # on lit l'image depuis le champ modèle "image_url"
        data["image"] = _abs_media(request, getattr(obj, "image_url", None))

        return data

    def update(self, instance, validated_data):
        img = validated_data.pop("image", None)

        # si "image" est présent -> on met à jour le champ modèle "image_url"
        if img is not None:
            instance.image_url = _strip_media(img)  # ✅ stocke "uploads/..." / "images/..." / ""

        return super().update(instance, validated_data)

class CatalogCategorySerializer(I18nTranslateMixin, serializers.ModelSerializer):
    """
    Serializer utilisé par /api/catalog/categories/ (useCategories côté front).
    On expose bien parent_id pour que React puisse retrouver les sous-catégories.
    """
    i18n_fields = ["nom", "description"]

    parent_id = serializers.IntegerField(source="parent.id", read_only=True)

    class Meta:
        model = Categories
        fields = (
            "id",
            "nom",
            "slug",
            "description",
            "est_actif",
            "image_url",
            "position",
            "parent",      # pk du parent
            "parent_id",   # pk du parent (utile pour le filtrage front)
        )





class ProductEditSerializer(serializers.ModelSerializer):
    # on veut traduire les champs texte
    # i18n_fields = ["nom", "description_courte", "description_long"]

    # relations imbriquées
    categorie = CategorieMiniSerializer(read_only=True, required=False)
    sous_categorie = CategorieMiniSerializer(read_only=True, required=False)
    marque = MarqueMiniSerializer(read_only=True, required=False)
    variantes = VarianteSerializer(many=True, required=False)
    images = ImageProduitSerializer(many=True, required=False)


    class Meta:
        model = Produits
        fields = (
            "id",
            "nom",
            "slug",
            "description_courte",
            "description_long",
            "categorie",
            "sous_categorie",
            "marque",
            "est_actif",
            "visible",
            "garantie_mois",
            "poids_grammes",
            "dimensions",
            "etat",
            "variantes",
            "images",
        )

    @transaction.atomic
    def update(self, instance, validated_data):
        images_data = validated_data.pop("images", None)

        # update produit
        instance = super().update(instance, validated_data)

        # update images si fourni
        if images_data is not None:
            instance.images.all().delete()

            for i, img in enumerate(images_data):
                ImagesProduits.objects.create(
                    produit=instance,
                    url=_strip_media(img["url"]),
                    alt_text=img.get("alt_text", ""),
                    position=img.get("position", i + 1),
                    principale=img.get("principale", False),
                )

            # garantir une principale
            if instance.images.exists() and not instance.images.filter(principale=True).exists():
                first = instance.images.order_by("position", "id").first()
                first.principale = True
                first.save(update_fields=["principale"])

        return instance        

    def to_representation(self, instance):
        """
        Corrige les anciens produits :
        - si sous_categorie est vide
        - et que categorie a un parent
        => on considère que categorie = parent, et la vraie catégorie feuille = sous_categorie.
        """
        data = super().to_representation(instance)

        cat = getattr(instance, "categorie", None)
        subcat = getattr(instance, "sous_categorie", None)

        # cas typique : ancien produit où tu n'avais que 'categorie' pointant sur la sous-catégorie
        if subcat is None and cat is not None and getattr(cat, "parent_id", None):
            parent = cat.parent  # catégorie parente

            data["categorie"] = (
                CategorieMiniSerializer(parent, context=self.context).data
                if parent
                else None
            )
            data["sous_categorie"] = CategorieMiniSerializer(
                cat, context=self.context
            ).data

        return data



class ProduitCardSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    i18n_fields = ["nom", "description_courte"]

    images = ImageProduitSerializer(many=True, read_only=True)
    variantes = VarianteSerializer(many=True, read_only=True)
    marque = MarqueMiniSerializer(read_only=True)
    categorie = CategorieMiniSerializer(read_only=True)

    # Champs calculés
    price = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    specs = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()

    # Promo (attendu par le front)
    prix_from = serializers.SerializerMethodField()
    old_price_from = serializers.SerializerMethodField()
    promo_now = serializers.SerializerMethodField()
    promo_fin = serializers.SerializerMethodField()

    class Meta:
        model = Produits
        fields = (
            "id", "nom", "slug", "description_courte",
            "marque", "categorie", "images", "variantes",
            "price",
            "prix_from",
            "old_price_from",
            "promo_now",
            "promo_fin",
            "image", "specs", "state",
        )

    # -------------------------
    # Helpers timezone SAFE
    # -------------------------
    def _to_aware_utc(self, dt):
        """
        Force dt en datetime aware en UTC.
        - si dt est naive -> on l'interprète dans TIME_ZONE du serveur, puis on convertit UTC
        - si dt est aware -> on convertit UTC
        """
        if not dt:
            return None

        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())

        return dt.astimezone(dt_timezone.utc)

    def _is_variant_promo_valid(self, v, now_utc):
        if not getattr(v, "promo_active", False):
            return False
        if getattr(v, "prix_promo", None) is None:
            return False

        debut_utc = self._to_aware_utc(getattr(v, "promo_debut", None))
        fin_utc = self._to_aware_utc(getattr(v, "promo_fin", None))

        if debut_utc and debut_utc > now_utc:
            return False
        if fin_utc and now_utc > fin_utc:
            return False
        return True

    # -------------------------
    # Prix / Promo
    # -------------------------
    def get_price(self, obj):
        # alias du prix actuel min
        return self.get_prix_from(obj)

    def get_prix_from(self, obj):
        now_utc = timezone.now().astimezone(dt_timezone.utc)
        prices = []

        for v in obj.variantes.all():
            if self._is_variant_promo_valid(v, now_utc):
                prices.append(v.prix_promo)
            elif v.prix is not None:
                prices.append(v.prix)

        return min(prices) if prices else None

    def get_old_price_from(self, obj):
        now_utc = timezone.now().astimezone(dt_timezone.utc)
        old_prices = []

        for v in obj.variantes.all():
            if self._is_variant_promo_valid(v, now_utc) and v.prix is not None:
                old_prices.append(v.prix)

        return min(old_prices) if old_prices else None

    def get_promo_now(self, obj):
        now_utc = timezone.now().astimezone(dt_timezone.utc)
        return any(self._is_variant_promo_valid(v, now_utc) for v in obj.variantes.all())

    def get_promo_fin(self, obj):
        now_utc = timezone.now().astimezone(dt_timezone.utc)
        fins = []

        for v in obj.variantes.all():
            if self._is_variant_promo_valid(v, now_utc):
                fin_utc = self._to_aware_utc(getattr(v, "promo_fin", None))
                if fin_utc:
                    # DRF renverra ISO8601 en UTC, le front peut l'afficher
                    fins.append(fin_utc)

        return max(fins) if fins else None

    # -------------------------
    # Autres champs
    # -------------------------
    def get_image(self, obj):
        request = self.context.get("request")
        img = obj.images.filter(principale=True).first() or obj.images.order_by("position", "id").first()
        if not img:
            return None
        val = (getattr(img, "url", None) or "").strip()
        return _abs_media(request, val) if val else None

    def get_specs(self, obj):
        def extract(sp):
            if sp.valeur_choice:
                return sp.valeur_choice.valeur
            if sp.valeur_text:
                return sp.valeur_text
            if sp.valeur_int is not None:
                return str(sp.valeur_int)
            if sp.valeur_dec is not None:
                return str(sp.valeur_dec)
            return ""

        if obj.specs.exists():
            values = [extract(sp) for sp in obj.specs.all()[:5] if extract(sp)]
            if values:
                return " | ".join(values)

        var = obj.variantes.first()
        if var and var.specs.exists():
            values = [extract(sp) for sp in var.specs.all()[:5] if extract(sp)]
            if values:
                return " | ".join(values)

        return ""

    def get_state(self, obj):
        request = self.context.get("request")
        return _etat_label(obj.etat, request=request)
class ProduitsSerializer(I18nTranslateMixin, serializers.ModelSerializer):
    # + traduire les champs textuels principaux
    i18n_fields = ["nom", "description_courte"]
    # + traductions imbriquées
    i18n_nested = {
        "categorie": ["nom"],
        "marque": ["nom"],
        "images": ["alt_text"],
    }
    variants_stock = serializers.SerializerMethodField() 
    variantes = VarianteSerializer(many=True, read_only=True)  # 👈 AJOUT ICI
    images = ImageProduitSerializer(many=True, read_only=True)
    class Meta:
        model = Produits
        fields = '__all__'  # on garde tout
        # Si tu préfères être explicite:
        # fields = [..., 'variants_stock']
    def get_variants_stock(self, instance):
            return list(instance.variantes.order_by("id").values_list("stock", flat=True))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # (ton code existant)
        vset = getattr(instance, "variantes", None)
        first_var = vset.order_by("id").first() if vset is not None else None
        data["prix_from"] = (
            str(first_var.prix) if (first_var and first_var.prix is not None) else None
        )
        return data
    

# -------------------------
# Serializers Articles (corrigés)
# -------------------------

class ArticleDashboardSerializer(serializers.ModelSerializer):
    """
    Serializer pour l’affichage dashboard (liste/detail)
    """
    image = serializers.SerializerMethodField()

    class Meta:
        model = ArticlesBlog
        fields = (
            "id", "titre", "slug", "extrait", "contenu",
            "image", "publie_le", "cree_le", "modifie_le",
        )

    def get_image(self, obj):
        request = self.context.get("request")
        return _abs_media(request, obj.image_couverture)


class ArticleEditSerializer(serializers.ModelSerializer):
    """
    Serializer utilisé pour:
    - GET /articles/<id>/edit/
    - PUT/PATCH /articles/<id>/
    """
    image = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = ArticlesBlog
        fields = ("id", "titre", "slug", "extrait", "contenu", "image")

    def to_representation(self, obj):
        data = super().to_representation(obj)
        request = self.context.get("request")

        # on renvoie l'URL absolue
        data["image"] = _abs_media(request, obj.image_couverture)

        # ne renvoie que les champs non vides (garde toujours id)
        clean = {"id": data.get("id")}
        for k in ("titre", "slug", "extrait", "contenu", "image"):
            v = data.get(k)
            if v not in (None, "", []):
                clean[k] = v
        return clean

    def update(self, instance, validated_data):
        img = validated_data.pop("image", None)

        # si "image" est présent dans le payload, on met à jour
        if img is not None:
            instance.image_couverture = _strip_media(img)  # ✅ stocke "uploads/..." ou ""

        return super().update(instance, validated_data)


class ArticleCreateSerializer(serializers.ModelSerializer):
    """
    Serializer pour POST /articles/
    """
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = ArticlesBlog
        fields = ["id", "titre", "slug", "extrait", "contenu", "image"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data.pop("id", None)

        img = validated_data.pop("image", None)
        titre = (validated_data.get("titre") or "").strip()

        if not validated_data.get("slug"):
            validated_data["slug"] = slugify(titre)[:140] or slugify("article")

        obj = ArticlesBlog.objects.create(publie_le=timezone.now(), **validated_data)

        # ✅ IMPORTANT: stocker proprement
        if img is not None:
            obj.image_couverture = _strip_media(img)
            obj.save(update_fields=["image_couverture"])

        return obj

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["image"] = _abs_media(request, instance.image_couverture)
        return data