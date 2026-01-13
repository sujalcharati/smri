from notion_client import Client
from typing import List, Dict, Any
import os

class NotionService:
    def __init__(self, token: str = None):
        self.token = token or os.getenv('NOTION_TOKEN')
        self.client = Client(auth=self.token) if self.token else None
    
    def test_connection(self) -> bool:
        """Test if Notion connection is valid"""
        if not self.client:
            return False
        try:
            self.client.users.me()
            return True
        except:
            return False
    
    def get_page(self, page_id: str) -> Dict[str, Any]:
        """Get a Notion page"""
        if not self.client:
            return {}
        
        try:
            return self.client.pages.retrieve(page_id)
        except Exception as e:
            print(f"Error fetching page: {e}")
            return {}
    
    def get_page_content(self, page_id: str) -> str:
        """Extract text content from a Notion page"""
        if not self.client:
            return ""
        
        try:
            blocks = self.client.blocks.children.list(page_id)
            content = []
            
            for block in blocks.get('results', []):
                block_type = block.get('type')
                if block_type == 'paragraph':
                    text_content = block.get('paragraph', {}).get('rich_text', [])
                    for text in text_content:
                        content.append(text.get('plain_text', ''))
                elif block_type == 'heading_1':
                    text_content = block.get('heading_1', {}).get('rich_text', [])
                    for text in text_content:
                        content.append(f"# {text.get('plain_text', '')}")
            
            return "\n".join(content)
        except Exception as e:
            print(f"Error fetching content: {e}")
            return ""
    
    def create_page(self, parent_id: str, title: str, content: str) -> Dict[str, Any]:
        """Create a new Notion page"""
        if not self.client:
            return {}
        
        try:
            new_page = self.client.pages.create(
                parent={"page_id": parent_id},
                properties={
                    "title": {
                        "title": [{"text": {"content": title}}]
                    }
                },
                children=[
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"text": {"content": content}}]
                        }
                    }
                ]
            )
            return new_page
        except Exception as e:
            print(f"Error creating page: {e}")
            return {}