from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from typing import List, Dict, Any
import os

class GoogleDocsService:
    def __init__(self, credentials_dict: Dict = None):
        self.credentials = credentials_dict
        self.service = None
        if credentials_dict:
            try:
                creds = Credentials.from_authorized_user_info(credentials_dict)
                self.service = build('docs', 'v1', credentials=creds)
            except:
                pass
    
    def test_connection(self) -> bool:
        """Test if Google Docs connection is valid"""
        return self.service is not None
    
    def get_document(self, document_id: str) -> Dict[str, Any]:
        """Get a Google Doc"""
        if not self.service:
            return {}
        
        try:
            return self.service.documents().get(documentId=document_id).execute()
        except Exception as e:
            print(f"Error fetching document: {e}")
            return {}
    
    def extract_text(self, document_id: str) -> str:
        """Extract text from a Google Doc"""
        doc = self.get_document(document_id)
        if not doc:
            return ""
        
        content = []
        for element in doc.get('body', {}).get('content', []):
            if 'paragraph' in element:
                for text_run in element['paragraph'].get('elements', []):
                    if 'textRun' in text_run:
                        content.append(text_run['textRun'].get('content', ''))
        
        return ''.join(content)
    
    def create_document(self, title: str, content: str) -> Dict[str, Any]:
        """Create a new Google Doc"""
        if not self.service:
            return {}
        
        try:
            doc = self.service.documents().create(body={'title': title}).execute()
            doc_id = doc.get('documentId')
            
            # Add content
            requests = [{
                'insertText': {
                    'location': {'index': 1},
                    'text': content
                }
            }]
            
            self.service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': requests}
            ).execute()
            
            return doc
        except Exception as e:
            print(f"Error creating document: {e}")
            return {}