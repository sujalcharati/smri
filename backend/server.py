from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from datetime import datetime
from typing import List, Dict, Any

from models import (
    DataSource, DataSourceType, DataSourceStatus,
    QueryRequest, Decision, IngestRequest, ActionOutput
)
from services.vector_service import VectorService
from services.llm_service import LLMService
from services.slack_service import SlackService
from services.notion_service import NotionService
from services.google_docs_service import GoogleDocsService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize services
vector_service = VectorService()
llm_service = LLMService()

# Create the main app
app = FastAPI(title="Organizational Memory System")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "vector_db": vector_service.get_stats(),
        "timestamp": datetime.utcnow().isoformat()
    }

@api_router.post("/query")
async def query_knowledge(request: QueryRequest):
    """Ask a question and get AI-powered recommendations"""
    try:
        # Search vector database for relevant context
        context = vector_service.search(request.question, n_results=request.context_limit)
        
        # Generate decision using LLM
        decision_data = llm_service.generate_decision(request.question, context)
        
        # Save decision to database
        decision_doc = {
            "question": request.question,
            "summary": decision_data.get("summary", ""),
            "what_worked": decision_data.get("what_worked", []),
            "what_failed": decision_data.get("what_failed", []),
            "risks": decision_data.get("risks", []),
            "recommendations": decision_data.get("recommendations", []),
            "next_steps": decision_data.get("next_steps", []),
            "relevant_sources": [{"text": c["text"][:200], "source": c.get("metadata", {}).get("source", "Unknown")} for c in context],
            "created_at": datetime.utcnow()
        }
        
        await db.decisions.insert_one(decision_doc)
        
        return {
            "question": request.question,
            "answer": decision_data,
            "context_used": len(context),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Query error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/decisions")
async def get_decisions(limit: int = 20):
    """Get decision history"""
    try:
        decisions = await db.decisions.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        for decision in decisions:
            if isinstance(decision.get('created_at'), datetime):
                decision['created_at'] = decision['created_at'].isoformat()
        return {"decisions": decisions, "count": len(decisions)}
    except Exception as e:
        logger.error(f"Get decisions error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/ingest")
async def ingest_content(request: IngestRequest):
    """Ingest content into the knowledge base"""
    try:
        # Chunk content if too long
        max_chunk_size = 1000
        chunks = [request.content[i:i+max_chunk_size] for i in range(0, len(request.content), max_chunk_size)]
        
        embedding_ids = []
        for i, chunk in enumerate(chunks):
            metadata = {
                "source": request.title,
                "source_type": request.source_type.value,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "timestamp": datetime.utcnow().isoformat(),
                **request.metadata
            }
            
            embedding_id = vector_service.add_document(chunk, metadata)
            embedding_ids.append(embedding_id)
        
        # Save document reference to MongoDB
        doc = {
            "title": request.title,
            "source_type": request.source_type.value,
            "content_length": len(request.content),
            "chunks": len(chunks),
            "embedding_ids": embedding_ids,
            "metadata": request.metadata,
            "created_at": datetime.utcnow()
        }
        
        await db.documents.insert_one(doc)
        
        return {
            "status": "success",
            "chunks_created": len(chunks),
            "embedding_ids": embedding_ids
        }
    except Exception as e:
        logger.error(f"Ingest error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/knowledge/stats")
async def get_knowledge_stats():
    """Get knowledge base statistics"""
    try:
        total_docs = await db.documents.count_documents({})
        
        # Count by source type
        pipeline = [
            {"$group": {"_id": "$source_type", "count": {"$sum": 1}}}
        ]
        by_source = await db.documents.aggregate(pipeline).to_list(100)
        
        vector_stats = vector_service.get_stats()
        
        return {
            "total_documents": total_docs,
            "by_source_type": {item["_id"]: item["count"] for item in by_source},
            "vector_db": vector_stats
        }
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/knowledge/documents")
async def get_documents(source_type: str = None, limit: int = 50):
    """Get ingested documents"""
    try:
        query = {}
        if source_type:
            query["source_type"] = source_type
        
        docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        
        for doc in docs:
            if isinstance(doc.get('created_at'), datetime):
                doc['created_at'] = doc['created_at'].isoformat()
        
        return {"documents": docs, "count": len(docs)}
    except Exception as e:
        logger.error(f"Get documents error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/data-sources/slack/connect")
async def connect_slack(token: str = Body(..., embed=True)):
    """Connect Slack data source"""
    try:
        slack_service = SlackService(token=token)
        if slack_service.test_connection():
            # Save connection
            await db.data_sources.update_one(
                {"type": "slack"},
                {"$set": {
                    "type": "slack",
                    "name": "Slack",
                    "status": "connected",
                    "token": token,
                    "connected_at": datetime.utcnow()
                }},
                upsert=True
            )
            return {"status": "connected", "message": "Slack connected successfully"}
        else:
            raise HTTPException(status_code=400, detail="Invalid Slack token")
    except Exception as e:
        logger.error(f"Slack connect error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/data-sources/slack/sync")
async def sync_slack(channel_id: str = Body(..., embed=True)):
    """Sync messages from a Slack channel"""
    try:
        source = await db.data_sources.find_one({"type": "slack"})
        if not source:
            raise HTTPException(status_code=404, detail="Slack not connected")
        
        slack_service = SlackService(token=source.get('token'))
        messages = slack_service.get_messages(channel_id, limit=100)
        
        # Ingest messages
        synced_count = 0
        for msg in messages:
            text = msg.get('text', '')
            if text and len(text) > 10:
                await ingest_content(IngestRequest(
                    source_type=DataSourceType.SLACK,
                    content=text,
                    title=f"Slack message from {msg.get('user', 'unknown')}",
                    metadata={
                        "channel_id": channel_id,
                        "user": msg.get('user', ''),
                        "ts": msg.get('ts', '')
                    }
                ))
                synced_count += 1
        
        return {"status": "success", "messages_synced": synced_count}
    except Exception as e:
        logger.error(f"Slack sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/data-sources")
async def get_data_sources():
    """Get all configured data sources"""
    try:
        sources = await db.data_sources.find({}, {"_id": 0, "token": 0}).to_list(10)
        for source in sources:
            if isinstance(source.get('connected_at'), datetime):
                source['connected_at'] = source['connected_at'].isoformat()
        
        # Add default sources if none exist
        if not sources:
            sources = [
                {"name": "Slack", "type": "slack", "status": "disconnected"},
                {"name": "Google Docs", "type": "google_docs", "status": "disconnected"},
                {"name": "Notion", "type": "notion", "status": "disconnected"},
                {"name": "Meeting Transcripts", "type": "meeting", "status": "disconnected"}
            ]
        
        return {"sources": sources}
    except Exception as e:
        logger.error(f"Get sources error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/actions/slack/post")
async def post_to_slack(channel: str = Body(...), message: str = Body(...)):
    """Post a message to Slack"""
    try:
        source = await db.data_sources.find_one({"type": "slack"})
        if not source:
            raise HTTPException(status_code=404, detail="Slack not connected")
        
        slack_service = SlackService(token=source.get('token'))
        success = slack_service.post_message(channel, message)
        
        if success:
            return {"status": "success", "message": "Posted to Slack"}
        else:
            raise HTTPException(status_code=500, detail="Failed to post message")
    except Exception as e:
        logger.error(f"Slack post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/insights/patterns")
async def get_insights():
    """Get patterns and insights from decision history"""
    try:
        # Get recent decisions
        decisions = await db.decisions.find({}).sort("created_at", -1).limit(50).to_list(50)
        
        # Analyze patterns
        total_decisions = len(decisions)
        total_recommendations = sum(len(d.get('recommendations', [])) for d in decisions)
        total_risks = sum(len(d.get('risks', [])) for d in decisions)
        
        # Get most common topics (simplified)
        topics = {}
        for decision in decisions:
            question = decision.get('question', '').lower()
            words = question.split()
            for word in words:
                if len(word) > 5:
                    topics[word] = topics.get(word, 0) + 1
        
        top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            "total_decisions": total_decisions,
            "avg_recommendations_per_decision": round(total_recommendations / max(total_decisions, 1), 1),
            "avg_risks_per_decision": round(total_risks / max(total_decisions, 1), 1),
            "top_topics": [{"topic": t[0], "count": t[1]} for t in top_topics]
        }
    except Exception as e:
        logger.error(f"Insights error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
