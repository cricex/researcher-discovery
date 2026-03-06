<div align="center">

# 🚀 Orchestration Agent

### *Multi-Agent Research Orchestration System*

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square&logo=github-actions)](.)
[![Tests](https://img.shields.io/badge/tests-71%20passing-brightgreen?style=flat-square&logo=vitest)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript&logoColor=white)](.)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square)](.)
[![Node](https://img.shields.io/badge/node-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](.)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](.)

---

**Classify intents · Route to agents · Aggregate results · Beautiful UI**

</div>

---

## 🧠 What It Does

The **Orchestration Agent** is a multi-agent research system that classifies user queries into intents, routes them to specialized agents in parallel, and merges their responses into a unified result — complete with citations, confidence scoring, and safety filtering.

```
                    ┌─────────────────────────────────────────────────┐
                    │           ORCHESTRATION PIPELINE                │
                    │                                                 │
  User Query ──▶  🔍 Classify ──▶ 🔀 Route ──▶ 📡 Dispatch ──▶ 📊 Aggregate ──▶ ✅ Result
                    │                                                 │
                    └─────────────────────────────────────────────────┘
```

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| ✅ | **Multi-Intent Classification** | Detects multiple intents per query with confidence scoring |
| ✅ | **Parallel Agent Dispatch** | Fans out to specialized agents concurrently via `Promise.allSettled` |
| ✅ | **Citation Pipeline** | Tracks sources across agents with citation coverage scoring |
| ✅ | **Safety Filter (FR-007)** | Content safety filtering integrated into the pipeline |
| ✅ | **Graceful Degradation** | Mixed results handled — partial failures don't crash the system |
| ✅ | **Structured Logging** | JSON-formatted structured logs for observability |
| ✅ | **Performance Validated** | Pipeline timing and per-agent timeout enforcement (AbortController) |
| ✅ | **UI Formatting** | Markdown rendering with citation footnotes and confidence bars |

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Type-check the project
npm run typecheck

# Build for production
npm run build

# Watch mode (development)
npm run test:watch
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

---

## 🏗️ Architecture

The system follows a **4-stage pipeline** pattern. Each stage is defined as an interface in `src/specs/pipeline.ts` and composed by the `Orchestrator` class.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌───────────┐  │
│   │  CLASSIFY   │──▶│   ROUTE    │──▶│  DISPATCH   │──▶│ AGGREGATE │  │
│   │             │   │            │   │             │   │           │  │
│   │ KeywordClf  │   │ Registry   │   │ AllSettled  │   │ Merge +   │  │
│   │ classifyMul │   │ canHandle  │   │ Timeouts    │   │ Citations │  │
│   └────────────┘   └────────────┘   └────────────┘   └───────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Intent Categories

The classifier maps queries to one of five research-domain intents:

| Enum Value | Purpose |
|---|---|
| `EXPERTISE_DISCOVERY` | Find subject-matter experts and capabilities |
| `RESEARCH_OUTPUT` | Discover papers, publications, and research artifacts |
| `COLLABORATION_INSIGHT` | Analyze collaboration patterns and team dynamics |
| `POLICY_COMPLIANCE` | Check policy adherence and compliance requirements |
| `GENERAL` | Fallback for unclassified queries |

### Agent Endpoints

Agents implement the `Agent` interface from `src/specs/agent.ts`:
- **`canHandle(intent)`** — fast boolean check for capability matching
- **`execute(intent, context)`** — async execution returning `AgentResponse`
- **REST adapters** — `HttpAgent` wraps external endpoints via `AgentRegistry.registerEndpoint()`

---

## 📋 Version Matrix

| Component | Version | Status | Notes |
|-----------|---------|--------|-------|
| Node.js | 18+ | ✅ Supported | Runtime |
| TypeScript | 5.7+ | ✅ Supported | Strict mode, ESM |
| Vitest | 3.x | ✅ Supported | Test runner |
| Python | 3.12 | ✅ Supported | FastAPI backend |
| FastAPI | 0.100+ | ✅ Supported | REST API layer |
| React | 19 | ✅ Supported | Frontend UI |
| Vite | 5.x | ✅ Supported | Frontend bundler |
| Tailwind CSS | 3.x | ✅ Supported | Styling |

---

## 🧪 Test Status

```
 Tests   ████████████████████████████████████████  71/71   (100%)  ✅
 Types   ████████████████████████████████████████  Clean          ✅
 Lint    ████████████████████████████████████████  Pass           ✅
```

**Test suites cover:**
- 🔬 Intent classification (keyword matching, multi-intent)
- 🔌 Agent registry & dispatch
- 📊 Response aggregation & citation scoring
- ⚠️ Error handling, timeouts, graceful degradation
- 🔗 End-to-end integration pipeline
- 🛡️ Safety filtering (FR-007)
- ⏱️ Performance validation

---

## 📁 Project Structure

```
orchestration-agent/
├── src/
│   ├── specs/                  # 📜 Shared contracts & interfaces
│   │   ├── intent.ts           #    IntentCategory enum, ClassifiedIntent
│   │   ├── agent.ts            #    Agent, AgentCapability interfaces
│   │   ├── agent-contract.ts   #    REST agent contracts
│   │   ├── response.ts         #    AgentResponse, OrchestrationResult
│   │   └── pipeline.ts         #    Pipeline stage interfaces
│   ├── orchestrator/
│   │   ├── orchestrator.ts     # 🎯 Main pipeline orchestrator
│   │   ├── classifier/         # 🔍 Keyword-based intent classifier
│   │   ├── aggregator/         # 📊 Response aggregation & citations
│   │   ├── router.ts           # 🔀 Intent-to-agent routing
│   │   └── *.py                # 🐍 Python FastAPI implementations
│   ├── agents/                 # 🤖 Agent registry & HTTP adapters
│   ├── api/                    # 🌐 API layer
│   ├── ui/                     # 🎨 UI formatting (markdown, citations)
│   └── index.ts                # 📦 Barrel export
├── tests/                      # 🧪 Vitest test suites (71 tests)
├── frontend/                   # ⚛️  React 19 + Vite + Tailwind UI
├── docs/                       # 📖 Spec, integration guide, demo script
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 👥 Team

Built by a **Squad AI team** — a coordinated multi-agent development crew:

| Agent | Role | Focus Area |
|-------|------|------------|
| 🤠 **Mal** | Tech Lead | Architecture, specs, orchestrator core |
| 🔧 **Kaylee** | Backend Dev | Agent registry, routing, dispatch, pipeline wiring |
| 🧠 **River** | Specialist | Intent classifier, keyword matching, multi-intent |
| 🚀 **Wash** | Frontend Dev | UI formatting, React frontend, response display |
| 🎯 **Zoe** | Tester / DevOps | CI/CD, test infrastructure, performance validation |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Orchestration Agent Spec](docs/orchestration-agent-spec.md) | Full technical specification |
| [Integration Guide](docs/INTEGRATION_GUIDE.md) | How to integrate agents and consumers |
| [Demo Script](docs/DEMO_SCRIPT.md) | Interactive demo walkthrough |

---

## 📄 License

MIT

---

<div align="center">

*Built with ❤️ by the Squad AI team*

**Can't stop the signal. 🍃**

</div>
