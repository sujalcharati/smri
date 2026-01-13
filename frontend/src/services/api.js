import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = {
  // Health check
  health: async () => {
    const response = await axios.get(`${API}/health`);
    return response.data;
  },

  // Query AI
  query: async (question, contextLimit = 5) => {
    const response = await axios.post(`${API}/query`, {
      question,
      context_limit: contextLimit,
    });
    return response.data;
  },

  // Decisions
  getDecisions: async (limit = 20) => {
    const response = await axios.get(`${API}/decisions?limit=${limit}`);
    return response.data;
  },

  // Ingest content
  ingestContent: async (data) => {
    const response = await axios.post(`${API}/ingest`, data);
    return response.data;
  },

  // Knowledge stats
  getKnowledgeStats: async () => {
    const response = await axios.get(`${API}/knowledge/stats`);
    return response.data;
  },

  // Get documents
  getDocuments: async (sourceType = null, limit = 50) => {
    const url = sourceType
      ? `${API}/knowledge/documents?source_type=${sourceType}&limit=${limit}`
      : `${API}/knowledge/documents?limit=${limit}`;
    const response = await axios.get(url);
    return response.data;
  },

  // Data sources
  getDataSources: async () => {
    const response = await axios.get(`${API}/data-sources`);
    return response.data;
  },

  connectSlack: async (token) => {
    const response = await axios.post(`${API}/data-sources/slack/connect`, {
      token,
    });
    return response.data;
  },

  syncSlack: async (channelId) => {
    const response = await axios.post(`${API}/data-sources/slack/sync`, {
      channel_id: channelId,
    });
    return response.data;
  },

  // Actions
  postToSlack: async (channel, message) => {
    const response = await axios.post(`${API}/actions/slack/post`, {
      channel,
      message,
    });
    return response.data;
  },

  // Insights
  getInsights: async () => {
    const response = await axios.get(`${API}/insights/patterns`);
    return response.data;
  },
};