import { describe, expect, it } from "vitest";

import { SingleWord } from "../src/index.js";
import { DirectedGraph } from "../src/graph.js";

/**
 * Direct unit tests for the small graph used by `DataCore` to track YAKE
 * co-occurrence. The graph is an internal data structure but its
 * invariants (symmetric in/out edges, weight accumulation, empty-default
 * semantics) directly drive every `wrel`/`wfreq` score.
 */
describe("DirectedGraph", () => {
  it("starts with no edges or nodes, returning the empty default for every lookup", () => {
    const graph = new DirectedGraph();
    expect(graph.hasEdge(1, 2)).toBe(false);
    expect(graph.getWeight(1, 2)).toBe(0);
    expect(graph.outDegree(1)).toBe(0);
    expect(graph.inDegree(1)).toBe(0);
    expect(graph.outWeightSum(1)).toBe(0);
    expect(graph.inWeightSum(1)).toBe(0);
  });

  it("addNode is idempotent and does not create edges", () => {
    const graph = new DirectedGraph();
    graph.addNode(7);
    graph.addNode(7);
    expect(graph.outDegree(7)).toBe(0);
    expect(graph.inDegree(7)).toBe(0);
    expect(graph.hasEdge(7, 7)).toBe(false);
  });

  it("incrementEdge accumulates weight on the same edge", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(1, 2);
    graph.incrementEdge(1, 2);
    graph.incrementEdge(1, 2, 5);
    expect(graph.getWeight(1, 2)).toBe(7);
    expect(graph.hasEdge(1, 2)).toBe(true);
    expect(graph.outDegree(1)).toBe(1);
    expect(graph.inDegree(2)).toBe(1);
  });

  it("treats incrementEdge as directional — reverse direction is unaffected", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(1, 2, 3);
    expect(graph.getWeight(1, 2)).toBe(3);
    expect(graph.getWeight(2, 1)).toBe(0);
    expect(graph.hasEdge(2, 1)).toBe(false);
    expect(graph.outDegree(2)).toBe(0);
    expect(graph.inDegree(1)).toBe(0);
  });

  it("incrementEdge auto-creates missing source and target nodes", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(10, 20);
    // Adjacent edges still return zero degree on unrelated lookups.
    expect(graph.outDegree(10)).toBe(1);
    expect(graph.inDegree(20)).toBe(1);
    expect(graph.outDegree(20)).toBe(0);
    expect(graph.inDegree(10)).toBe(0);
  });

  it("outDegree counts distinct neighbors, outWeightSum sums their weights", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(1, 2, 4);
    graph.incrementEdge(1, 3);
    graph.incrementEdge(1, 4, 7);
    expect(graph.outDegree(1)).toBe(3);
    expect(graph.outWeightSum(1)).toBe(4 + 1 + 7);
    expect(graph.inDegree(1)).toBe(0);
    expect(graph.inWeightSum(1)).toBe(0);
  });

  it("inDegree and inWeightSum mirror outDegree / outWeightSum at the target", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(1, 99, 2);
    graph.incrementEdge(2, 99, 5);
    graph.incrementEdge(3, 99);
    expect(graph.inDegree(99)).toBe(3);
    expect(graph.inWeightSum(99)).toBe(2 + 5 + 1);
  });

  it("supports negative delta to decrement weight without changing degree", () => {
    const graph = new DirectedGraph();
    graph.incrementEdge(1, 2, 5);
    graph.incrementEdge(1, 2, -3);
    expect(graph.getWeight(1, 2)).toBe(2);
    expect(graph.outDegree(1)).toBe(1);
  });
});

describe("SingleWord co-occurrence cache invalidation", () => {
  it("recomputes graph metrics after invalidateGraphCache is called", () => {
    const graph = new DirectedGraph();
    const left = new SingleWord("left", 0, graph);
    const right = new SingleWord("right", 1, graph);

    // No edges yet: pl/pr should drop out as 0/0 patterns.
    left.updateH({ maxTf: 1, avgTf: 1, stdTf: 0, numberOfSentences: 1 });
    const beforePr = left.pr;

    graph.incrementEdge(left.id, right.id, 3);
    // Without invalidating, the cached graph metrics drive the same result.
    left.updateH({ maxTf: 1, avgTf: 1, stdTf: 0, numberOfSentences: 1 });
    expect(left.pr).toBe(beforePr);

    left.invalidateGraphCache();
    left.updateH({ maxTf: 1, avgTf: 1, stdTf: 0, numberOfSentences: 1 });
    // After invalidation, the new outgoing edge moves pr away from the old value.
    expect(left.pr).not.toBe(beforePr);
  });
});
