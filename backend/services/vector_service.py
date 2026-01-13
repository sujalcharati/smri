import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
import uuid
from sentence_transformers import SentenceTransformer

class VectorService:
    def __init__(self):
        self.client = chromadb.Client(Settings(
            anonymized_telemetry=False,
            allow_reset=True
        ))
        try:
            self.collection = self.client.get_collection("org_memory")
        except:
            self.collection = self.client.create_collection(
                name="org_memory",
                metadata={"hnsw:space": "cosine"}
            )
        
        # Use a lightweight model for embeddings
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def add_document(self, text: str, metadata: Dict[str, Any]) -> str:
        """Add a document to the vector database"""
        doc_id = str(uuid.uuid4())
        embedding = self.model.encode(text).tolist()
        
        self.collection.add(
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        return doc_id
    
    def search(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for relevant documents"""
        query_embedding = self.model.encode(query).tolist()
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        formatted_results = []
        if results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'text': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                    'distance': results['distances'][0][i] if results['distances'] else 0
                })
        
        return formatted_results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics"""
        return {
            'total_documents': self.collection.count(),
            'collection_name': self.collection.name
        }