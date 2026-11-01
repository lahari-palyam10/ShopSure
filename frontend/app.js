const searchForm = document.getElementById("search-form");
const queryInput = document.getElementById("product-query");
const searchButton = document.getElementById("search-button");

const resultsTitle = document.getElementById("results-title");
const resultCount = document.getElementById("result-count");
const statusMessage = document.getElementById("status-message");
const productResults = document.getElementById("product-results");

const filterToolbar = document.getElementById("filter-toolbar");
const minPriceInput = document.getElementById("min-price");
const maxPriceInput = document.getElementById("max-price");
const sortSelect = document.getElementById("sort-products");
const clearFiltersButton = document.getElementById("clear-filters");

let currentProducts = [];
let currentSourceMessage = "";


// CREATE HTML ELEMENTS

function makeElement(tag, className, text) {

    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}


// DISPLAY PRICE

function formatPrice(product) {

    if (product.priceText) {
        return product.priceText;
    }

    if (product.price !== null && product.price !== undefined) {
        return String(product.price);
    }

    return "Price unavailable";
}


// CONVERT PRICE INTO A NUMBER FOR FILTERING

function getNumericPrice(product) {

    if (typeof product.price === "number" &&
        Number.isFinite(product.price)) {

        return product.price;
    }

    const source = product.priceText || product.price || "";

    const cleaned = String(source)
        .replace(/,/g, "")
        .replace(/[^0-9.]/g, "");

    const value = Number(cleaned);

    return Number.isFinite(value) && cleaned !== ""
        ? value
        : null;
}


// CREATE PRODUCT CARD

function makeProductCard(product) {

    const card = makeElement("article", "product-card");

    const imageWrap = makeElement("div", "product-image-wrap");


    // PRODUCT IMAGE

    if (product.image) {

        const image = document.createElement("img");

        image.className = "product-image";
        image.src = product.image;
        image.alt = product.title || "Product image";
        image.loading = "lazy";

        image.addEventListener("error", () => {

            image.remove();

            if (!imageWrap.querySelector(".image-placeholder")) {

                imageWrap.appendChild(
                    makeElement(
                        "p",
                        "image-placeholder",
                        "Product image unavailable"
                    )
                );
            }
        });

        imageWrap.appendChild(image);

    } else {

        imageWrap.appendChild(
            makeElement(
                "p",
                "image-placeholder",
                "No image provided by the source"
            )
        );
    }


    // PRODUCT INFORMATION

    const info = makeElement("div", "product-info");

    info.appendChild(
        makeElement(
            "p",
            "merchant",
            product.merchant || "Merchant unavailable"
        )
    );

    info.appendChild(
        makeElement(
            "h3",
            "product-title",
            product.title || "Untitled product"
        )
    );

    info.appendChild(
        makeElement(
            "p",
            "product-price",
            formatPrice(product)
        )
    );


    // RATINGS AND REVIEWS

    const details = makeElement("div", "product-details");

    details.appendChild(
        makeElement(
            "span",
            "",
            product.rating !== null && product.rating !== undefined
                ? `★ ${product.rating} / 5 rating`
                : "Rating unavailable"
        )
    );

    details.appendChild(
        makeElement(
            "span",
            "",
            product.reviews !== null && product.reviews !== undefined
                ? `${Number(product.reviews).toLocaleString()} reviews`
                : "Review count unavailable"
        )
    );

    info.appendChild(details);


    // COMPARISON SCORE

    const scoreRow = makeElement("div", "score-row");

    scoreRow.appendChild(
        makeElement(
            "span",
            "score-label",
            "Comparison score"
        )
    );

    scoreRow.appendChild(
        makeElement(
            "span",
            "score-value",
            product.score !== null && product.score !== undefined
                ? `${product.score}/100`
                : "N/A"
        )
    );

    info.appendChild(scoreRow);


    if (product.scoreNote) {

        info.appendChild(
            makeElement(
                "p",
                "score-note",
                product.scoreNote
            )
        );
    }


    // PRODUCT LINK

    if (product.purchaseUrl) {

        const link = document.createElement("a");

        link.className = "buy-button";
        link.href = product.purchaseUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.textContent = product.linkType === "merchant"
            ? "Buy / View on merchant site ↗"
            : "View listing on Google Shopping ↗";

        info.appendChild(link);

    } else {

        info.appendChild(
            makeElement(
                "span",
                "buy-button disabled",
                "Purchase link unavailable"
            )
        );
    }


    card.appendChild(imageWrap);
    card.appendChild(info);

    return card;
}


