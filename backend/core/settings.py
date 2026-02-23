
"""
Django settings for core project.

- Utilise PostgreSQL via les variables d'environnement (.env)
- Local :
    DB_NAME = christland
    DB_USER = postgres
    DB_PASSWORD = Admin1234
    DB_HOST = localhost
    DB_PORT = 5432
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from corsheaders.defaults import default_headers
# === Chemins ===
BASE_DIR = Path(__file__).resolve().parent.parent

# Charge le fichier .env situé dans backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent

# Charge .env.prod si présent, sinon .env
# Charge le fichier .env selon ENV (local par défaut)
env_prod = BASE_DIR / ".env.prod"
env_local = BASE_DIR / ".env.local"

if env_prod.exists():
    load_dotenv(env_prod)
else:
    load_dotenv(env_local)
# === Sécurité / Debug ===

SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-key")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

ALLOWED_HOSTS = os.getenv(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1",
).split(",")
ALLOWED_HOSTS = [h.strip() for h in ALLOWED_HOSTS if h.strip()]



# === Base de données (local ou Render selon .env) ===
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# === Fichiers statiques & médias ===
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# === APPS ===
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "corsheaders",
    "csp",

    # App principale
    "christland",
]

# === MIDDLEWARE ===
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
]

ROOT_URLCONF = "core.urls"

# === Templates ===
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# === Content Security Policy (CSP) ===
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": ("'self'",),
        "script-src": ("'self'", "'unsafe-inline'", "'unsafe-eval'"),
        "style-src": ("'self'", "https://fonts.googleapis.com", "'unsafe-inline'"),
        "font-src": ("'self'", "https://fonts.gstatic.com", "data:"),
        "img-src": (
            "'self'",
            "data:",
            "blob:",
            "https:",
            "https://christland.tech",
            "https://www.christland.tech",
        ),
        "connect-src": (
            "'self'",
            "https://christland.tech",
            "https://www.christland.tech",
        ),
        "media-src": ("'self'", "blob:", "https:"),
    }
}


# === Traduction interne ===
I18N_TARGET_LANGS = ["en"]
AUTO_BUILD_TRANSLATIONS = True

# === CORS / CSRF (LOCAL + PROD) ===

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": os.getenv("CLOUDINARY_API_KEY"),
    "API_SECRET": os.getenv("CLOUDINARY_API_SECRET"),
}

CORS_ALLOW_HEADERS = list(default_headers) + [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-lang",
]
CSRF_TRUSTED_ORIGINS = [
    # Local dev
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # Production OVH (HTTPS)
    "https://christland.tech",
    "https://www.christland.tech",
]

CORS_ALLOW_CREDENTIALS = True

# En local (DEBUG=True) : on ouvre pour éviter les blocages pendant le dev
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # En prod : on limite aux origines connues (OVH)
    CORS_ALLOWED_ORIGINS = [
        "https://christland.tech",
        "https://www.christland.tech",
    ]


# === Validation mot de passe ===
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# === Internationalisation ===
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# =========================
#  CONTACT / EMAIL
# =========================

# settings.py
import os

# === Email / Contact ===

CONTACT_INBOX = os.getenv("CONTACT_INBOX", "nzogue.dibiye@gmail.com")

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend",
)

EMAIL_HOST = os.getenv("EMAIL_HOST", "ssl0.ovh.net")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))

# ⚠️ Important: lire TLS et SSL depuis .env
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "False").lower() == "true"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").lower() == "true"

# Sécurité: ne jamais activer les 2 en même temps
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ValueError("EMAIL_USE_TLS et EMAIL_USE_SSL ne peuvent pas être True en même temps.")

EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "20"))

CONTACT_INBOX = os.getenv("CONTACT_INBOX", "nzogue.dibiye@gmail.com")

# === Static (déjà défini plus haut, on garde) ===
STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.request": {  # log 500 + traceback
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

# === DRF ===
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "christland.auth_jwt.JWTAuthentication",
    ),
}

# === Cache ===
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "christland-locmem-cache",
    }
}

# Si tu veux un jour :
# LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "https://libretranslate.com")

# Si tu veux réactiver plus tard :
# LIBRETRANSLATE_URL = "https://libretranslate.com"
# print("CORS_ALLOW_HEADERS =", CORS_ALLOW_HEADERS)
