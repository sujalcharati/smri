from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from typing import List, Dict, Any
import os

class SlackService:
    def __init__(self, token: str = None):
        self.token = token or os.getenv('SLACK_BOT_TOKEN')
        self.client = WebClient(token=self.token) if self.token else None
    
    def test_connection(self) -> bool:
        """Test if Slack connection is valid"""
        if not self.client:
            return False
        try:
            response = self.client.auth_test()
            return response['ok']
        except:
            return False
    
    def get_messages(self, channel_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch messages from a Slack channel"""
        if not self.client:
            return []
        
        try:
            result = self.client.conversations_history(
                channel=channel_id,
                limit=limit
            )
            return result.get('messages', [])
        except SlackApiError as e:
            print(f"Error fetching messages: {e}")
            return []
    
    def post_message(self, channel_id: str, text: str) -> bool:
        """Post a message to a Slack channel"""
        if not self.client:
            return False
        
        try:
            self.client.chat_postMessage(
                channel=channel_id,
                text=text
            )
            return True
        except SlackApiError as e:
            print(f"Error posting message: {e}")
            return False
    
    def list_channels(self) -> List[Dict[str, Any]]:
        """List all channels the bot has access to"""
        if not self.client:
            return []
        
        try:
            result = self.client.conversations_list()
            return result.get('channels', [])
        except:
            return []