// DISPLAY ERROR

function showError(message) {

    statusMessage.textContent = message;
    statusMessage.className = "status-message error";
}


// BEST OVERALL RECOMMENDATION

function showBestOverall(products) {

    const oldSection = document.getElementById(
        "best-overall-section"
    );

    if (oldSection) {
        oldSection.remove();
    }


    // FIND PRODUCTS WITH NUMERIC SCORES

    const eligibleProducts = products.filter(
        product => typeof product.score === "number"
    );

    if (eligibleProducts.length === 0) {
        return;
    }


    // SELECT HIGHEST SCORE

    const bestProduct = eligibleProducts.reduce(
        (best, product) =>
            product.score > best.score ? product : best
    );


    // CREATE RECOMMENDATION SECTION

    const section = document.createElement("section");

    section.id = "best-overall-section";
    section.className = "best-overall-section";

    const heading = document.createElement("h2");

    heading.textContent = "Best Overall Product";

    section.appendChild(heading);


    const card = document.createElement("div");

    card.className = "best-overall-card";


    // PRODUCT IMAGE

    if (bestProduct.image) {

        const image = document.createElement("img");

        image.src = bestProduct.image;
        image.alt = bestProduct.title || "Recommended product";
        image.className = "best-overall-image";
        image.loading = "lazy";

        card.appendChild(image);
    }


    // PRODUCT DETAILS

    const details = document.createElement("div");

    details.className = "best-overall-details";

    details.appendChild(
        makeElement(
            "h3",
            "",
            bestProduct.title || "Product name unavailable"
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "",
            "Merchant: " + (bestProduct.merchant || "Not available")
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "",
            "Price: " + (bestProduct.priceText || "Not available")
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "",
            "Customer rating: " +
            (bestProduct.rating != null
                ? bestProduct.rating + " / 5"
                : "Not available")
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "",
            "Review count: " +
            (bestProduct.reviews != null
                ? bestProduct.reviews
                : "Not available")
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "best-overall-score",
            "Comparison score: " + bestProduct.score + " / 100"
        )
    );

    details.appendChild(
        makeElement(
            "p",
            "",
            "This product has the highest comparison score among the returned products with a calculable score."
        )
    );


    // BUY LINK

    if (bestProduct.purchaseUrl) {

        const buyLink = document.createElement("a");

        buyLink.href = bestProduct.purchaseUrl;
        buyLink.target = "_blank";
        buyLink.rel = "noopener noreferrer";
        buyLink.className = "best-overall-buy";

        buyLink.textContent = "View / Buy Product ↗";

        details.appendChild(buyLink);
    }


    card.appendChild(details);
    section.appendChild(card);

    productResults.parentNode.insertBefore(
        section,
        productResults
    );
}


// FILTER AND SORT PRODUCTS

