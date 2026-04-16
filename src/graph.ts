export class DirectedGraph {
  private readonly outgoing = new Map<number, Map<number, number>>();
  private readonly incoming = new Map<number, Map<number, number>>();

  addNode(id: number): void {
    if (!this.outgoing.has(id)) {
      this.outgoing.set(id, new Map());
    }

    if (!this.incoming.has(id)) {
      this.incoming.set(id, new Map());
    }
  }

  hasEdge(source: number, target: number): boolean {
    return this.outgoing.get(source)?.has(target) ?? false;
  }

  incrementEdge(source: number, target: number, delta = 1): void {
    this.addNode(source);
    this.addNode(target);

    const outgoingEdges = this.outgoing.get(source)!;
    const incomingEdges = this.incoming.get(target)!;
    const nextWeight = (outgoingEdges.get(target) ?? 0) + delta;

    outgoingEdges.set(target, nextWeight);
    incomingEdges.set(source, nextWeight);
  }

  getWeight(source: number, target: number): number {
    return this.outgoing.get(source)?.get(target) ?? 0;
  }

  outDegree(id: number): number {
    return this.outgoing.get(id)?.size ?? 0;
  }

  inDegree(id: number): number {
    return this.incoming.get(id)?.size ?? 0;
  }

  outWeightSum(id: number): number {
    return [...(this.outgoing.get(id)?.values() ?? [])].reduce((sum, value) => sum + value, 0);
  }

  inWeightSum(id: number): number {
    return [...(this.incoming.get(id)?.values() ?? [])].reduce((sum, value) => sum + value, 0);
  }
}
