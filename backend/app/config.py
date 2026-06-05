from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    log_level: str = "info"
    cors_origins: str = "http://localhost:4200"


settings = Settings()