function updateResults() {

    const minimum = minPriceInput.value.trim() === ""
        ? null
        : Number(minPriceInput.value);

    const maximum = maxPriceInput.value.trim() === ""
        ? null
        : Number(maxPriceInput.value);

    const sortMode = sortSelect.value;


    let visibleProducts = currentProducts.filter(product => {

        const price = getNumericPrice(product);

        if (minimum !== null &&
            (price === null || price < minimum)) {

            return false;
        }

        if (maximum !== null &&
            (price === null || price > maximum)) {

            return false;
        }

        return true;
    });


    // SORT PRODUCTS

    if (sortMode === "price-low") {

        visibleProducts.sort(
            (a, b) =>
                (getNumericPrice(a) ?? Infinity) -
                (getNumericPrice(b) ?? Infinity)
        );

    } else if (sortMode === "price-high") {

        visibleProducts.sort(
            (a, b) =>
                (getNumericPrice(b) ?? -Infinity) -
                (getNumericPrice(a) ?? -Infinity)
        );

    } else if (sortMode === "score") {

        visibleProducts.sort(
            (a, b) =>
                (b.score ?? -Infinity) -
                (a.score ?? -Infinity)
        );

    } else if (sortMode === "rating") {

        visibleProducts.sort(
            (a, b) =>
                (b.rating ?? -Infinity) -
                (a.rating ?? -Infinity)
        );
    }


    // DISPLAY PRODUCTS

    productResults.replaceChildren();

    visibleProducts.forEach(product => {

        productResults.appendChild(
            makeProductCard(product)
        );
    });


    resultCount.textContent =
        `${visibleProducts.length} of ${currentProducts.length} result(s)`;


    if (visibleProducts.length === 0) {

        statusMessage.textContent =
            "No products match these filters. Try widening your price range.";

        statusMessage.className = "status-message";

    } else {

        statusMessage.textContent = currentSourceMessage;
        statusMessage.className = "status-message";
    }
}


// CLEAR FILTERS

function clearFilters() {

    minPriceInput.value = "";
    maxPriceInput.value = "";

    sortSelect.value = "recommended";

    document.querySelectorAll(".budget-chip").forEach(chip => {

        chip.classList.remove("active");
    });

    if (currentProducts.length) {
        updateResults();
    }
}


// SEARCH FORM

searchForm.addEventListener("submit", async event => {

    event.preventDefault();

    const query = queryInput.value.trim();


    if (!query) {

        showError("Please enter a product name.");

        queryInput.focus();

        return;
    }


    productResults.replaceChildren();


    const oldRecommendation = document.getElementById(
        "best-overall-section"
    );

    if (oldRecommendation) {
        oldRecommendation.remove();
    }


    currentProducts = [];

    filterToolbar.hidden = true;

    clearFilters();

    resultsTitle.textContent = `Results for "${query}"`;

    resultCount.textContent = "";

    statusMessage.className = "status-message";

    statusMessage.textContent = "Searching live shopping results...";

    searchButton.disabled = true;

    searchButton.textContent = "Searching...";


    try {

        const response = await fetch(
            `/api/search?q=${encodeURIComponent(query)}`
        );


        let data;

        try {

            data = await response.json();

        } catch {

            throw new Error(
                "The server returned an unreadable response."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error || "Product search failed."
            );
        }


        const products = Array.isArray(data.products)
            ? data.products
            : [];

        currentProducts = products;


        showBestOverall(products);


        if (products.length === 0) {

            statusMessage.textContent =
                data.message || "No products were found. Try another search.";

            return;
        }


        currentSourceMessage =
            `${data.message || "Shopping results loaded."} Source: ${data.source || "available shopping listings"}.`;


        filterToolbar.hidden = false;

        updateResults();


    } catch (error) {

        showError(
            error.message ||
            "Unable to search right now. Check that the Flask server is running."
        );

    } finally {

        searchButton.disabled = false;

        searchButton.innerHTML =
            'Search products <span aria-hidden="true">↗</span>';
    }

});


// FILTER INPUT EVENTS

[minPriceInput, maxPriceInput, sortSelect].forEach(control => {

    control.addEventListener("input", () => {

        document.querySelectorAll(".budget-chip").forEach(chip => {

            chip.classList.remove("active");
        });

        if (currentProducts.length) {
            updateResults();
        }
    });
});


// QUICK BUDGET FILTERS

document.querySelectorAll(".budget-chip").forEach(chip => {

    chip.addEventListener("click", () => {

        minPriceInput.value = chip.dataset.min;
        maxPriceInput.value = chip.dataset.max;


        document.querySelectorAll(".budget-chip").forEach(item => {

            item.classList.remove("active");
        });

        chip.classList.add("active");


        if (currentProducts.length) {
            updateResults();
        }
    });
});


// CLEAR FILTER BUTTON

clearFiltersButton.addEventListener(
    "click",
    clearFilters
);