# TruthLens - Fake News Detection Platform

TruthLens is a modern, advanced AI/ML web application designed to detect and verify fake news by analyzing news sources, content, and cross-referencing information. It provides a premium, glassmorphism-themed user interface to present the credibility analysis with rich visualizations.

## Project Structure

This project uses a modular full-stack architecture separated into frontend and backend components.

### Frontend
- Built with **React** and **Vite** for fast development and optimized production builds.
- Uses **Chart.js** and **react-chartjs-2** for visualizing credibility scores and analysis results.
- Incorporates **Framer Motion** for smooth, dynamic micro-animations to enhance user engagement.
- Features a rich, glassmorphism-themed aesthetic with modern typography.
- Uses **Axios** for API communication with the backend.

### Backend
- Built with **Python** and **FastAPI** for high-performance, async API endpoints.
- Uses **scikit-learn** (Multinomial Naive Bayes + CountVectorizer) for text classification into FAKE / REAL / SUSPICIOUS categories.
- Integrates **httpx** for async HTTP requests to third-party News and Fact-Check APIs.
- Secure environment configuration via **python-dotenv**.
- Served with **Uvicorn** (ASGI server) with hot-reload support.

## Getting Started

Follow these steps to set up and run TruthLens locally:

### Prerequisites
- **Python 3.8+** (download from [python.org](https://python.org))
- **Node.js v16+** and **npm** (for the frontend)

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:
```bash
cd backend
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Configure your environment variables — edit the existing `.env` file and add your API keys:
```
NEWS_API_KEY=your_newsapi_key_here
FACT_CHECK_API_KEY=your_google_factcheck_key_here
PORT=5000
```

Start the FastAPI server:
```bash
python server.py
```
> The server runs with **hot-reload** enabled via Uvicorn. You can also access the interactive API docs at `http://localhost:5000/docs`.
The backend server typically runs on `http://localhost:5000` (or as configured in `.env`).

### 2. Frontend Setup

Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The frontend will typically be available at `http://localhost:5173`.

## Features
- **URL Credibility Verification:** Submit a news article URL to analyze its source and content credibility.
- **Explainability Panel:** Understand *why* an article was flagged, visualizing key metrics and linguistic analysis.
- **Cross-Verification:** Compare the provided news with multiple reputable sources.
- **Modern UI/UX:** Enjoy a sleek, responsive interface featuring interactive charts and glassmorphic design elements.

## Technologies Used

| Layer | Technology |
|---|---|
| **Frontend** | React.js, Vite, React Router |
| **Styling** | CSS Modules (Glassmorphism theme) |
| **Charts** | Chart.js, react-chartjs-2 |
| **Animations** | Framer Motion |
| **Backend** | Python 3, FastAPI, Uvicorn |
| **ML / NLP** | scikit-learn (Naive Bayes), CountVectorizer |
| **HTTP Client** | httpx (async) |
| **Config** | python-dotenv |
