# TruthLens ML Model Implementation Plan

## Current State

The TruthLens backend currently utilizes a Naive Bayes Classifier implemented via the `natural` Node.js library. This model is currently trained **in-memory** every time the server starts. It uses a very limited, hardcoded set of text patterns to classify news content into three categories:

-   **FAKE**: Trained on sensationalist, clickbait phrases (e.g., "shocking truth revealed").
-   **REAL**: Trained on professional, journalistic phrases (e.g., "according to official report").
-   **SUSPICIOUS**: Trained on speculative or unverified phrasing (e.g., "sources say rumored").

While this serves as a functional proof-of-concept, it is not robust or scalable for a production environment.

## Goal

Transition the TruthLens machine learning capabilities from a basic, dynamically trained, hardcoded model to a robust, pre-trained, and persistent classification system capable of analyzing real-world news articles with higher accuracy.

## Proposed Upgrades

### Phase 1: Persistent Model Storage
Currently, the model trains itself on every server start. We need to decouple training from server execution.

-   **Task:** Create a separate training script (e.g., `backend/trainModel.js`).
-   **Task:** Modify the training script to save the trained classifier state to a file (e.g., `classifier.json`) using `natural`'s built-in save functionality.
-   **Task:** Update `backend/server.js` to load the pre-trained `classifier.json` file on startup instead of training from scratch. This drastically improves server startup time and paves the way for larger datasets.

### Phase 2: Expanded Training Dataset
The hardcoded phrases are insufficient. We need to train the model on a substantial corpus of known fake and real news data.

-   **Task:** Source a comprehensive dataset of fake and real news articles (e.g., datasets available on Kaggle like the "Fake News Dataset" or "ISOT Fake News Dataset").
-   **Task:** Update `trainModel.js` to parse this dataset (likely CSV or JSON format).
-   **Task:** Train the Naive Bayes Classifier on the article text and titles from the dataset. This will significantly increase the vocabulary and pattern recognition capabilities of the model.

### Phase 3: Advanced Feature Extraction & NLP
Relying solely on keyword frequency via Naive Bayes has limitations. We can improve accuracy by incorporating more sophisticated NLP techniques.

-   **Task:** Integrate Sentiment Analysis. Fake news often relies on extreme sentiment (highly negative or overly positive/sensationalist). We can extract the sentiment score of the article and use it as a feature in our overall credibility calculation.
-   **Task:** Implement Entity Recognition (using the existing `compromise` library). Identify the people, places, and organizations mentioned in the text. This allows for future features like fact-checking specific entities against external knowledge bases.
-   **Task:** Refine Text Preprocessing. Implement robust stemming, lemmatization, and stop-word removal before passing text to the classifier to improve the quality of the features the model learns.

### Phase 4: Integration with URL Analysis
Currently, the ML prediction and the URL feature analysis operate somewhat independently, combining only at the final step.

-   **Task:** Create a unified scoring model. Instead of merely averaging the URL trust score and the text ML score, train a secondary model (or adjust the weighting logic) that takes both the URL features (e.g., domain age, HTTPS, suspicious keywords) and the text classification confidence as inputs to produce a more holistic and accurate final credibility score.

## Implementation Timeline
This is a suggested roadmap. Prioritization can be adjusted based on immediate needs.

1.  **Immediate:** Phase 1 (Persistent Model Storage) - quick win for architectural soundness.
2.  **Short-term:** Phase 2 (Expanded Training Dataset) - biggest impact on model accuracy.
3.  **Medium-term:** Phase 3 (Advanced Feature Extraction) - finer-grained analysis.
4.  **Long-term:** Phase 4 (Unified Scoring Model) - holistic system optimization.
