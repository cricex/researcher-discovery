import { describe, it, expect } from "vitest";
import { AgentRegistry } from "../../src/agents/registry.js";
import { IntentCategory } from "../../src/specs/index.js";
import { createStubAgent, createTestIntent } from "../helpers.js";

describe("AgentRegistry", () => {
  it("should be importable and constructable", () => {
    const registry = new AgentRegistry();
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(AgentRegistry);
  });

  it("should register and retrieve an agent", () => {
    const registry = new AgentRegistry();
    const agent = createStubAgent({ id: "agent-1", name: "Agent One" });
    registry.register(agent);
    expect(registry.has("agent-1")).toBe(true);
    expect(registry.get("agent-1")?.name).toBe("Agent One");
  });

  it("should list all registered agents", () => {
    const registry = new AgentRegistry();
    registry.register(createStubAgent({ id: "a" }));
    registry.register(createStubAgent({ id: "b" }));
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.size).toBe(2);
  });

  it("should throw when registering a duplicate agent id", () => {
    const registry = new AgentRegistry();
    registry.register(createStubAgent({ id: "dup" }));
    expect(() => registry.register(createStubAgent({ id: "dup" }))).toThrow(
      'Agent "dup" is already registered',
    );
  });

  it("should find agents that match an intent", () => {
    const registry = new AgentRegistry();
    registry.register(
      createStubAgent({ id: "researcher", categories: [IntentCategory.EXPERTISE_DISCOVERY] }),
    );
    registry.register(
      createStubAgent({ id: "collaborator", categories: [IntentCategory.COLLABORATION_INSIGHT] }),
    );

    const intent = createTestIntent({ category: IntentCategory.EXPERTISE_DISCOVERY });
    const matches = registry.findForIntent(intent);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("researcher");
  });
});
