from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    GROQ_API_KEY: str
    GEMINI_API_KEY: str
    REDIS_URL: str
    JWT_SECRET: str
    FRONTEND_URL: str
    LOG_LEVEL: str
    ENVIRONMENT: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
