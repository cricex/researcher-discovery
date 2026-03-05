import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

interface OrchestrationFlowProps {
  flow: {
    query: string;
    intents: string[];
    agents_called: string[];
    current_step: string;
    progress: number;
  };
}

const OrchestrationFlow: React.FC<OrchestrationFlowProps> = ({ flow }) => {
  const steps = [
    { id: 'intents_classified', label: 'Intent Classification' },
    { id: 'agents_determined', label: 'Agent Selection' },
    { id: 'calling_agents', label: 'Calling Agents' },
    { id: 'aggregating', label: 'Aggregating Responses' },
    { id: 'complete', label: 'Complete' }
  ];

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === flow.current_step);

    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const agentColors: Record<string, string> = {
    'expertise_discovery': 'bg-blue-500',
    'research_output': 'bg-green-500',
    'collaboration_insight': 'bg-purple-500',
    'policy_compliance': 'bg-orange-500'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Orchestration Flow
      </h3>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-medium text-azure-blue">
            {Math.round(flow.progress * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-azure-blue h-2 rounded-full transition-all duration-500"
            style={{ width: `${flow.progress * 100}%` }}
          />
        </div>
      </div>

      {/* Detected Intents */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Detected Intents</h4>
        <div className="flex flex-wrap gap-2">
          {flow.intents.map((intent, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-azure-light bg-opacity-20 text-azure-blue rounded-full text-xs font-medium"
            >
              {intent.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Agents Called */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Agents Invoked</h4>
        <div className="space-y-2">
          {flow.agents_called.map((agent, idx) => (
            <div key={idx} className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${agentColors[agent] || 'bg-gray-400'}`} />
              <span className="text-sm text-gray-700 capitalize">
                {agent.replace('_', ' ')}
              </span>
              {flow.current_step === 'complete' && (
                <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
              )}
              {flow.current_step === 'calling_agents' && (
                <Loader2 className="w-4 h-4 text-azure-blue ml-auto animate-spin" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Processing Steps */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Processing Steps</h4>
        <div className="space-y-3">
          {steps.map((step) => {
            const status = getStepStatus(step.id);

            return (
              <div key={step.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {status === 'complete' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {status === 'active' && (
                    <Loader2 className="w-5 h-5 text-azure-blue animate-spin" />
                  )}
                  {status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    status === 'complete' ? 'text-green-700' :
                    status === 'active' ? 'text-azure-blue' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrchestrationFlow;
