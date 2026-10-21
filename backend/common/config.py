from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    POSTGRES_HOST: str = "supabase-db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "postgres"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    APP_NAME: str = "vendor"
    # Require auth on all /api/*: use API_SECRET (Bearer) or JWT from login
    API_SECRET: str = ""
    # JWT signing secret; must be set for login to work
    JWT_SECRET: str = "change-me"
    # Comma-separated user:password (e.g. "alice:secret1,bob:secret2")
    APP_USERS: str = "demo:demo,admin:admin"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
