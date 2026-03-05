/**
 * orchestration-agent — main entry point.
 *
 * Re-exports the public API surface.
 */

// Shared contracts
export * from './specs/index.js';

// Orchestrator pipeline
export { Orchestrator } from './orchestrator/index.js';
export { DefaultClassifier } from './orchestrator/classifier/index.js';
export { DefaultAggregator } from './orchestrator/aggregator/index.js';
export { DefaultRouter } from './orchestrator/router.js';

// Agent registry
export { AgentRegistry } from './agents/index.js';
