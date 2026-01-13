from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DataSourceType(str, Enum):
    SLACK = "slack"
    GOOGLE_DOCS = "google_docs"
    NOTION = "notion"
    MEETING = "meeting"

class DataSourceStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"

class DataSource(BaseModel):
    name: str
    type: DataSourceType
    status: DataSourceStatus
    credentials: Optional[Dict[str, str]] = None
    last_synced: Optional[datetime] = None
    documents_count: int = 0

class Document(BaseModel):
    source_id: str
    source_type: DataSourceType
    title: str
    content: str
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    embedding_ids: List[str] = []

class QueryRequest(BaseModel):
    question: str
    context_limit: int = 5

class Decision(BaseModel):
    title: str
    context: str
    recommendations: List[str]
    risks: List[str]
    next_steps: List[str]
    relevant_sources: List[Dict[str, str]]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class KnowledgeItem(BaseModel):
    text: str
    source: str
    source_type: DataSourceType
    timestamp: datetime
    embedding_id: Optional[str] = None

class IngestRequest(BaseModel):
    source_type: DataSourceType
    content: str
    title: str
    metadata: Dict[str, Any] = {}

class SlackMessage(BaseModel):
    channel: str
    message: str
    user: str
    timestamp: str

class ActionOutput(BaseModel):
    type: str  # slack, google_doc, notion
    title: str
    content: str
    target: Optional[str] = None