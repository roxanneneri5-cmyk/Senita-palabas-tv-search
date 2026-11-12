/*
"Talk is cheap. Show me the code."
—Linus Torvalds
*/

// Palabas · WS1 TV Show Search code-along (TVmaze API, no key needed)
// Open DevTools (F12): keep the Console AND the Network tab open.
// Sample or live mode: see config.js.

// ---------- Given: page elements ----------
const form = document.getElementById("searchForm");
const input = document.getElementById("query");
const statusText = document.getElementById("status");
const results = document.getElementById("results");
const dialog = document.getElementById("details");
const detailsBody = document.getElementById("detailsBody");
const closeBtn = document.getElementById("closeDetails");
const modeBadge = document.getElementById("modeBadge");

// ---------- Given: the API's URLs ----------
const API = "https://api.tvmaze.com";

// Turns "Breaking Bad" into "breaking-bad" (used for the sample-data file names)
function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// e.g. https://api.tvmaze.com/search/shows?q=breaking%20bad
function searchURL(query) {
  if (USE_SAMPLE_DATA) return `data/search/${slug(query)}.json`;
  return `${API}/search/shows?q=${encodeURIComponent(query)}`;
}

// e.g. https://api.tvmaze.com/shows/169
function showURL(id) {
  return USE_SAMPLE_DATA ? `data/shows/${id}.json` : `${API}/shows/${id}`;
}

// e.g. https://api.tvmaze.com/shows/169/cast
function castURL(id) {
  return USE_SAMPLE_DATA ? `data/cast/${id}.json` : `${API}/shows/${id}/cast`;
}

// e.g. https://api.tvmaze.com/shows/169/seasons
function seasonsURL(id) {
  return USE_SAMPLE_DATA ? `data/seasons/${id}.json` : `${API}/shows/${id}/seasons`;
}

// ---------- Given: helpers (no need to change) ----------

// Shows a message under the search box. type: "info", "loading" or "error"
function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = "status " + type;
}

// Makes an element with an optional class and text: el("span", "year", "2008")
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A poster <img>, or a placeholder when the show has no image (image is null)
function createPoster(show, size = "medium") {
  if (!show.image) {
    return el("span", "poster none", "No poster");
  }
  const img = el("img", "poster");
  img.src = show.image[size] || show.image.medium;
  img.alt = `Poster: ${show.name}`;
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(el("span", "poster none", "No poster")));
  return img;
}

// "2008–2013", or "2016–" for a show that is still running
function yearRange(show) {
  const start = show.premiered ? show.premiered.slice(0, 4) : "?";
  const end = show.ended ? show.ended.slice(0, 4) : "";
  return `${start}–${end}`;
}

// TVmaze summaries contain HTML like "<p><b>Friends</b> follows…</p>".
// This keeps only the text. (Never put text from an API into innerHTML:
// if it contained a <script> or an onerror, it could run on your page.)
function stripTags(html) {
  if (!html) return "No summary yet.";
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

// Close the details pop-up (Step 4) with the × button or by clicking outside it
closeBtn.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// Show which mode we're in
modeBadge.textContent = USE_SAMPLE_DATA ? "Sample data" : "Live · TVmaze";
modeBadge.classList.toggle("live", !USE_SAMPLE_DATA);


// STEP 1 — Your first API request

// Nagpapadala ito ng test na request sa search URL ng "friends". Ipinapakita nito
// sa Console ang URL, ang status (200), kung OK ang response, at ang data na
// ibinalik ng API (bilang ng show, pangalan, at premiered ng una), para makita ko
// kung ano ang itsura ng sagot ng API.
async function testRequest() {
  const url = searchURL("friends");
  console.log("Request URL:", url);

  const response = await fetch(url);
  console.log("Status:", response.status);
  console.log("Response OK:", response.ok);

  const data = await response.json();
  console.log("Full data:", data);
  console.log("Number of shows:", data.length);
  console.log("First show's name:", data[0].show.name);
  console.log("First show's premiered:", data[0].show.premiered);
}


// STEP 2 — Search and show the results

// Tumatanggap ito ng listahan ng results ng search at gumagawa ng isang card
// (button) para sa bawat show, na may poster, pamagat, taon, rating, at genres.
// Binubura muna nito ang mga lumang card bago magdagdag ng bago, at nilalagay
// ang id ng show sa data-id para malaman kung aling card ang na-click.
function renderResults(items) {
  results.replaceChildren();

  items.forEach((item) => {
    const show = item.show;

    const card = el("button", "card");
    card.type = "button";
    card.dataset.id = show.id;

    card.append(
      createPoster(show),
      el("span", "title", show.name),
      el("span", "year", yearRange(show)),
      el("span", "rating", show.rating.average ? `★ ${show.rating.average}` : "Not rated yet"),
      el("span", "genres", show.genres.length ? show.genres.join(", ") : "No genres listed")
    );

    results.append(card);
  });
}

// Naghahanap ito ng show gamit ang tinype na pamagat. Nagpapakita muna ng
// "Searching…", kinukuha ang data gamit ang getJSON, tapos ipinapakita ang mga
// card. Kapag walang nahanap ay "No shows found" ang lalabas, at kapag may
// error (offline, 404, 429) ay ang malinaw na mensahe nito ang ipapakita.
async function searchShows(query) {
  setStatus(`Searching for "${query}"…`, "loading");
  results.replaceChildren();

  try {
    const items = await getJSON(searchURL(query));

    if (!Array.isArray(items) || items.length === 0) {
      setStatus(`No shows found for "${query}". Try another title.`, "error");
      return;
    }

    renderResults(items);
    setStatus(`${items.length} ${items.length === 1 ? "show" : "shows"} found for "${query}".`);
  } catch (error) {
    setStatus(error.message, "error");
  }
}


// STEP 3 — getJSON(): one careful helper for every request

// Ito ang helper para sa lahat ng request. Ibinabalik nito ang JSON data, o
// nagtatapon ng Error na may mensaheng naiintindihan ng user kapag may problema:
// walang internet (fetch mismo ang nag-reject), sobrang daming request (429),
// o hindi OK na status tulad ng 404. Sa sample mode, inililista nito ang mga
// puwedeng hanapin kapag walang file na nahanap.
async function getJSON(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Can't reach TVmaze. Check your internet connection and try again.");
  }

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait 10 seconds and try again.");
  }

  if (!response.ok) {
    if (response.status === 404 && USE_SAMPLE_DATA) {
      throw new Error("No sample data for that title. Try: friends, office, breaking bad, stranger things, sherlock, thrones, or sample.");
    }
    throw new Error(`Something went wrong (status ${response.status}). Please try again.`);
  }

  return await response.json();
}


