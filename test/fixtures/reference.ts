import type { KeywordExtractorOptions, KeywordScore } from "../../src/index.js";

export interface ReferenceCase {
  name: string;
  text: string;
  options: KeywordExtractorOptions;
  expected: KeywordScore[];
}

const kaggleExcerpt = "Google is acquiring data science community Kaggle. Sources tell us that Google is acquiring Kaggle, a platform that hosts data science and machine learning competitions.";
const smallEnglish = "data science and machine learning";
const dedupEnglish = "machine learning machine learning deep learning";
const specialCharacters = "Python 3.9+ is great! #programming @developer";
const germanSample = "Maschinelles Lernen und künstliche Intelligenz sind wichtige Technologien";
const portugueseSample = "Conta-me Histórias. Xutos inspiram projeto premiado.";
const boundarySample = "alpha and beta and gamma";
const longRepetitiveEnglish = Array.from({ length: 100 }, () => "data science machine learning").join(" ");

export const referenceCases: ReferenceCase[] = [
  {
    name: "english-kaggle-excerpt",
    text: kaggleExcerpt,
    options: { lan: "en", n: 3, top: 10 },
    expected: [
      ["science community Kaggle", 0.022868570857866734],
      ["community Kaggle", 0.047789707710865825],
      ["data science community", 0.06339941399255053],
      ["Google is acquiring", 0.06585622388814175],
      ["acquiring Kaggle", 0.07431205283498787],
      ["Kaggle", 0.0848594527055433],
      ["data science", 0.099599852153925],
      ["acquiring data science", 0.10626939210345991],
      ["science community", 0.12300103596901649],
      ["Google", 0.14277827942739202],
    ],
  },
  {
    name: "english-window-size",
    text: smallEnglish,
    options: { lan: "en", n: 2, top: 5, windowSize: 2 },
    expected: [
      ["data science", 0.04940384002065631],
      ["machine learning", 0.04940384002065631],
      ["data", 0.15831692877998726],
      ["learning", 0.15831692877998726],
      ["science", 0.29736558256021506],
    ],
  },
  {
    name: "english-dedup-on",
    text: dedupEnglish,
    options: { lan: "en", n: 2, top: 5, dedupLim: 0.9 },
    expected: [
      ["machine learning", 0.023072402583411963],
      ["learning deep", 0.041166451867834804],
      ["deep learning", 0.041166451867834804],
      ["learning machine", 0.04614480516682393],
      ["learning", 0.08154106429019745],
    ],
  },
  {
    name: "english-dedup-off",
    text: dedupEnglish,
    options: { lan: "en", n: 2, top: 5, dedupLim: 1 },
    expected: [
      ["machine learning", 0.023072402583411963],
      ["learning deep", 0.041166451867834804],
      ["deep learning", 0.041166451867834804],
      ["learning machine", 0.04614480516682393],
      ["learning", 0.08154106429019745],
    ],
  },
  {
    name: "english-special-characters",
    text: specialCharacters,
    options: { lan: "en", n: 1, top: 5 },
    expected: [
      ["Python", 0.05899937629682816],
      ["programming", 0.17881754828257995],
      ["developer", 0.17881754828257995],
      ["great", 0.2005079697193566],
    ],
  },
  {
    name: "german-reference",
    text: germanSample,
    options: { lan: "de", n: 2, top: 5 },
    expected: [
      ["Maschinelles Lernen", 0.023458380875189744],
      ["wichtige Technologien", 0.026233073037508336],
      ["künstliche Intelligenz", 0.04498862876540802],
      ["Technologien", 0.08596317751626563],
      ["Lernen", 0.1447773057422032],
    ],
  },
  {
    name: "portuguese-reference",
    text: portugueseSample,
    options: { lan: "pt", n: 3, top: 5 },
    expected: [
      ["Conta-me Histórias", 0.01984585111858601],
      ["Histórias", 0.09705179139403544],
      ["Conta-me", 0.2005079697193566],
      ["Xutos inspiram", 0.4456055016437946],
      ["projeto premiado", 0.4456055016437946],
    ],
  },
  {
    name: "english-boundary-filtering",
    text: boundarySample,
    options: { lan: "en", n: 2, top: 10 },
    expected: [
      ["alpha", 0.09568045026443411],
      ["gamma", 0.09568045026443411],
      ["beta", 0.15831692877998726],
    ],
  },
  {
    name: "english-long-repetitive",
    text: longRepetitiveEnglish,
    options: { lan: "en", n: 2, top: 5 },
    expected: [
      ["science machine", 0.000021801996753389333],
      ["data science", 0.00002180612257549257],
      ["machine learning", 0.00002180612257549257],
      ["learning data", 0.00002203055472734129],
      ["science", 0.00046641791831459765],
    ],
  },
];

export const emptyTexts = ["", "   ", "\n\t"];
export const stopwordOnlyText = "the a an is are was were";
