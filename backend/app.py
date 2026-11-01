
import os
import logging
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
API_URL = "https://serpapi.com/search.json"

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "").strip()


def valid_http_url(value):
    """Accept only ordinary HTTP or HTTPS URLs."""
    if not isinstance(value, str):
        return None

    value = value.strip()
    parsed = urlparse(value)

    if parsed.scheme in ("http", "https") and parsed.netloc:
        return value

    return None


def search_shopping(query):
    """Fetch current Google Shopping results through SerpApi."""
    if not SERPAPI_KEY:
        raise RuntimeError(
            "API key is missing. Add SERPAPI_KEY to backend/.env."
        )

    params = {
        "engine": "google_shopping",
        "q": query,
        "gl": "in",
        "hl": "en",
        "location": "India",
        "api_key": SERPAPI_KEY,
    }

    try:
        response = requests.get(
            API_URL,
            params=params,
            timeout=30,
        )
    except requests.RequestException as exc:
        app.logger.warning("Shopping request failed: %s", exc)
        raise RuntimeError(
            "Could not connect to the product search service. Try again."
        ) from exc

    if response.status_code == 401 or response.status_code == 403:
        raise RuntimeError(
            "The API key was rejected or API access is unavailable. "
            "Check your SerpApi dashboard and key."
        )

    if response.status_code == 429:
        raise RuntimeError(
            "The API search limit may have been reached. "
            "Check your SerpApi account usage."
        )

    if not response.ok:
        app.logger.warning(
            "SerpApi returned HTTP %s", response.status_code
        )
        raise RuntimeError(
            "The product search service returned an error. Try again."
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError(
            "The product search service returned an invalid response."
        ) from exc

    if data.get("error"):
        app.logger.warning("SerpApi API error: %s", data["error"])
        raise RuntimeError(str(data["error"]))

    return data.get("shopping_results", [])


def normalise_product(item):
    """Keep only product fields actually returned by the source."""
    title = item.get("title")
    if not isinstance(title, str) or not title.strip():
        return None

    price = item.get("extracted_price")
    try:
        price = float(price) if price is not None else None
    except (TypeError, ValueError):
        price = None

    rating = item.get("rating")
    try:
        rating = float(rating) if rating is not None else None
        if rating is not None and not 0 <= rating <= 5:
            rating = None
    except (TypeError, ValueError):
        rating = None

    reviews = item.get("reviews")
    try:
        reviews = int(reviews) if reviews is not None else None
        if reviews is not None and reviews < 0:
            reviews = None
    except (TypeError, ValueError):
        reviews = None

    # Prefer a merchant URL if supplied. Otherwise, use the
    # Google Shopping product listing URL returned by the API.
    merchant_url = valid_http_url(item.get("link"))
    shopping_url = valid_http_url(item.get("product_link"))
    purchase_url = merchant_url or shopping_url

    image_url = valid_http_url(item.get("thumbnail"))

    return {
        "title": title.strip(),
        "price": price,
        "priceText": item.get("price") or (
            f"{price:.2f}" if price is not None else "Price unavailable"
        ),
        "merchant": item.get("source") or "Merchant not provided",
        "rating": rating,
        "reviews": reviews,
        "image": image_url,
        "purchaseUrl": purchase_url,
        "linkType": (
            "merchant" if merchant_url
            else "shopping" if shopping_url
            else "unavailable"
        ),
        "position": item.get("position"),
        "score": None,
        "scoreNote": "",
    }


def calculate_scores(products):
    """Compare returned products using only available numeric data."""
    priced = [
        p["price"] for p in products if p["price"] is not None
    ]
    min_price = min(priced) if priced else None
    max_price = max(priced) if priced else None

    for product in products:
        parts = []
        weights = []

        rating = product["rating"]
        if rating is not None:
            parts.append((rating / 5) * 100 * 0.50)
            weights.append(0.50)

        price = product["price"]
        if price is not None and min_price is not None:
            if max_price == min_price:
                price_score = 100
            else:
                price_score = (
                    (max_price - price) / (max_price - min_price)
                ) * 100
            parts.append(price_score * 0.30)
            weights.append(0.30)

        reviews = product["reviews"]
        if reviews is not None:
            review_score = min(reviews / 500, 1) * 100
            parts.append(review_score * 0.20)
            weights.append(0.20)

        if weights:
            product["score"] = round(
                sum(parts) / sum(weights), 1
            )
            product["scoreNote"] = (
                "Based on available rating (50%), relative price (30%), "
                "and review count (20%). Missing fields are excluded. "
                "This is a comparison score, not a verified seller-trust score."
            )
        else:
            product["scoreNote"] = (
                "A score could not be calculated because rating, "
                "price, and review-count data were unavailable."
            )

    return products


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/style.css")
def stylesheet():
    return send_from_directory(FRONTEND_DIR, "style.css")


@app.route("/app.js")
def javascript():
    return send_from_directory(FRONTEND_DIR, "app.js")


@app.route("/api/search")
def search():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({"error": "Enter a product to search for."}), 400

    if len(query) > 150:
        return jsonify({"error": "Please use a shorter search term."}), 400

    try:
        raw_results = search_shopping(query)
        products = []

        for item in raw_results:
            product = normalise_product(item)
            if product is not None:
                products.append(product)

        products = calculate_scores(products)
        products.sort(
            key=lambda p: (
                p["score"] is not None,
                p["score"] if p["score"] is not None else -1
            ),
            reverse=True,
        )

        return jsonify({
            "query": query,
            "source": "Google Shopping via SerpApi",
            "isLiveSearch": True,
            "count": len(products),
            "products": products,
            "message": (
                "Results are from the live search response. "
                "Prices and availability may change."
            ) if products else (
                "No product results were returned for this search."
            ),
        })

    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception:
        app.logger.exception("Unexpected search error")
        return jsonify({
            "error": "Unexpected server error. Check the terminal for details."
        }), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