// STEP 4 — Click a show to see its details

// Isang click listener lang ito sa buong #results, hindi isa kada card. Kapag
// may na-click sa loob ng results, hinahanap nito kung aling card iyon gamit ang
// closest(".card") at binubuksan ang details ng show na iyon. Gumagana pa rin
// ito kahit may bagong mga card pagkatapos ng bagong search.
results.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (!card) return;

  showDetails(card.dataset.id);
});


// STEP 5 — Promise.all: show + cast + seasons at the same time

// Binubuksan nito ang pop-up na may "Loading details…", tapos kinukuha ang show,
// cast, at seasons nang sabay-sabay gamit ang Promise.all. Mas mabilis ito kaysa
// tatlong await na sunod-sunod, dahil sabay na tumatakbo ang tatlong request, kaya
// ang hinihintay lang ay ang pinakamabagal sa kanila. Nilolog din nito kung ilang
// ms inabot. Kapag may isang nag-fail, error message ang ipinapakita sa pop-up.
async function showDetails(id) {
  detailsBody.replaceChildren(el("p", "status loading", "Loading details…"));
  dialog.showModal();

  try {
    const start = performance.now();

    const [show, cast, seasons] = await Promise.all([
      getJSON(showURL(id)),
      getJSON(castURL(id)),
      getJSON(seasonsURL(id)),
    ]);

    console.log(`3 requests in ${Math.round(performance.now() - start)} ms`);
    renderDetails(show, cast, seasons);
  } catch (error) {
    detailsBody.replaceChildren(el("p", "status error", error.message));
  }
}

// Pinupunan nito ang pop-up ng poster, pamagat, taon, network, genres, runtime,
// bilang ng seasons, rating, summary, hanggang 6 na cast, at link papunta sa
// TVmaze. May fallback para sa mga value na wala o null (halimbawa ang runtime
// na ginagamit ang averageRuntime) para hindi mag-error ang page.
function renderDetails(show, cast, seasons) {
  detailsBody.replaceChildren();
  detailsBody.append(createPoster(show, "original"));

  const network = show.network?.name || show.webChannel?.name || "No network listed";
  const genres = show.genres.length ? show.genres.join(", ") : "No genres listed";
  const runtime = show.runtime ?? show.averageRuntime;
  const runtimeText = runtime ? `${runtime} min` : "Runtime unknown";
  const seasonText = `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"}`;

  const info = el("div", "info");
  info.append(
    el("h2", "", show.name),
    el("p", "meta", `${yearRange(show)} · ${network} · ${genres} · ${runtimeText}`),
    el("p", "meta", seasonText),
    el("p", "score", show.rating?.average ? `★ ${show.rating.average}` : "Not rated yet"),
    el("p", "plot", stripTags(show.summary))
  );

  info.append(el("h3", "", "Cast"));
  if (cast.length === 0) {
    info.append(el("p", "meta", "No cast listed."));
  } else {
    const list = el("ul", "cast");
    cast.slice(0, 6).forEach((entry) => {
      list.append(el("li", "", `${entry.person.name} as ${entry.character.name}`));
    });
    info.append(list);
  }

  const link = el("a", "", "View on TVmaze");
  link.href = show.url;
  link.target = "_blank";
  link.rel = "noopener";

  const links = el("div", "links");
  links.append(link);
  info.append(links);

  detailsBody.append(info);
}


// EXTEND — Search as you type

// Search as you type: bawat pindot ng key ay kinakansela ang naunang timer
// (clearTimeout) at gumagawa ng bago (setTimeout). Kaya isang beses lang tatakbo
// ang search, 500 ms matapos huminto sa pagta-type ang user, hindi sa bawat letra.
let typingTimer;

input.addEventListener("input", () => {
  clearTimeout(typingTimer);

  const query = input.value.trim();
  if (!query) return;

  typingTimer = setTimeout(() => searchShows(query), 500);
});

// Tumatakbo ito kapag nag-submit ang search form (Search button o Enter).
// Pinipigilan nito ang pag-reload ng page, kinakansela ang nakabinbing typing
// timer para hindi dalawang beses maghanap, binabasa ang tinype, hindi gumagawa
// ng kahit ano kapag walang laman, at saka tinatawag ang searchShows.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(typingTimer);

  const query = input.value.trim();
  if (!query) return;

  searchShows(query);
});