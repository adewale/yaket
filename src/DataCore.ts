import { ComposedWord, type CandidateTerm } from "./ComposedWord.js";
import { DirectedGraph } from "./graph.js";
import { SingleWord } from "./SingleWord.js";
import { DEFAULT_EXCLUDE, getTag, preFilter, tokenizeSentences, tokenizeWords } from "./utils.js";

type BlockWord = [tag: string, word: string, term: SingleWord];

interface DataCoreConfig {
  windowsSize?: number;
  n?: number;
  tagsToDiscard?: Set<string>;
  exclude?: ReadonlySet<string>;
}

export class DataCore {
  readonly exclude: ReadonlySet<string>;
  readonly tagsToDiscard: Set<string>;
  readonly stopwordSet: Set<string>;
  readonly g = new DirectedGraph();
  readonly terms = new Map<string, SingleWord>();
  readonly candidates = new Map<string, ComposedWord>();
  readonly sentencesObj: BlockWord[][][] = [];
  readonly sentencesStr: string[][] = [];
  readonly freqNs: Record<number, number> = {};

  numberOfSentences = 0;
  numberOfWords = 0;

  private candidateOrder = 0;

  constructor(text: string, stopwordSet: Set<string>, config: DataCoreConfig = {}) {
    const n = config.n ?? 3;
    this.exclude = config.exclude ?? DEFAULT_EXCLUDE;
    this.tagsToDiscard = config.tagsToDiscard ?? new Set(["u", "d"]);
    this.stopwordSet = stopwordSet;

    for (let index = 1; index <= n; index += 1) {
      this.freqNs[index] = 0;
    }

    this.build(text, config.windowsSize ?? 2, n);
  }

  getTag(word: string, index: number): string {
    return getTag(word, index, this.exclude);
  }

  buildCandidate(candidateString: string): ComposedWord {
    const tokenizedWords = tokenizeWords(candidateString.toLowerCase())
      .filter((token) => !((token.startsWith("'") || token.startsWith("’")) && token.length > 1) && token.length > 0);

    const candidateTerms: CandidateTerm[] = [];
    for (const [index, word] of tokenizedWords.entries()) {
      const tag = this.getTag(word, index);
      let termObj: SingleWord | null = this.getTerm(word, false);

      if (termObj.tf === 0) {
        termObj = null;
      }

      candidateTerms.push([tag, word, termObj]);
    }

    if (!candidateTerms.some(([, , term]) => term != null)) {
      return new ComposedWord(null);
    }

    return new ComposedWord(candidateTerms);
  }

  buildSingleTermsFeatures(features?: string[] | null): void {
    const validTerms = [...this.terms.values()].filter((term) => !term.stopword);
    if (validTerms.length === 0) {
      return;
    }

    const validTfs = validTerms.map((term) => term.tf);
    const avgTf = validTfs.reduce((sum, value) => sum + value, 0) / validTfs.length;
    const stdTf = Math.sqrt(validTfs.reduce((sum, value) => sum + ((value - avgTf) ** 2), 0) / validTfs.length);
    const maxTf = Math.max(...[...this.terms.values()].map((term) => term.tf));

    for (const term of this.terms.values()) {
      term.updateH({ maxTf, avgTf, stdTf, numberOfSentences: this.numberOfSentences }, features);
    }
  }

  buildMultTermsFeatures(features?: string[] | null): void {
    for (const candidate of this.candidates.values()) {
      if (candidate.isValid()) {
        candidate.updateH(features);
      }
    }
  }

  getTerm(strWord: string, saveNonSeen = true): SingleWord {
    let uniqueTerm = strWord.toLowerCase();
    const simpleStopword = this.stopwordSet.has(uniqueTerm);

    if (uniqueTerm.endsWith("s") && uniqueTerm.length > 3) {
      uniqueTerm = uniqueTerm.slice(0, -1);
    }

    const existing = this.terms.get(uniqueTerm);
    if (existing != null) {
      return existing;
    }

    let simpleUniqueTerm = uniqueTerm;
    for (const punctuation of this.exclude) {
      simpleUniqueTerm = simpleUniqueTerm.replaceAll(punctuation, "");
    }

    const isStopword = simpleStopword || this.stopwordSet.has(uniqueTerm) || simpleUniqueTerm.length < 3;
    const term = new SingleWord(uniqueTerm, this.terms.size, this.g);
    term.stopword = isStopword;

    if (saveNonSeen) {
      this.g.addNode(term.id);
      this.terms.set(uniqueTerm, term);
    }

    return term;
  }

