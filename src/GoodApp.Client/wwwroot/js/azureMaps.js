let map = null;
let dataSource = null;
let bubbleLayer = null;
/** @type {atlas.Popup | null} */
let popup = null;
let layerClickAttached = false;

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
 * Initialize Azure Map and a BubbleLayer (WebGL) for opportunity points.
 */
export function initMap(containerId, subscriptionKey) {
  return new Promise((resolve, reject) => {
    if (typeof atlas === "undefined") {
      reject(new Error("Azure Maps SDK (atlas) is not loaded."));
      return;
    }

    map = new atlas.Map(containerId, {
      authOptions: {
        authType: "subscriptionKey",
        subscriptionKey: subscriptionKey,
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

      resolve();
    });
  });
}

/**
 * Load GeoJSON points into the data source and fit the camera.
 * @param {string} json — JSON array of opportunities (camelCase)
 */
export function loadOpportunities(json) {
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

  if (positions.length === 0) return;

  if (positions.length === 1) {
    map.setCamera({
      center: positions[0],
      zoom: 14,
    });
    return;
  }

  const bbox = atlas.data.BoundingBox.fromPositions(positions);
  map.setCamera({
    bounds: bbox,
    padding: 56,
    maxZoom: 15,
  });
}
