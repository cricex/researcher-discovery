import React from 'react';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

interface ResponseDisplayProps {
  response: QueryResponse;
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({ response }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

      {/* Response Content */}
      <div className="p-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <FileText className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-1">Orchestrator</p>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{response.response}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Confidence</p>
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${response.confidence * 100}%` }}
                  />
                </div>
                <span className="font-medium text-gray-900">
                  {Math.round(response.confidence * 100)}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-gray-500">Processing Time</p>
              <p className="font-medium text-gray-900 mt-1">
                {Math.round(response.metadata.processing_time_ms)}ms
              </p>
            </div>
          </div>
        </div>

        {/* Citations */}
        {response.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Sources ({response.citations.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {response.citations.slice(0, 5).map((citation, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                  title={citation}
                >
                  {citation.replace(/<\/?cite>/g, '').substring(0, 30)}...
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning (collapsible) */}
        {response.reasoning && (
          <details className="mt-4 pt-4 border-t border-gray-200">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-azure-blue">
              View Reasoning
            </summary>
            <p className="mt-2 text-sm text-gray-600">{response.reasoning}</p>
          </details>
        )}
      </div>
    </div>
  );
};

export default ResponseDisplay;