  addCooccur(leftTerm: SingleWord, rightTerm: SingleWord): void {
    this.g.incrementEdge(leftTerm.id, rightTerm.id);
    leftTerm.invalidateGraphCache();
    rightTerm.invalidateGraphCache();
  }

  addOrUpdateComposedWord(candidate: ComposedWord): void {
    const existing = this.candidates.get(candidate.uniqueKw);

    if (existing == null) {
      candidate.order = this.candidateOrder;
      this.candidateOrder += 1;
      this.candidates.set(candidate.uniqueKw, candidate);
    } else {
      existing.updateCand(candidate);
    }

    this.candidates.get(candidate.uniqueKw)!.tf += 1;
  }

  private build(text: string, windowsSize: number, n: number): void {
    const filtered = preFilter(text);
    const sentences = tokenizeSentences(filtered);

    this.sentencesStr.push(...sentences);
    this.numberOfSentences = this.sentencesStr.length;

    let posText = 0;
    for (const [sentenceId, sentence] of this.sentencesStr.entries()) {
      posText = this.processSentence(sentence, sentenceId, posText, windowsSize, n);
    }

    this.numberOfWords = posText;
  }

  private processSentence(sentence: string[], sentenceId: number, posText: number, windowsSize: number, n: number): number {
    const sentenceObjAux: BlockWord[][] = [];
    let blockOfWordObj: BlockWord[] = [];

    for (const [posSent, word] of sentence.entries()) {
      if ([...word].every((char) => this.exclude.has(char))) {
        if (blockOfWordObj.length > 0) {
          sentenceObjAux.push(blockOfWordObj);
          blockOfWordObj = [];
        }
        continue;
      }

      posText = this.processWord(word, posText, sentenceId, posSent, blockOfWordObj, windowsSize, n);
    }

    if (blockOfWordObj.length > 0) {
      sentenceObjAux.push(blockOfWordObj);
    }

    if (sentenceObjAux.length > 0) {
      this.sentencesObj.push(sentenceObjAux);
    }

    return posText;
  }

  private processWord(word: string, posText: number, sentenceId: number, posSent: number, blockOfWordObj: BlockWord[], windowsSize: number, n: number): number {
    const tag = this.getTag(word, posSent);
    const termObj = this.getTerm(word);

    termObj.addOccur(tag, sentenceId, posSent, posText);
    posText += 1;

    if (!this.tagsToDiscard.has(tag)) {
      this.updateCooccurrence(blockOfWordObj, termObj, windowsSize);
    }

    this.generateCandidates([tag, word], termObj, blockOfWordObj, n);
    blockOfWordObj.push([tag, word, termObj]);

    return posText;
  }

  private updateCooccurrence(blockOfWordObj: BlockWord[], termObj: SingleWord, windowsSize: number): void {
    const start = Math.max(0, blockOfWordObj.length - windowsSize);

    for (let index = start; index < blockOfWordObj.length; index += 1) {
      const blockWord = blockOfWordObj[index]!;
      if (!this.tagsToDiscard.has(blockWord[0])) {
        this.addCooccur(blockWord[2], termObj);
      }
    }
  }

  private generateCandidates(term: [tag: string, word: string], termObj: SingleWord, blockOfWordObj: BlockWord[], n: number): void {
    const candidate: CandidateTerm[] = [[term[0], term[1], termObj]];
    this.addOrUpdateComposedWord(new ComposedWord(candidate));

    const start = Math.max(0, blockOfWordObj.length - (n - 1));
    for (let index = blockOfWordObj.length - 1; index >= start; index -= 1) {
      candidate.push(blockOfWordObj[index]!);
      this.freqNs[candidate.length] = (this.freqNs[candidate.length] ?? 0) + 1;
      this.addOrUpdateComposedWord(new ComposedWord([...candidate].reverse()));
    }
  }
}
