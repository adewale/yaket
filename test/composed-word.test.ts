import { describe, expect, it } from "vitest";

import { ComposedWord } from "../src/ComposedWord.js";
import { DirectedGraph } from "../src/graph.js";
import { SingleWord } from "../src/SingleWord.js";

function term(unique: string, id: number, graph: DirectedGraph, h: number, tf: number, stopword = false): SingleWord {
  const result = new SingleWord(unique, id, graph);
  result.h = h;
  result.tf = tf;
  result.stopword = stopword;
  graph.addNode(id);
  return result;
}

describe("ComposedWord", () => {
  it("constructs normalized keyword state from candidate terms", () => {
    const graph = new DirectedGraph();
    const alpha = term("alpha", 1, graph, 2, 4);
    const beta = term("beta", 2, graph, 3, 5);

    const candidate = new ComposedWord([
      ["p", "Alpha", alpha, "alpha"],
      ["p", "Beta", beta, "beta"],
    ]);

    expect(candidate.kw).toBe("Alpha Beta");
    expect(candidate.uniqueKw).toBe("alpha beta");
    expect(candidate.size).toBe(2);
    expect(candidate.terms).toEqual([alpha, beta]);
    expect(candidate.startOrEndStopwords).toBe(false);
    expect(candidate.isValid()).toBe(true);
  });

  it("merges tags and rejects invalid tag-only candidates", () => {
    const graph = new DirectedGraph();
    const alpha = term("alpha", 1, graph, 2, 4);
    const candidate = new ComposedWord([["p", "Alpha", alpha, "alpha"]]);

    candidate.updateCand(new ComposedWord([["u", "Alpha", alpha, "alpha"]]));
    expect([...candidate.tags].sort()).toEqual(["p", "u"]);
    expect(candidate.isValid()).toBe(true);

    expect(new ComposedWord([["u", "Alpha", alpha, "alpha"]]).isValid()).toBe(false);
    expect(new ComposedWord([["d", "Alpha", alpha, "alpha"]]).isValid()).toBe(false);
  });

  it("rejects candidates that start or end with stopwords", () => {
    const graph = new DirectedGraph();
    const stop = term("and", 1, graph, 1, 3, true);
    const beta = term("beta", 2, graph, 3, 5);

    const startsWithStopword = new ComposedWord([
      ["p", "and", stop, "and"],
      ["p", "Beta", beta, "beta"],
    ]);
    const endsWithStopword = new ComposedWord([
      ["p", "Beta", beta, "beta"],
      ["p", "and", stop, "and"],
    ]);

    expect(startsWithStopword.startOrEndStopwords).toBe(true);
    expect(startsWithStopword.isValid()).toBe(false);
    expect(endsWithStopword.startOrEndStopwords).toBe(true);
    expect(endsWithStopword.isValid()).toBe(false);
  });

  it("computes multi-word scores with KPF and virtual tf branches", () => {
    const graph = new DirectedGraph();
    const alpha = term("alpha", 1, graph, 2, 4);
    const beta = term("beta", 2, graph, 3, 5);
    const candidate = new ComposedWord([
      ["p", "Alpha", alpha, "alpha"],
      ["p", "Beta", beta, "beta"],
    ]);

    candidate.tf = 2;
    candidate.updateH(null);
    expect(candidate.h).toBeCloseTo(0.5, 12);

    candidate.updateH([], true);
    expect(candidate.h).toBeCloseTo(0.2222222222222222, 12);
  });

  it("scores internal stopwords using bidirectional co-occurrence probability", () => {
    const graph = new DirectedGraph();
    const alpha = term("alpha", 1, graph, 2, 4);
    const stop = term("and", 2, graph, 10, 2, true);
    const beta = term("beta", 3, graph, 3, 5);
    graph.incrementEdge(alpha.id, stop.id, 2);
    graph.incrementEdge(stop.id, beta.id, 3);

    const candidate = new ComposedWord([
      ["p", "Alpha", alpha, "alpha"],
      ["p", "and", stop, "and"],
      ["p", "Beta", beta, "beta"],
    ]);
    candidate.tf = 1;
    candidate.updateH(null);

    expect(candidate.startOrEndStopwords).toBe(false);
    expect(candidate.isValid()).toBe(true);
    expect(candidate.h).toBeCloseTo(1.9245283018867925, 12);
  });
});
