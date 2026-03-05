import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, Loader2, Network, Database, CheckCircle, XCircle, Clock } from 'lucide-react';
import OrchestrationFlow from './components/OrchestrationFlow';
import ResponseDisplay from './components/ResponseDisplay';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

interface QueryResponse {
  query_id: string;
  session_id: string;
  query: string;
  response: string;
  agents_invoked: string[];
  citations: string[];
  confidence: number;
  reasoning: string;
  metadata: {
    processing_time_ms: number;
    agents_called: number;
  };
  timestamp: string;
}

interface ConversationTurn {
  query: string;
  response: QueryResponse | null;
  isLoading: boolean;
  error?: string;
}

function App() {
  const [query, setQuery] = useState('');
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orchestrationFlow, setOrchestrationFlow] = useState<{
    query: string;
    intents: string[];
    agents_called: string[];
    current_step: string;
    progress: number;
  } | null>(null);
  const [apiHealth, setApiHealth] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      setApiHealth(response.data.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch {
      setApiHealth('unhealthy');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || isProcessing) return;

    const userQuery = query.trim();
    setQuery('');

    const newTurn: ConversationTurn = {
      query: userQuery,
      response: null,
      isLoading: true
    };

    setConversation(prev => [...prev, newTurn]);
    setIsProcessing(true);

    setOrchestrationFlow({
      query: userQuery,
      intents: ['expertise_discovery', 'research_output'],
      agents_called: ['expertise_discovery', 'research_output', 'policy_compliance'],
      current_step: 'calling_agents',
      progress: 0.3
    });

    try {
      const response = await axios.post<QueryResponse>(`${API_BASE_URL}/api/v1/query`, {
        query: userQuery,
        session_id: sessionId,
        include_reasoning: true
      });

      setConversation(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          query: userQuery,
          response: response.data,
          isLoading: false
        };
        return updated;
      });

      setOrchestrationFlow(prev => prev ? {
        ...prev,
        current_step: 'complete',
        progress: 1.0
      } : null);

    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      console.error('Query failed:', error);

      setConversation(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          query: userQuery,
          response: null,
          isLoading: false,
          error: axiosError.response?.data?.detail || 'Failed to process query'
        };
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const testQueries = [
    "Who at UMB works on culturally responsive autism interventions?",
    "What has UMB published on autism health disparities?",
    "What NIH grants fund autism early intervention research?",
    "Summarize potential collaborators, funding opportunities, and compliance steps"
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Network className="w-8 h-8 text-azure-blue" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Team 4: Orchestration Agent
                </h1>
                <p className="text-sm text-gray-500">Multi-Agent Research Collaboration Discovery</p>
              </div>
            </div>

            {/* Health Status */}
            <div className="flex items-center space-x-2">
              {apiHealth === 'healthy' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600">API Healthy</span>
                </>
              )}
              {apiHealth === 'unhealthy' && (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-gray-600">API Offline</span>
                </>
              )}
              {apiHealth === 'checking' && (
                <>
                  <Clock className="w-5 h-5 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-600">Checking...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">

              {/* Conversation Area */}
              <div className="h-[600px] overflow-y-auto p-6 space-y-6">

                {conversation.length === 0 && (
                  <div className="text-center py-12">
                    <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Welcome to the Orchestration Agent
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Ask questions about UMB researchers, collaborations, grants, and policies
                    </p>

                    {/* Test Queries */}
                    <div className="space-y-2 max-w-2xl mx-auto">
                      <p className="text-sm font-medium text-gray-700 mb-3">Try these example queries:</p>
                      {testQueries.map((testQuery, idx) => (
                        <button
                          key={idx}
                          onClick={() => setQuery(testQuery)}
                          className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-azure-blue hover:text-white rounded-lg text-sm transition-colors border border-gray-200"
                        >
                          {testQuery}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Turns */}
                {conversation.map((turn, idx) => (
                  <div key={idx} className="space-y-4">

                    {/* User Query */}
                    <div className="flex justify-end">
                      <div className="bg-azure-blue text-white rounded-lg px-4 py-3 max-w-2xl">
                        <p className="text-sm font-medium mb-1">You</p>
                        <p>{turn.query}</p>
                      </div>
                    </div>

                    {/* Agent Response */}
                    {turn.isLoading && (
                      <div className="flex items-center space-x-3 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Orchestrating across agents...</span>
                      </div>
                    )}

                    {turn.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 text-sm">{turn.error}</p>
                      </div>
                    )}

                    {turn.response && (
                      <ResponseDisplay response={turn.response} />
                    )}
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSubmit} className="flex space-x-3">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask about researchers, collaborations, grants, or policies..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-azure-blue focus:border-transparent"
                    disabled={isProcessing}
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !query.trim()}
                    className="px-6 py-3 bg-azure-blue text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column: Orchestration Visualization */}
          <div className="lg:col-span-1">
            {orchestrationFlow && (
              <OrchestrationFlow flow={orchestrationFlow} />
            )}

            {!orchestrationFlow && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Orchestration Flow
                </h3>
                <p className="text-sm text-gray-500">
                  Submit a query to see real-time orchestration visualization
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
