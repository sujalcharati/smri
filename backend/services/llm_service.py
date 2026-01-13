from emergentintegrations.llm.chat import LlmChat
import os
from typing import List, Dict, Any

class LLMService:
    def __init__(self):
        self.api_key = os.getenv('EMERGENT_LLM_KEY')
        self.session_id = "org_memory_session"
    
    def generate_decision(self, question: str, context: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate AI-powered decision based on question and context"""
        
        # Format context
        context_text = "\n\n".join([
            f"Source: {c.get('metadata', {}).get('source', 'Unknown')}\n"
            f"Type: {c.get('metadata', {}).get('source_type', 'Unknown')}\n"
            f"Content: {c.get('text', '')}"
            for c in context
        ])
        
        prompt = f"""You are an organizational decision intelligence system. Based on the company's historical data, provide recommendations.

Question: {question}

Relevant Historical Context:
{context_text}

Provide a comprehensive response in the following JSON format:
{{
  "summary": "Brief summary of relevant past situations",
  "what_worked": ["List of successful approaches"],
  "what_failed": ["List of failed approaches"],
  "risks": ["Potential risks to avoid"],
  "recommendations": ["Specific actionable recommendations"],
  "next_steps": ["Immediate next steps"]
}}

Be specific, actionable, and base recommendations on the historical context provided."""
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=self.session_id,
                system_message="You are an expert organizational decision intelligence system."
            ).with_model("gemini", "gemini-3-pro-preview")
            
            response = chat.send_message(prompt)
            
            # Extract JSON from response
            import json
            # Try to find JSON in response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                result = json.loads(json_str)
                return result
            else:
                # Fallback if JSON parsing fails
                return {
                    "summary": response,
                    "what_worked": [],
                    "what_failed": [],
                    "risks": [],
                    "recommendations": ["Review the detailed analysis above"],
                    "next_steps": ["Evaluate recommendations with your team"]
                }
        except Exception as e:
            return {
                "summary": f"Error generating response: {str(e)}",
                "what_worked": [],
                "what_failed": [],
                "risks": ["AI service temporarily unavailable"],
                "recommendations": ["Try again in a moment"],
                "next_steps": ["Contact support if issue persists"]
            }
    
    def summarize_content(self, content: str, max_length: int = 500) -> str:
        """Summarize long content"""
        if len(content) <= max_length:
            return content
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"{self.session_id}_summary",
                system_message="You are a concise summarization assistant."
            ).with_model("gemini", "gemini-3-flash-preview")
            
            response = chat.send_message(f"Summarize this in {max_length} characters or less:\n\n{content}")
            return response[:max_length]
        except:
            return content[:max_length] + "..."