import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FiClock, FiCheck, FiX, FiAlertTriangle, FiTarget } from 'react-icons/fi';

const Decisions = () => {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    try {
      const data = await api.getDecisions(50);
      setDecisions(data.decisions || []);
    } catch (error) {
      console.error('Error loading decisions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-4" data-testid="decisions-title">
          Decision History
        </h1>
        <p className="text-lg text-muted-foreground">
          Review past AI recommendations and outcomes
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-secondary/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : decisions.length > 0 ? (
        <div className="space-y-6" data-testid="decisions-list">
          {decisions.map((decision, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="bg-card border-border/50 hover:border-primary/30 transition-colors" data-testid={`decision-${idx}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-heading mb-2">
                        {decision.question}
                      </CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <FiClock className="w-4 h-4" />
                        <span>{new Date(decision.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  {decision.summary && (
                    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <p className="text-sm text-foreground/90">{decision.summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* What Worked */}
                    {decision.what_worked && decision.what_worked.length > 0 && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiCheck className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-heading font-semibold">What Worked</span>
                        </div>
                        <ul className="space-y-1 text-xs text-foreground/80">
                          {decision.what_worked.slice(0, 3).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* What Failed */}
                    {decision.what_failed && decision.what_failed.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiX className="w-4 h-4 text-red-500" />
                          <span className="text-sm font-heading font-semibold">What Failed</span>
                        </div>
                        <ul className="space-y-1 text-xs text-foreground/80">
                          {decision.what_failed.slice(0, 3).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risks */}
                    {decision.risks && decision.risks.length > 0 && (
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiAlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-heading font-semibold">Risks</span>
                        </div>
                        <ul className="space-y-1 text-xs text-foreground/80">
                          {decision.risks.slice(0, 3).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {decision.recommendations && decision.recommendations.length > 0 && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiTarget className="w-4 h-4 text-primary" />
                          <span className="text-sm font-heading font-semibold">Recommendations</span>
                        </div>
                        <ul className="space-y-1 text-xs text-foreground/80">
                          {decision.recommendations.slice(0, 3).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass" data-testid="no-decisions">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No decisions yet</p>
              <p className="text-sm text-muted-foreground">
                Start asking questions to build your decision history
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default Decisions;