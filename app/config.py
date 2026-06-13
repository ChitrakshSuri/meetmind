from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    meetingbaas_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    atlassian_mcp_url: str = "https://mcp.atlassian.com/v1/mcp"
    atlassian_api_token: str = ""
    atlassian_email: str = ""
    jira_project_key: str = ""
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "meetmind"
    app_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env"}


settings = Settings()
