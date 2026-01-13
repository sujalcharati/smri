import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { FiMessageSquare, FiDatabase, FiTrendingUp, FiClock, FiArrowRight } from 'react-icons/fi';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentDecisions, setRecentDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, decisionsData] = await Promise.all([
        api.getKnowledgeStats(),
        api.getDecisions(5),
      ]);
      setStats(statsData);
      setRecentDecisions(decisionsData.decisions || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-5xl md:text-6xl font-heading font-extrabold tracking-tight mb-4" data-testid="dashboard-title">
          Organizational Memory
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl" data-testid="dashboard-subtitle">
          AI-powered decision intelligence system that learns from your company's history
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Main CTA - Ask AI */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-8 row-span-2"
        >
          <Card className="glass neon-glow h-full" data-testid="ask-ai-card">
            <CardHeader>
              <CardTitle className="text-3xl font-heading flex items-center space-x-3">
                <FiMessageSquare className="w-8 h-8 text-primary" />
                <span>Ask AI Anything</span>
              </CardTitle>
              <CardDescription className="text-base">
                Get intelligent recommendations based on your organization's collective knowledge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Example questions:</p>
                  <ul className="space-y-2 text-foreground/80">
                    <li className="flex items-start space-x-2">
                      <span className="text-accent mt-1">→</span>
                      <span>How should I launch this product?</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-accent mt-1">→</span>
                      <span>What went wrong in past campaigns?</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-accent mt-1">→</span>
                      <span>What's the best strategy for customer retention?</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Link to="/ask">
                <Button 
                  size="lg" 
                  className="w-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300 hover:scale-[1.02]"
                  data-testid="start-asking-button"
                >
                  Start Asking Questions
                  <FiArrowRight className="ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Knowledge Stats */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-4"
        >
          <Card className="bg-card border-border/50 h-full" data-testid="knowledge-stats-card">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center space-x-2">
                <FiDatabase className="w-5 h-5 text-accent" />
                <span>Knowledge Base</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <div className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
                  <div className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-4xl font-heading font-bold text-primary mb-1" data-testid="total-docs-count">
                      {stats?.total_documents || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Documents</div>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="text-4xl font-heading font-bold text-accent mb-1" data-testid="vector-count">
                      {stats?.vector_db?.total_documents || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Embeddings Generated</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="col-span-12 lg:col-span-4"
        >
          <Card className="bg-card border-border/50 h-full" data-testid="recent-activity-card">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center space-x-2">
                <FiClock className="w-5 h-5 text-primary" />
                <span>Recent Decisions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentDecisions.length > 0 ? (
                <div className="space-y-2">
                  {recentDecisions.map((decision, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/30"
                      data-testid={`recent-decision-${idx}`}
                    >
                      <p className="text-sm font-medium line-clamp-2 text-foreground/90">
                        {decision.question}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(decision.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No decisions yet</p>
                  <Link to="/ask" className="text-primary hover:underline text-sm mt-2 inline-block">
                    Ask your first question
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link to="/sources">
            <Card className="bg-card border-border/50 hover:border-primary/50 transition-all duration-300 h-full cursor-pointer" data-testid="connect-sources-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center space-x-2">
                  <FiDatabase className="w-5 h-5" />
                  <span>Connect Sources</span>
                </CardTitle>
                <CardDescription>Integrate Slack, Google Docs, Notion</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link to="/decisions">
            <Card className="bg-card border-border/50 hover:border-primary/50 transition-all duration-300 h-full cursor-pointer" data-testid="view-history-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center space-x-2">
                  <FiClock className="w-5 h-5" />
                  <span>View History</span>
                </CardTitle>
                <CardDescription>Browse past decisions and outcomes</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Link to="/insights">
            <Card className="bg-card border-border/50 hover:border-primary/50 transition-all duration-300 h-full cursor-pointer" data-testid="view-insights-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center space-x-2">
                  <FiTrendingUp className="w-5 h-5" />
                  <span>View Insights</span>
                </CardTitle>
                <CardDescription>Discover patterns and trends</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;