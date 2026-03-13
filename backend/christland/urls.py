from django.urls import path
from django.views.decorators.csrf import csrf_exempt  # ⬅️ AJOUTER ÇA
from .views import (
    CategoryProductList, CategoryFilters,CategoryListPublic, ProductMiniView,CategoryListDashboard,
    BlogHeroView, BlogPostsView, LatestProductsView, ContactMessageView,
    ProduitsListCreateView, ProduitsDetailView, AddProductWithVariantView,
    MarquesListView, CouleursListView, UploadProductImageView,
    DashboardProductEditDataView, ProductClickView, RefreshView,
    MostDemandedProductsView, DashboardArticlesListCreateView, DashboardArticleDetailView,
    DashboardArticleEditView, BlogLatestView, AdminGlobalSearchView,
    DashboardStatsView, LoginView, MeView, RegisterView,DashboardCategoryListCreateView,DashboardCategoryDetailView,CategoryListTop, DashboardCategoriesSelectView, DashboardCategoriesTreeView,
    DashboardCategoryRestoreView,DashboardProductRestoreView, DashboardArticleRestoreView,ProductPublicDetailView,
)

app_name = "christland"

urlpatterns = [
    # Catalog
    path("api/catalog/marques/", MarquesListView.as_view(), name="catalog_marques"),
    path("api/catalog/couleurs/", CouleursListView.as_view(), name="catalog_couleurs"),
    path("api/catalog/categories/",   CategoryListPublic.as_view(),    name="catalog-categories"),
    path("api/dashboard/categories/", CategoryListDashboard.as_view(), name="dashboard-categories"),
    path("api/catalog/products/", CategoryProductList.as_view(), name="catalog-products"),
    path("api/catalog/filters/", CategoryFilters.as_view(), name="catalog-filters"),
    path("api/catalog/product/<str:pk_or_slug>/mini/", ProductMiniView.as_view(), name="product-mini"),
    path("api/catalog/products/<int:pk>/click/", ProductClickView.as_view(), name="product-click"),
    path("api/catalog/products/most-demanded/", MostDemandedProductsView.as_view(), name="products-most-demanded"),
    path("api/catalog/products/latest/", LatestProductsView.as_view(), name="latest-products"),
    path("api/catalog/products/<slug:slug>/", ProductPublicDetailView.as_view()),
    # Blog
    path("api/blog/hero/", BlogHeroView.as_view(), name="api_blog_hero"),
    path("api/blog/posts/", BlogPostsView.as_view(), name="api_blog_posts"),
    path("api/blog/latest/", BlogLatestView.as_view(), name="api_blog_latest"),

    # Contact
    path("api/contact/messages/", ContactMessageView.as_view(), name="contact-messages"),

    # Uploads
    path("api/uploads/images/",csrf_exempt(UploadProductImageView.as_view()), name="upload-product-image"),

    # Public auth
    path("api/dashboard/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/dashboard/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/dashboard/auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("api/catalog/categories/top/", CategoryListTop.as_view()),

    # Dashboard
    path("api/dashboard/produits/", ProduitsListCreateView.as_view(), name="dashboard-produits-list-create"),
    path("api/dashboard/produits/<int:pk>/", ProduitsDetailView.as_view(), name="dashboard-produits-detail"),
    path("api/dashboard/produits/<int:pk>/edit/", DashboardProductEditDataView.as_view(), name="dashboard-produits-edit"),
    path("api/dashboard/articles/", DashboardArticlesListCreateView.as_view(), name="dashboard-articles"),
    path("api/dashboard/articles/<int:pk>/", DashboardArticleDetailView.as_view(), name="dashboard-article-detail"),
    path("api/dashboard/articles/<int:pk>/edit/", DashboardArticleEditView.as_view(), name="dashboard-article-edit"),
    path("api/dashboard/search/", AdminGlobalSearchView.as_view(), name="admin-global-search"),
    path("api/dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("api/dashboard/auth/register/", RegisterView.as_view(), name="auth-register"),
    path( "api/dashboard/categories/manage/", DashboardCategoryListCreateView.as_view(),name="dashboard-categories-manage",),
    path("api/dashboard/categories/manage/<int:pk>/", DashboardCategoryDetailView.as_view(),name="dashboard-category-detail", ),
    # Création produit simplifiée
    path("dashboard/categories/manage/<int:pk>/restore/", DashboardCategoryRestoreView.as_view()),
    path("api/produits/ajouter/", AddProductWithVariantView.as_view(), name="add_product_with_variant"),
    path("dashboard/produits/<int:pk>/restore/", DashboardProductRestoreView.as_view()),
    path( "api/dashboard/categories/select/", DashboardCategoriesSelectView.as_view(), name="dashboard-categories-select", ),
    path( "api/dashboard/categories/tree/", DashboardCategoriesTreeView.as_view(), name="dashboard-categories-tree",),
    path("dashboard/articles/<int:pk>/restore/", DashboardArticleRestoreView.as_view()),
    
]
