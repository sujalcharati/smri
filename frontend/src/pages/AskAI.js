import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { FiSend, FiLoader, FiCheckCircle, FiAlertCircle, FiLightbulb, FiTarget } from 'react-icons/fi';

const AskAI = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.query(question);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-4" data-testid="ask-ai-title">
          Ask AI
        </h1>
        <p className="text-lg text-muted-foreground">
          Get intelligent recommendations based on your organization's history
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass neon-glow mb-8" data-testid="query-input-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Your Question</CardTitle>
            <CardDescription>
              Ask about past campaigns, strategies, decisions, or best practices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., How should I launch this product? What went wrong in past campaigns?"
                className="min-h-[120px] bg-secondary/50 border-border focus:border-primary tracing-beam text-base"
                data-testid="question-input"
              />
              <Button
                type="submit"
                disabled={loading || !question.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300 hover:scale-[1.02]"
                data-testid="submit-question-button"
              >
                {loading ? (
                  <>
                    <FiLoader className="mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FiSend className="mr-2" />
                    Get AI Recommendation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-destructive/10 border-destructive/50" data-testid="error-card">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-destructive">
                <FiAlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="bg-card border-border/50" data-testid="result-card">
            <CardHeader>
              <CardTitle className="text-2xl font-heading flex items-center space-x-2">
                <FiLightbulb className="w-6 h-6 text-accent" />
                <span>AI Analysis</span>
              </CardTitle>
              <CardDescription>Question: {result.question}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <h3 className="text-lg font-heading font-semibold mb-2">Summary</h3>
                <p className="text-foreground/90" data-testid="summary-text">{result.answer.summary}</p>
              </div>

              {/* What Worked */}
              {result.answer.what_worked && result.answer.what_worked.length > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiCheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="text-lg font-heading font-semibold">What Worked</h3>
                  </div>
                  <ul className="space-y-2" data-testid="what-worked-list">
                    {result.answer.what_worked.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span className="text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What Failed */}
              {result.answer.what_failed && result.answer.what_failed.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiAlertCircle className="w-5 h-5 text-destructive" />
                    <h3 className="text-lg font-heading font-semibold">What Failed</h3>
                  </div>
                  <ul className="space-y-2" data-testid="what-failed-list">
                    {result.answer.what_failed.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-destructive mt-1">✗</span>
                        <span className="text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {result.answer.risks && result.answer.risks.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiAlertCircle className="w-5 h-5 text-yellow-500" />
                    <h3 className="text-lg font-heading font-semibold">Risks to Avoid</h3>
                  </div>
                  <ul className="space-y-2" data-testid="risks-list">
                    {result.answer.risks.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-yellow-500 mt-1">⚠</span>
                        <span className="text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {result.answer.recommendations && result.answer.recommendations.length > 0 && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiTarget className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold">Recommendations</h3>
                  </div>
                  <ul className="space-y-2" data-testid="recommendations-list">
                    {result.answer.recommendations.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-primary mt-1">→</span>
                        <span className="text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {result.answer.next_steps && result.answer.next_steps.length > 0 && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiCheckCircle className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-heading font-semibold">Next Steps</h3>
                  </div>
                  <ul className="space-y-2" data-testid="next-steps-list">
                    {result.answer.next_steps.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-accent font-bold mt-1">{idx + 1}.</span>
                        <span className="text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context Info */}
              <div className="text-sm text-muted-foreground text-center pt-4 border-t border-border">
                Based on {result.context_used} relevant sources from your organization's history
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AskAI;