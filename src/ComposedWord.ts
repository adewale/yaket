import { SingleWord } from "./SingleWord.js";
import { STOPWORD_WEIGHT } from "./utils.js";

type CandidateTerm = [tag: string, word: string, term: SingleWord | null];
type NormalizedCandidateTerm = [tag: string, word: string, term: SingleWord | null, normalizedWord?: string];

export class ComposedWord {
  readonly tags = new Set<string>();
  readonly kw: string;
  readonly uniqueKw: string;
  readonly size: number;
  readonly terms: SingleWord[];
  readonly startOrEndStopwords: boolean;
  order = 0;

  tf = 0;
  integrity = 1;
  h = 1;

  /**
   * Creates a composed-word candidate from token-tag-term tuples.
   */
  constructor(terms: NormalizedCandidateTerm[]) {
    if (terms.length === 0 || !terms.some(([, , term]) => term != null)) {
      throw new TypeError("ComposedWord requires at least one candidate term that exists in the document term index");
    }

    this.tags.add(terms.map(([tag]) => tag).join(""));
    this.kw = terms.map(([, word]) => word).join(" ");
    this.uniqueKw = terms.map(([, word, , normalizedWord]) => normalizedWord ?? word.toLowerCase()).join(" ");
    this.size = terms.length;
    this.terms = terms.map(([, , term]) => term).filter((term): term is SingleWord => term != null);
    this.startOrEndStopwords = this.terms.length === 0 || this.terms[0]!.stopword || this.terms[this.terms.length - 1]!.stopword;
  }

  /**
   * Merges tag information from another occurrence of the same candidate.
   */
  updateCand(candidate: ComposedWord): void {
    for (const tag of candidate.tags) {
      this.tags.add(tag);
    }
  }

  /**
   * Checks whether the candidate is valid for ranking.
   */
  isValid(): boolean {
    let validTag = false;

    for (const tag of this.tags) {
      validTag = validTag || (!tag.includes("u") && !tag.includes("d"));
    }

    return validTag && !this.startOrEndStopwords;
  }

  /**
   * Computes the final YAKE multi-word score.
   */
  updateH(features?: string[] | null, isVirtual = false): void {
    let sumH = 0;
    let prodH = 1;

    for (let index = 0; index < this.terms.length; index += 1) {
      const termBase = this.terms[index]!;

      if (!termBase.stopword) {
        sumH += termBase.h;
        prodH *= termBase.h;
        continue;
      }

      if (STOPWORD_WEIGHT === "bi") {
        let probT1 = 0;
        if (index > 0 && termBase.g.hasEdge(this.terms[index - 1]!.id, termBase.id)) {
          probT1 = termBase.g.getWeight(this.terms[index - 1]!.id, termBase.id) / this.terms[index - 1]!.tf;
        }

        let probT2 = 0;
        if (index < this.terms.length - 1 && termBase.g.hasEdge(termBase.id, this.terms[index + 1]!.id)) {
          probT2 = termBase.g.getWeight(termBase.id, this.terms[index + 1]!.id) / this.terms[index + 1]!.tf;
        }

        const prob = probT1 * probT2;
        prodH *= 1 + (1 - prob);
        sumH -= 1 - prob;
      }
    }

    let tfUsed = 1;
    if (features == null || features.includes("KPF")) {
      tfUsed = this.tf;
    }

    if (isVirtual) {
      const tfs = this.terms.map((term) => term.tf);
      tfUsed = tfs.length === 0 ? 1 : tfs.reduce((sum, value) => sum + value, 0) / tfs.length;
    }

    this.h = prodH / ((sumH + 1) * tfUsed);
  }
}

export type { CandidateTerm, NormalizedCandidateTerm };
