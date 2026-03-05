# Squad Team

> orchestration-agent — An orchestration agent that routes user intents to specialized agents, manages an agent registry, and aggregates responses.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Mal | Lead / Architect | `.squad/agents/mal/charter.md` | 🏗️ Active |
| Kaylee | Backend Dev | `.squad/agents/kaylee/charter.md` | 🔧 Active |
| River | Classifier Dev | `.squad/agents/river/charter.md` | 🔧 Active |
| Wash | Frontend Dev | `.squad/agents/wash/charter.md` | ⚛️ Active |
| Zoe | Tester / DevOps | `.squad/agents/zoe/charter.md` | 🧪 Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Active |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Project Context

- **Owner:** msftsean
- **Project:** orchestration-agent
- **Stack:** TypeScript, Node.js
- **Universe:** Firefly
- **Created:** 2026-03-05

## Work Areas

| Area | Primary Owner | Backup |
|------|---------------|--------|
| Orchestrator Core | Kaylee | Mal (review) |
| Intent Classifier | River | Mal (review) |
| Agent Registry | Kaylee | River |
| Response Aggregator | Kaylee | Mal (review) |
| UI Development | Wash | Kaylee |
| Integration Testing | Zoe | All (test their own) |
| CI/CD & DevOps | Zoe | Mal (review) |
