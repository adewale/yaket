# Dataset Benchmarks

These benchmark scripts compare Yaket to upstream Python YAKE on standard keyphrase datasets.

Prerequisite:

```bash
python -m pip install numpy networkx segtok jellyfish
```

## inspec

- examples evaluated: 5
- average top-10 overlap with Python YAKE: 4.20
- Yaket precision@10 against gold keyphrases: 0.180
- Python YAKE precision@10 against gold keyphrases: 0.240
- average Yaket runtime per document (ms): 2.10
- average Python YAKE runtime per document (ms): 204.68

### Sample document

- id: 1949
- Yaket top-5: monte carlo calculations, measurement systems reports, vivo measurement systems, monte carlo, graphical user interface
- Python top-5: magnetic resonance imaging, monte carlo calculations, measurement systems reports, mcnp input data, vivo measurement systems
- Gold keyphrases: graphical user interface, computation phantoms, calibration, in vivo measurement systems, computational phantoms, monte carlo calculations, in vivo measurements, radionuclides, tissues, worker

## semeval2010

- examples evaluated: 5
- average top-10 overlap with Python YAKE: 8.40
- Yaket precision@10 against gold keyphrases: 0.140
- Python YAKE precision@10 against gold keyphrases: 0.080
- average Yaket runtime per document (ms): 69.84
- average Python YAKE runtime per document (ms): 270.70

### Sample document

- id: C-20
- Yaket top-5: data center, live server migration, data center migration, server migration, data
- Python top-5: data center, live server migration, data center migration, server migration, data
- Gold keyphrases: data center migration, storage replication, (lan), lan, virtual server,, virtual server, storage, (wan),, wan, data center migration,
