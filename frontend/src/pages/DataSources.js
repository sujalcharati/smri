import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { FaSlack, FaGoogleDrive, FaVideo } from 'react-icons/fa';
import { SiNotion } from 'react-icons/si';
import { FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';

const DataSources = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slackToken, setSlackToken] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const data = await api.getDataSources();
      setSources(data.sources || []);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSlack = async (e) => {
    e.preventDefault();
    if (!slackToken.trim()) return;

    try {
      await api.connectSlack(slackToken);
      alert('Slack connected successfully!');
      loadSources();
      setSlackToken('');
    } catch (error) {
      alert('Failed to connect Slack: ' + error.message);
    }
  };

  const handleSyncSlack = async (e) => {
    e.preventDefault();
    if (!slackChannel.trim()) return;

    setSyncing(true);
    try {
      const result = await api.syncSlack(slackChannel);
      alert(`Synced ${result.messages_synced} messages from Slack!`);
      setSlackChannel('');
    } catch (error) {
      alert('Failed to sync Slack: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const getSourceIcon = (type) => {
    switch (type) {
      case 'slack':
        return <FaSlack className="w-12 h-12" />;
      case 'google_docs':
        return <FaGoogleDrive className="w-12 h-12" />;
      case 'notion':
        return <SiNotion className="w-12 h-12" />;
      case 'meeting':
        return <FaVideo className="w-12 h-12" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-4" data-testid="data-sources-title">
          Data Sources
        </h1>
        <p className="text-lg text-muted-foreground">
          Connect your organizational data sources to build the knowledge base
        </p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-secondary/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {sources.map((source, idx) => (
              <motion.div
                key={source.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className={`bg-card border-border/50 hover:border-primary/30 transition-all duration-300 h-full ${
                    source.status === 'connected' ? 'ring-2 ring-primary/20' : ''
                  }`}
                  data-testid={`source-card-${source.type}`}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
                    <div
                      className={`p-4 rounded-xl ${
                        source.status === 'connected'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-secondary/50 text-muted-foreground'
                      }`}
                    >
                      {getSourceIcon(source.type)}
                    </div>
                    <div>
                      <h3 className="text-xl font-heading font-semibold mb-2">{source.name}</h3>
                      <div className="flex items-center justify-center space-x-2">
                        {source.status === 'connected' ? (
                          <>
                            <FiCheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-500">Connected</span>
                          </>
                        ) : (
                          <>
                            <FiXCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Not Connected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Slack Integration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass" data-testid="slack-integration-card">
              <CardHeader>
                <CardTitle className="text-2xl font-heading flex items-center space-x-3">
                  <FaSlack className="w-6 h-6 text-[#E01E5A]" />
                  <span>Slack Integration</span>
                </CardTitle>
                <CardDescription>
                  Connect Slack to ingest messages and conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleConnectSlack} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Slack Bot Token</label>
                    <Input
                      type="password"
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      placeholder="xoxb-your-slack-bot-token"
                      className="bg-secondary/50 border-border"
                      data-testid="slack-token-input"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Get your token from Slack API → Create App → OAuth & Permissions
                    </p>
                  </div>
                  <Button type="submit" className="w-full" data-testid="connect-slack-button">
                    Connect Slack
                  </Button>
                </form>

                <div className="border-t border-border pt-6">
                  <h4 className="text-lg font-heading font-semibold mb-4">Sync Channel Messages</h4>
                  <form onSubmit={handleSyncSlack} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Channel ID</label>
                      <Input
                        value={slackChannel}
                        onChange={(e) => setSlackChannel(e.target.value)}
                        placeholder="C1234567890"
                        className="bg-secondary/50 border-border"
                        data-testid="slack-channel-input"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Right-click channel → View channel details → Copy channel ID
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={syncing}
                      className="w-full"
                      data-testid="sync-slack-button"
                    >
                      {syncing ? (
                        <>
                          <FiRefreshCw className="mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <FiRefreshCw className="mr-2" />
                          Sync Channel
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default DataSources;