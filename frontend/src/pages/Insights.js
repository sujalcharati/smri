import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FiTrendingUp, FiTarget, FiAlertTriangle, FiBarChart2 } from 'react-icons/fi';

const Insights = () => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const data = await api.getInsights();
      setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-4" data-testid="insights-title">
          Insights & Patterns
        </h1>
        <p className="text-lg text-muted-foreground">
          Discover patterns and trends from your organizational decisions
        </p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 bg-secondary/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : insights ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card border-border/50" data-testid="total-decisions-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Decisions</p>
                      <p className="text-4xl font-heading font-bold" data-testid="total-decisions-stat">
                        {insights.total_decisions}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FiBarChart2 className="w-6 h-6 text-primary" />
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
              <Card className="bg-card border-border/50" data-testid="avg-recommendations-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Avg Recommendations</p>
                      <p className="text-4xl font-heading font-bold" data-testid="avg-recommendations-stat">
                        {insights.avg_recommendations_per_decision}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10">
                      <FiTarget className="w-6 h-6 text-accent" />
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
              <Card className="bg-card border-border/50" data-testid="avg-risks-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Avg Risks Identified</p>
                      <p className="text-4xl font-heading font-bold" data-testid="avg-risks-stat">
                        {insights.avg_risks_per_decision}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-500/10">
                      <FiAlertTriangle className="w-6 h-6 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Top Topics Chart */}
          {insights.top_topics && insights.top_topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <Card className="glass" data-testid="top-topics-card">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading flex items-center space-x-2">
                    <FiTrendingUp className="w-6 h-6 text-accent" />
                    <span>Top Topics</span>
                  </CardTitle>
                  <CardDescription>
                    Most frequently discussed topics in decisions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={insights.top_topics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="topic" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B0F17',
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill="#6366F1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Additional Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass" data-testid="insights-summary-card">
              <CardHeader>
                <CardTitle className="text-2xl font-heading">Key Insights</CardTitle>
                <CardDescription>Patterns discovered from your decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <h3 className="font-heading font-semibold mb-2 flex items-center space-x-2">
                      <FiTrendingUp className="w-5 h-5 text-primary" />
                      <span>Decision Making Trend</span>
                    </h3>
                    <p className="text-sm text-foreground/80">
                      Your team has made {insights.total_decisions} AI-assisted decisions, averaging{' '}
                      {insights.avg_recommendations_per_decision} recommendations per decision.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <h3 className="font-heading font-semibold mb-2 flex items-center space-x-2">
                      <FiTarget className="w-5 h-5 text-accent" />
                      <span>Risk Awareness</span>
                    </h3>
                    <p className="text-sm text-foreground/80">
                      The AI has identified an average of {insights.avg_risks_per_decision} risks per decision,
                      helping your team avoid potential pitfalls based on historical data.
                    </p>
                  </div>

                  {insights.top_topics && insights.top_topics.length > 0 && (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <h3 className="font-heading font-semibold mb-2 flex items-center space-x-2">
                        <FiBarChart2 className="w-5 h-5 text-green-500" />
                        <span>Focus Areas</span>
                      </h3>
                      <p className="text-sm text-foreground/80">
                        Most discussed topic: <strong>{insights.top_topics[0].topic}</strong> ({insights.top_topics[0].count} mentions)
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass" data-testid="no-insights">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No insights available yet</p>
              <p className="text-sm text-muted-foreground">
                Make more decisions to see patterns and trends
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default Insights;