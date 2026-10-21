from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    POSTGRES_HOST: str = "supabase-db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "postgres"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""

    GX_COMPLIANCE_URL: str = "http://gx-compliance:3000"
    GX_REGISTRY_URL: str = "http://gx-registry:3000"
    GX_NOTARY_URL: str = "http://gx-notary:3000"

    DOMAIN: str = "imx.vactory-projects.com"
    PRIVATE_KEY_PATH: str = "/app/keys/private.pem"
    CERTIFICATE_PATH: str = "/app/keys/cert.pem"

    EDC_API_KEY: str = "password"
    EDC_INTERNAL_SECRET: str = "edc-internal-2026"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
