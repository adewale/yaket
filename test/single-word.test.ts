import { describe, expect, it } from "vitest";

import { DirectedGraph } from "../src/graph.js";
import { SingleWord } from "../src/SingleWord.js";

describe("SingleWord scoring state", () => {
  it("starts as a non-stopword and records occurrence metadata exactly", () => {
    const graph = new DirectedGraph();
    const term = new SingleWord("alpha", 1, graph);

    expect(term.stopword).toBe(false);
    term.addOccur("a", 2, 4, 10);
    term.addOccur("n", 0, 1, 1);
    term.addOccur("p", 2, 5, 11);

    expect(term.tf).toBe(3);
    expect(term.tfA).toBe(1);
    expect(term.tfN).toBe(1);
    expect([...term.occurs.entries()]).toEqual([
      [2, [[4, 10], [5, 11]]],
      [0, [[1, 1]]],
    ]);
  });

  it("computes all single-word features from graph and occurrence state", () => {
    const graph = new DirectedGraph();
    const left = new SingleWord("left", 0, graph);
    const term = new SingleWord("alpha", 1, graph);
    const right = new SingleWord("right", 2, graph);
    for (const item of [left, term, right]) {
      graph.addNode(item.id);
    }

    term.addOccur("a", 2, 4, 10);
    term.addOccur("n", 0, 1, 1);
    term.addOccur("p", 4, 2, 20);
    graph.incrementEdge(left.id, term.id, 2);
    graph.incrementEdge(term.id, right.id, 3);
    graph.incrementEdge(term.id, left.id, 1);

    term.updateH({ maxTf: 5, avgTf: 2, stdTf: 1, numberOfSentences: 5 }, null);

    expect(term.pl).toBeCloseTo(0.2, 12);
    expect(term.pr).toBeCloseTo(0.4, 12);
    expect(term.wrel).toBeCloseTo(1.6, 12);
    expect(term.wfreq).toBeCloseTo(1, 12);
    expect(term.wspread).toBeCloseTo(0.6, 12);
    expect(term.wcase).toBeCloseTo(0.4765053580405044, 12);
    expect(term.wpos).toBeCloseTo(0.4758849953271106, 12);
    expect(term.h).toBeCloseTo(0.5156879305428768, 12);
  });

  it("uses the graph metrics cache until explicitly invalidated", () => {
    const graph = new DirectedGraph();
    const left = new SingleWord("left", 0, graph);
    const term = new SingleWord("alpha", 1, graph);
    const right = new SingleWord("right", 2, graph);
    for (const item of [left, term, right]) {
      graph.addNode(item.id);
    }

    term.addOccur("p", 0, 0, 0);
    term.addOccur("p", 1, 0, 1);
    graph.incrementEdge(term.id, right.id, 1);
    term.updateH({ maxTf: 2, avgTf: 1, stdTf: 0, numberOfSentences: 2 }, null);
    const cachedH = term.h;

    graph.incrementEdge(left.id, term.id, 4);
    term.updateH({ maxTf: 2, avgTf: 1, stdTf: 0, numberOfSentences: 2 }, null);
    expect(term.h).toBe(cachedH);

    term.invalidateGraphCache();
    term.updateH({ maxTf: 2, avgTf: 1, stdTf: 0, numberOfSentences: 2 }, null);
    expect(term.h).toBeGreaterThan(cachedH);
    expect(term.wrel).toBeCloseTo(2.25, 12);
  });

  it("feature filters update only the selected feature families", () => {
    const graph = new DirectedGraph();
    const term = new SingleWord("alpha", 1, graph);
    graph.addNode(term.id);
    term.addOccur("a", 0, 0, 0);
    term.addOccur("p", 1, 0, 1);

    term.updateH({ maxTf: 2, avgTf: 1, stdTf: 0, numberOfSentences: 2 }, ["wfreq"]);

    expect(term.wfreq).toBe(2);
    expect(term.wrel).toBe(1);
    expect(term.wspread).toBe(0);
    expect(term.wcase).toBe(0);
    expect(term.wpos).toBe(1);
    expect(term.h).toBeCloseTo(1 / 2, 12);
  });
});
