let map = null;
let dataSource = null;
let bubbleLayer = null;
/** @type {atlas.Popup | null} */
let popup = null;
let layerClickAttached = false;
/** @type {string | null} */
let subscriptionKey = null;

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function typeLabel(type) {
  switch (type) {
    case 0:
      return "Volunteer";
    case 1:
      return "Donation";
    case 2:
      return "Event";
    default:
      return "Opportunity";
  }
}

function buildPopupHtml(o) {
  const badge = escapeHtml(typeLabel(Number(o.type)));
  const title = escapeHtml(o.title ?? "");
  const org = escapeHtml(o.organizationName ?? "");
  const address = escapeHtml(o.address ?? "");
  const desc = escapeHtml(o.description ?? "");
  return (
    '<div class="good-popup">' +
    '<div class="good-popup__badge">' +
    badge +
    "</div>" +
    '<p class="good-popup__title">' +
    title +
    "</p>" +
    (org ? '<p class="good-popup__org">' + org + "</p>" : "") +
    (address ? '<p class="good-popup__address">' + address + "</p>" : "") +
    (desc ? '<p class="good-popup__desc">' + desc + "</p>" : "") +
    "</div>"
  );
}

function attachLayerClickOnce() {
  if (layerClickAttached || !map || !bubbleLayer) return;
  layerClickAttached = true;

  popup = new atlas.Popup({ pixelOffset: [0, -12] });

  map.events.add("click", bubbleLayer, (e) => {
    if (!e.shapes || e.shapes.length === 0) return;
    const shape = e.shapes[0];
    const props = shape.getProperties();
    const coords = shape.getCoordinates();
    popup.setOptions({
      content: buildPopupHtml(props),
      position: coords,
    });
    popup.open(map);
  });
}

/**
 * Browser geolocation (user gesture recommended).
 * @returns {Promise<{ lat: number; lon: number }>}
 */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Location permission was denied."
            : err.code === 2
              ? "Location is unavailable."
              : err.code === 3
                ? "Location request timed out."
                : "Could not read your location.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

/**
 * Azure Maps Search (address) — same subscription key as the map control.
 * @returns {Promise<{ lat: number; lon: number; label: string }>}
 */
async function geocodeAddress(query) {
  if (!subscriptionKey) {
    throw new Error("Map is not ready yet.");
  }
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    throw new Error("Enter a city, neighborhood, or address.");
  }
  const url =
    "https://atlas.microsoft.com/search/address/json?api-version=1.0&subscription-key=" +
    encodeURIComponent(subscriptionKey) +
    "&query=" +
    encodeURIComponent(trimmed) +
    "&limit=1";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not search that location. Try again.");
  }
  const data = await res.json();
  const r = data.results && data.results[0];
  if (!r || !r.position) {
    throw new Error("No matches found. Try a different place name.");
  }
  return {
    lat: r.position.lat,
    lon: r.position.lon,
    label: (r.address && r.address.freeformAddress) || trimmed,
  };
}

function flyTo(lon, lat, zoom) {
  if (!map) return;
  const z = typeof zoom === "number" ? zoom : 12;
  map.setCamera({
    center: [lon, lat],
    zoom: z,
    type: "ease",
    duration: 900,
  });
}

function initMap(containerId, key) {
  subscriptionKey = key;
  return new Promise((resolve, reject) => {
    if (typeof atlas === "undefined") {
      reject(new Error("Azure Maps SDK (atlas) is not loaded."));
      return;
    }

    map = new atlas.Map(containerId, {
      authOptions: {
        authType: "subscriptionKey",
        subscriptionKey: key,
      },
      center: [-122.33, 47.61],
      zoom: 11,
      style: "road",
    });

    map.events.add("ready", () => {
      dataSource = new atlas.source.DataSource();
      map.sources.add(dataSource);

      bubbleLayer = new atlas.layer.BubbleLayer(dataSource, null, {
        radius: 11,
        strokeColor: "#ffffff",
        strokeWidth: 2,
        color: [
          "match",
          ["get", "type"],
          0,
          "#107c10",
          1,
          "#5c2d91",
          2,
          "#0078d4",
          "#666666",
        ],
      });
      map.layers.add(bubbleLayer);

      attachLayerClickOnce();

      requestAnimationFrame(() => {
        try {
          map.resize();
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            map.resize();
          } catch {
            /* ignore */
          }
        }, 120);
      });

      const onWinResize = () => {
        try {
          map.resize();
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("resize", onWinResize);

      resolve();
    });
  });
}

function resizeMap() {
  if (!map) return;
  requestAnimationFrame(() => {
    try {
      map.resize();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Load GeoJSON points into the data source and fit the camera.
 * @param {string} json — JSON array of opportunities (camelCase)
 * @param { { center?: { lat: number; lon: number }; zoom?: number } | null } viewWhenEmpty — when there are no pins, move the map here
 */
function loadOpportunities(json, viewWhenEmpty) {
  if (!map || !dataSource) return;

  dataSource.clear();

  const items = JSON.parse(json);
  const positions = [];

  for (const o of items) {
    const lon = o.longitude;
    const lat = o.latitude;
    if (typeof lon !== "number" || typeof lat !== "number") continue;

    positions.push([lon, lat]);

    const t = typeof o.type === "number" ? o.type : parseInt(o.type, 10) || 0;
    dataSource.add(
      new atlas.data.Feature(new atlas.data.Point([lon, lat]), {
        type: t,
        title: o.title ?? "",
        organizationName: o.organizationName ?? "",
        address: o.address ?? "",
        description: o.description ?? "",
      })
    );
  }

  if (positions.length === 0) {
    if (viewWhenEmpty && viewWhenEmpty.center) {
      const c = viewWhenEmpty.center;
      const lon = c.lon;
      const lat = c.lat;
      if (typeof lon === "number" && typeof lat === "number") {
        map.setCamera({
          center: [lon, lat],
          zoom: typeof viewWhenEmpty.zoom === "number" ? viewWhenEmpty.zoom : 12,
          type: "ease",
          duration: 900,
        });
      }
    }
    return;
  }

  if (positions.length === 1) {
    map.setCamera({
      center: positions[0],
      zoom: 14,
      type: "ease",
      duration: 600,
    });
    return;
  }

  const bbox = atlas.data.BoundingBox.fromPositions(positions);
  map.setCamera({
    bounds: bbox,
    padding: 56,
    maxZoom: 15,
    type: "ease",
    duration: 900,
  });
}

/** Default export for Blazor dynamic import(); map-related APIs only (session → index.html goodAppInterop). */
export default {
  getUserLocation,
  geocodeAddress,
  flyTo,
  initMap,
  resizeMap,
  loadOpportunities,
};
