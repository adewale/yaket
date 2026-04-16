import { DirectedGraph } from "./graph.js";

interface GraphMetrics {
  wdr: number;
  wir: number;
  pwr: number;
  wdl: number;
  wil: number;
  pwl: number;
}

interface WordStats {
  maxTf: number;
  avgTf: number;
  stdTf: number;
  numberOfSentences: number;
}

export class SingleWord {
  readonly id: number;
  readonly g: DirectedGraph;
  readonly uniqueTerm: string;
  readonly occurs = new Map<number, Array<[number, number]>>();

  stopword = false;
  h = 0;
  tf = 0;
  tfA = 0;
  tfN = 0;
  wfreq = 0;
  wcase = 0;
  wrel = 1;
  wpos = 1;
  wspread = 0;
  pl = 0;
  pr = 0;

  private graphMetricsCache: GraphMetrics | null = null;

  constructor(unique: string, id: number, graph: DirectedGraph) {
    this.uniqueTerm = unique;
    this.id = id;
    this.g = graph;
  }

  invalidateGraphCache(): void {
    this.graphMetricsCache = null;
  }

  addOccur(tag: string, sentenceId: number, posSent: number, posText: number): void {
    if (!this.occurs.has(sentenceId)) {
      this.occurs.set(sentenceId, []);
    }

    this.occurs.get(sentenceId)!.push([posSent, posText]);
    this.tf += 1;

    if (tag === "a") {
      this.tfA += 1;
    }

    if (tag === "n") {
      this.tfN += 1;
    }
  }

  updateH(stats: WordStats, features?: string[] | null): void {
    const graphMetrics = this.getGraphMetrics();

    if (features == null || features.includes("wrel")) {
      this.pl = graphMetrics.wdl / stats.maxTf;
      this.pr = graphMetrics.wdr / stats.maxTf;
      this.wrel = (0.5 + (graphMetrics.pwl * (this.tf / stats.maxTf))) + (0.5 + (graphMetrics.pwr * (this.tf / stats.maxTf)));
    }

    if (features == null || features.includes("wfreq")) {
      this.wfreq = this.tf / (stats.avgTf + stats.stdTf);
    }

    if (features == null || features.includes("wspread")) {
      this.wspread = this.occurs.size / stats.numberOfSentences;
    }

    if (features == null || features.includes("wcase")) {
      this.wcase = Math.max(this.tfA, this.tfN) / (1 + Math.log(this.tf));
    }

    if (features == null || features.includes("wpos")) {
      const sentenceIds = [...this.occurs.keys()].sort((a, b) => a - b);
      this.wpos = Math.log(Math.log(3 + median(sentenceIds)));
    }

    this.h = (this.wpos * this.wrel) / (this.wcase + (this.wfreq / this.wrel) + (this.wspread / this.wrel));
  }

  private getGraphMetrics(): GraphMetrics {
    if (this.graphMetricsCache != null) {
      return this.graphMetricsCache;
    }

    const wdr = this.g.outDegree(this.id);
    const wir = this.g.outWeightSum(this.id);
    const pwr = wir === 0 ? 0 : wdr / wir;

    const wdl = this.g.inDegree(this.id);
    const wil = this.g.inWeightSum(this.id);
    const pwl = wil === 0 ? 0 : wdl / wil;

    this.graphMetricsCache = { wdr, wir, pwr, wdl, wil, pwl };
    return this.graphMetricsCache;
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[mid]!;
  }

  return (values[mid - 1]! + values[mid]!) / 2;
}
