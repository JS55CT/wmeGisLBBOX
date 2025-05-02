# geoBBoxPruner

A JavaScript utility for efficiently identifying geographical regions that intersect with a viewport bounding box. The `geoBBoxPruner` class uses bounding box intersection logic along with optional high-precision GeoJSON data to determine intersecting countries, US states/counties, and subdivisions based on your specified viewport coordinates.

## Features

- **Cache System**: Utilizes caching to store and reuse fetched JSON/geoJSON data.
- **Bounding Box Intersection**: Identifies intersections between a viewport and the bounding boxes of various geographical regions.
- **GeoJSON Data Check**: Provides optional high-precision intersection checks using GeoJSON data.
- **Viewport Analysis**: Determines intersecting countries, US states/counties, and other country subdivisions within a specified viewport.

## Usage

### Initializing geoBBoxPruner

Create an instance of `geoBBoxPruner`:

```javascript
var pruner = new geoBBoxPruner();
```

## Fetching and Determining Intersecting Regions

### Fetch Intersecting Countries

Use getIntersectingCountries(viewportBbox) to fetch a list of countries intersecting with the viewport.

```javascript
const viewport = { minLon: x, minLat: y, maxLon: z, maxLat: w };
pruner.getIntersectingCountries(viewport).then((countries) => {
  console.log(countries);
});
```

### Fetch Intersecting States and Counties (US Specific)

Use getIntersectingStatesAndCounties(viewportBbox, highPrecision) to determine intersecting regions within the US.

```javascript
pruner.getIntersectingStatesAndCounties(viewport, true).then((regions) => {
  console.log(regions);
});
```

### Fetch Intersecting Subdivisions (Non-US)

Use getIntersectingSubdivisions(countryCode, viewportBbox) to fetch major subdivisions for countries other than the US.

```javascript
pruner.getIntersectingSubdivisions("CA", viewport).then((subdivisions) => {
  console.log(subdivisions);
});
```

## Determine What’s in View

Use whatsInView(viewportBbox, highPrecision) for a comprehensive analysis of intersecting regions.

```javascript
pruner.whatsInView(viewport, true).then((results) => {
  console.log(results);
});
```

## Dependencies

Requires GM_xmlhttpRequest for HTTP requests. This is typically used in userscripts with platforms like Greasemonkey or Tampermonkey.
