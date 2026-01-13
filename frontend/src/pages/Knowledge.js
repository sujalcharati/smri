import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FiDatabase, FiFileText } from 'react-icons/fi';
import { FaSlack } from 'react-icons/fa';
import { SiNotion, SiGoogledocs } from 'react-icons/si';

const Knowledge = () => {
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, docsData] = await Promise.all([
        api.getKnowledgeStats(),
        api.getDocuments(),
      ]);
      setStats(statsData);
      setDocuments(docsData.documents || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (type) => {
    switch (type) {
      case 'slack':
        return <FaSlack className="w-4 h-4 text-[#E01E5A]" />;
      case 'google_docs':
        return <SiGoogledocs className="w-4 h-4 text-blue-500" />;
      case 'notion':
        return <SiNotion className="w-4 h-4" />;
      default:
        return <FiFileText className="w-4 h-4" />;
    }
  };

  const filteredDocs = activeTab === 'all' 
    ? documents 
    : documents.filter(doc => doc.source_type === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-4" data-testid="knowledge-title">
          Knowledge Base
        </h1>
        <p className="text-lg text-muted-foreground">
          View and manage your ingested organizational knowledge
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border/50" data-testid="total-docs-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Documents</p>
                  <p className="text-3xl font-heading font-bold" data-testid="total-docs-stat">
                    {stats?.total_documents || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <FiDatabase className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card border-border/50" data-testid="embeddings-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Embeddings</p>
                  <p className="text-3xl font-heading font-bold" data-testid="embeddings-stat">
                    {stats?.vector_db?.total_documents || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <FiFileText className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card border-border/50" data-testid="sources-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Data Sources</p>
                  <p className="text-3xl font-heading font-bold">
                    {stats?.by_source_type ? Object.keys(stats.by_source_type).length : 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <FiDatabase className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Documents List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass" data-testid="documents-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Documents</CardTitle>
            <CardDescription>Browse your ingested content</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="slack" data-testid="tab-slack">Slack</TabsTrigger>
                <TabsTrigger value="google_docs" data-testid="tab-google-docs">Google Docs</TabsTrigger>
                <TabsTrigger value="notion" data-testid="tab-notion">Notion</TabsTrigger>
                <TabsTrigger value="meeting" data-testid="tab-meeting">Meetings</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredDocs.length > 0 ? (
                  <div className="space-y-3" data-testid="documents-list">
                    {filteredDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/50 transition-colors"
                        data-testid={`document-${idx}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getSourceIcon(doc.source_type)}
                              <h3 className="font-heading font-semibold">{doc.title}</h3>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span>Type: {doc.source_type}</span>
                              <span>Chunks: {doc.chunks || 1}</span>
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground" data-testid="no-documents">
                    <p>No documents found</p>
                    <p className="text-sm mt-2">Connect data sources to start ingesting content</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Knowledge;