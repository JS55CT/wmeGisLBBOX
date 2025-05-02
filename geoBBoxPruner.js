// ==UserScript==
// @name                geoBBoxPruner
// @namespace           https://github.com/JS55CT
// @description         Determines which geographical divisions intersect with the given BBOX.
// @version             1.1.1
// @license             MIT
// @grant               GM_xmlhttpRequest
// @connect             github.io
// ==/UserScript==

var geoBBoxPruner = (function () {
  // Constructor for the geoBBoxPruner class

  const funcName = "geoBBoxPruner";
  function geoBBoxPruner() {
    // Ensure class instantiation with 'new'
    if (!(this instanceof geoBBoxPruner)) {
      return new geoBBoxPruner();
    }
    this.cache = {}; // Cache for storing fetched JSON / geoJSON data
  }

  /**
   * Fetches JSON data from a URL, using a cache to store and reuse previously fetched data.
   * @param {string} url - URL to fetch JSON data from.
   * @returns {Promise<Object>} - A promise that resolves to the JSON data.
   */
  geoBBoxPruner.prototype.fetchJsonWithCache = function (url) {
    if (this.cache[url]) {
      return Promise.resolve(this.cache[url]);
    }
    // Fetch data using GM_xmlhttpRequest
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            // Parse and store fetched data in cache
            const data = JSON.parse(response.responseText);
            this.cache[url] = data;
            resolve(data);
          } else {
            reject(new Error(`${funcName}: Failed to fetch data from ${url}, status: ${response.status}`));
          }
        },
        onerror: (error) => {
          reject(new Error(`${funcName}: Failed to fetch data from ${url}, error: ${error}`));
        },
      });
    });
  };

  /**
   * Checks whether two bounding boxes intersect.
   * @param {Object} bbox1 - The first bounding box.
   * @param {Object} bbox2 - The second bounding box.
   * @returns {boolean} - True if they intersect, false otherwise.
   * 
   * bbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   * 
   **/
  function checkIntersection(bbox1, bbox2) {
    return !(bbox1.maxLon < bbox2.minLon || bbox1.minLon > bbox2.maxLon || bbox1.maxLat < bbox2.minLat || bbox1.minLat > bbox2.maxLat);
  }

  /**
   * Identifies countries intersecting with the given viewport bounding box.
   * @param {Object} viewportBbox - The bounding box of the viewport.
   * @returns {Array} - List of country info objects that intersect with the viewport.
   * 
   * viewportBbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   **/
  geoBBoxPruner.prototype.getIntersectingCountries = function (viewportBbox) {
      const url = "https://js55ct.github.io/geoBBoxPruner/BBOX%20JSON/COUNTRIES_BBOX_ESPG4326.json";

    return this.fetchJsonWithCache(url)
      .then((COUNTRY_DATA) => {
        const intersectingCountries = Object.keys(COUNTRY_DATA).flatMap((code) => {
          const countryData = COUNTRY_DATA[code];
          for (const bbox of countryData.bbox) {
            if (checkIntersection(bbox, viewportBbox)) {
              return [
                {
                  ISO_ALPHA2: countryData["ISO_ALPHA2"],
                  ISO_ALPHA3: countryData["ISO_ALPHA3"],
                  name: countryData["name"],
                  source: "BBOX",
                },
              ];
            }
          }
          return [];
        });

        return intersectingCountries;
      })
      .catch((error) => {
        console.error(`${funcName}: Error fetching country data:`, error);
        return [];
      });
  };

  /**
   * Cleans intersecting regions data by removing empty or non-intersecting regions, including countries without intersecting states.
   * @param {Object} intersectingCountries - The countries data to clean.
   */
  geoBBoxPruner.prototype.cleanIntersectingData = function (intersectingCountries) {
    for (const countryName in intersectingCountries) {
      const country = intersectingCountries[countryName];

      if (country.ISO_ALPHA2 === "US") {
        // US specific logic
        for (const sub1Name in country.subL1) {
          const subL1 = country.subL1[sub1Name];

          for (const subL2Name in subL1.subL2) {
            const subL2 = subL1.subL2[subL2Name];

            if (!subL2.subL3 || Object.keys(subL2.subL3).length === 0) {
              delete subL1.subL2[subL2Name];
            }
          }

          if (!subL1.subL2 || Object.keys(subL1.subL2).length === 0) {
            delete country.subL1[sub1Name];
          }
        }
      } else {
        // Non-US specific logic
        for (const sub1Name in country.subL1) {
          const subL1 = country.subL1[sub1Name];

          for (const subL2Name in subL1.subL2) {
            if (!subL1.subL2[subL2Name] || Object.keys(subL1.subL2[subL2Name]).length === 0) {
              delete subL1.subL2[subL2Name];
            }
          }

          if (!subL1.subL2 || Object.keys(subL1.subL2).length === 0) {
            delete country.subL1[sub1Name];
          }
        }
      }

      if (!country.subL1 || Object.keys(country.subL1).length === 0) {
        delete intersectingCountries[countryName];
      }
    }
  };

  /**
   * Fetches a GeoJSON file for a specific region and checks if it intersects with the viewport.
   * @param {string} countyCode - The county code.
   * @param {string} subCode - Subdivision code.
   * @param {string} subSubCode - Sub-subdivision code.
   * @param {Object} viewportBbox - The bounding box of the viewport.
   * @returns {Promise<boolean>} - True if intersection exists; false otherwise.
   * 
   * * viewportBbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   */
  geoBBoxPruner.prototype.fetchAndCheckGeoJsonIntersection = async function (countyCode, subCode, subSubCode, viewportBbox) {
    const BASE_URL_GEOJSON = `https://js55ct.github.io/geoBBoxPruner/GEOJSON/`;
    const url = `${BASE_URL_GEOJSON}${countyCode}/${subCode}/${countyCode}-${subCode}-${subSubCode}_EPSG4326.geojson`;

    try {
      const geoJsonData = await this.fetchJsonWithCache(url);

      // Define the viewport as a polygon.
      const viewportPolygon = [
        [viewportBbox.minLon, viewportBbox.minLat],
        [viewportBbox.minLon, viewportBbox.maxLat],
        [viewportBbox.maxLon, viewportBbox.maxLat],
        [viewportBbox.maxLon, viewportBbox.minLat],
        [viewportBbox.minLon, viewportBbox.minLat], // Close the polygon
      ];

      // Iterate through each feature in the GeoJSON data
      for (const feature of geoJsonData.features) {
        const featureGeometry = feature.geometry;

        // Check if the geometry type is Polygon or MultiPolygon
        if (featureGeometry.type === "Polygon") {
          for (const polygon of featureGeometry.coordinates) {
            if (hasIntersection(polygon, viewportPolygon)) {
              return true; // An intersection is found
            }
          }
        } else if (featureGeometry.type === "MultiPolygon") {
          for (const multiPolygon of featureGeometry.coordinates) {
            for (const polygon of multiPolygon) {
              if (hasIntersection(polygon, viewportPolygon)) {
                return true; // An intersection is found
              }
            }
          }
        } else {
          console.warn(`${funcName}: Unsupported geometry type:`, featureGeometry.type);
          continue; // Skip unsupported geometry types
        }
      }

      return false; // No intersection found
    } catch (error) {
      console.error(`${funcName}: Error fetching or processing GeoJSON from ${url}:`, error);
      return false;
    }
  };

  /**
   * Finds intersecting states and counties with the viewport, considering high-precision GeoJSON data if needed.
   * @param {Object} viewportBbox - The bounding box of the viewport.
   * @param {boolean} [highPrecision=false] - Flag to indicate if high precision is required.
   * @returns {Object} - An object containing intersecting regions.
   * 
   * viewportBbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   */
  geoBBoxPruner.prototype.getIntersectingStatesAndCounties = async function (viewportBbox, highPrecision = false) {
    const BASE_URL_BBOX = `https://js55ct.github.io/geoBBoxPruner/BBOX%20JSON/US/`;
    const STATES_URL = `${BASE_URL_BBOX}US_BBOX_ESPG4326.json`;
    const intersectingRegions = {};

    try {
      const US_States = await this.fetchJsonWithCache(STATES_URL);

      for (const stateCode in US_States) {
        const stateData = US_States[stateCode];

        if (checkIntersection(stateData.bbox, viewportBbox)) {
          const intersectingCounties = {};
          const countiesUrl = `${BASE_URL_BBOX}US-${stateData.STUSPS}_BBOX_ESPG4326.json`;
          const countiesData = await this.fetchJsonWithCache(countiesUrl);

          for (const countyEntry of countiesData) {
            const countyName = Object.keys(countyEntry)[0];
            const countyData = countyEntry[countyName];

            if (checkIntersection(countyData.bbox, viewportBbox)) {
              const intersectingSubCounties = countyData.subdivisions
                .filter((sub) => sub.bbox && checkIntersection(sub.bbox, viewportBbox))
                .reduce((acc, sub) => {
                  acc[sub.name] = {
                    COUSUBFP: sub.COUSUBFP,
                    source: "BBOX",
                  };
                  return acc;
                }, {});

              if (Object.keys(intersectingSubCounties).length > 0) {
                let source = "BBOX";

                if (highPrecision) {
                  const intersectsGeoJson = await this.fetchAndCheckGeoJsonIntersection("US", stateData.STUSPS, countyData.COUNTYFP, viewportBbox);

                  if (intersectsGeoJson) {
                    source = "GEOJSON";
                  } else {
                    continue;
                  }
                }

                intersectingCounties[countyName] = {
                  COUNTYFP: countyData.COUNTYFP,
                  subL3: intersectingSubCounties,
                  source: source,
                };
              }
            }
          }

          if (Object.keys(intersectingCounties).length > 0) {
            let stateSource = "BBOX";
            if (highPrecision) {
              const anyCountyWithGeoJson = Object.values(intersectingCounties).some((county) => county.source === "GEOJSON");
              if (anyCountyWithGeoJson) {
                stateSource = "GEOJSON";
              }
            }
            intersectingRegions[stateData.name] = {
              STUSPS: stateData.STUSPS,
              STATEFP: stateData.STATEFP,
              subL2: intersectingCounties,
              source: stateSource,
            };
          }
        }
      }
    } catch (error) {
      console.error(`${funcName}: Failed to fetch or process state data:`, error);
    }

    return intersectingRegions;
  };

  /**
   * Fetches major subdivisions data and checks for intersections with the viewport bounding box for countries other than the US.
   * @param {string} countryCode - The 2-letter ISO code of the country.
   * @param {Object} viewportBbox - The bounding box of the viewport.
   * @returns {Object} - Major subdivisions that intersect with the viewport.
   * 
   *  viewportBbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   */
  geoBBoxPruner.prototype.getIntersectingSubdivisions = async function (countryCode, viewportBbox) {
    const subdivisionsResult = {};
    const BASE_URL_BBOX = `https://js55ct.github.io/geoBBoxPruner/BBOX%20JSON/`;
    const subL1Url = `${BASE_URL_BBOX}${countryCode}/${countryCode}_BBOX_ESPG4326.json`;

    try {
      // Fetch the country's first-level subdivision data
      const subL1Data = await this.fetchJsonWithCache(subL1Url);

      // Verify there's valid country data
      if (subL1Data) {
        for (const subdivisionID in subL1Data) {
          const subdivision = subL1Data[subdivisionID];

          // Only proceed to the second-level check if first-level intersects
          if (checkIntersection(subdivision.bbox, viewportBbox)) {
            const subdivisionName = subdivision["name"];

            // Initialize results for this subdivision, using the name as the key
            subdivisionsResult[subdivisionName] = {
              subL1_code: subdivision["sub_code"],
              subL1_id: subdivisionID,
              source: "BBOX",
              subL2: {}, // To store second-level subdivisions
            };

            // Construct sub-division level 2 URL
            const subL2Url = `${BASE_URL_BBOX}${countryCode}/${countryCode}-${subdivisionID}_BBOX_ESPG4326.json`;

            // Fetch sub-division level 2 data
            const subL2Data = await this.fetchJsonWithCache(subL2Url);

            if (subL2Data) {
              // Iterate over the second-level subdivisions
              for (const subsubDivision of subL2Data) {
                const subsubID = Object.keys(subsubDivision)[0];
                const subsub = subsubDivision[subsubID];

                // Check intersection with second-level subdivisions
                if (checkIntersection(subsub.bbox, viewportBbox)) {
                  const subsubName = subsub["name"];

                  // Add intersecting subdivisions to the result, using the name as the key
                  subdivisionsResult[subdivisionName].subL2[subsubName] = {
                    subL2_id: subsub.subsub_id,
                    source: "BBOX",
                  };
                }
              }
            } else {
              console.warn(`${funcName}: No sub-division L2 data found for ${subdivisionID} in country: ${countryCode}`);
            }
          }
        }
      } else {
        console.warn(`${funcName}: No first-level subdivision data found for country code: ${countryCode}`);
      }
    } catch (error) {
      console.error(`${funcName}: Error fetching or processing subdivisions for country code: ${countryCode}`, error);
    }

    return subdivisionsResult;
  };

  /**
   * Finds and returns regions intersecting with the viewport, optionally using high-precision methods.
   * @param {Object} viewportBbox - The bounding box of the viewport.
   * @param {boolean} [highPrecision=false] - Flag to indicate if high precision is required.
   * @returns {Object} - Results of intersecting regions structured by country, state, and county.
   * 
   *  viewportBbox: {
   *   minLon: number,
   *   minLat: number,
   *   maxLon: number,
   *   maxLat: number
   * }
   */
  geoBBoxPruner.prototype.whatsInView = async function (viewportBbox, highPrecision = false) {
    const results = {};

    try {
      const countries = await this.getIntersectingCountries(viewportBbox);

      if (!countries.length) {
        console.log(`${funcName}: Viewport does not intersect with any known countries.`);
        return results;
      }

      for (const country of countries) {
        if (country.ISO_ALPHA2 === "US") {
          // Fetch intersecting states and counties for the US
          const statesAndCounties = await this.getIntersectingStatesAndCounties(viewportBbox, highPrecision);

          if (statesAndCounties && Object.keys(statesAndCounties).length > 0) {
            results[country.name] = {
              ISO_ALPHA2: country.ISO_ALPHA2,
              ISO_ALPHA3: country.ISO_ALPHA3,
              subL1: statesAndCounties,
            };
            this.cleanIntersectingData(results);
          }
        } else {
          // Handle subdivisions for other countries
          const subdivisions = await this.getIntersectingSubdivisions(country.ISO_ALPHA2, viewportBbox);

          if (subdivisions && Object.keys(subdivisions).length > 0) {
            results[country.name] = {
              ISO_ALPHA2: country.ISO_ALPHA2,
              ISO_ALPHA3: country.ISO_ALPHA3,
              subL1: subdivisions, // Attach subdivisions if they exist
            };
            this.cleanIntersectingData(results);
          }
        }
      }
    } catch (error) {
      console.error(`${funcName}: Error during finding intersecting regions:`, error);
    }

    return results;
  };

  /**
   * Utility function to check if a point is inside a polygon using the ray-casting algorithm.
   * @param {[number, number]} point - Point to check, given as [longitude, latitude].
   * @param {Array} vs - Array of vertices that make up the polygon.
   * @returns {boolean} - True if the point is inside the polygon; false otherwise.
   */
  function isPointInPolygon(point, vs) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const [xi, yi] = vs[i];
      const [xj, yj] = vs[j];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Utility function to detect and return the intersection point of two line segments, if they intersect.
   * @param {[number, number]} p1 - Start of the first line segment.
   * @param {[number, number]} p2 - End of the first line segment.
   * @param {[number, number]} q1 - Start of the second line segment.
   * @param {[number, number]} q2 - End of the second line segment.
   * @returns {[number, number] | null} - Intersection point or null if no intersection exists.
   */
  function segmentIntersection(p1, p2, q1, q2) {
    // Calculate coefficients
    const a1 = p2[1] - p1[1];
    const b1 = p1[0] - p2[0];
    const c1 = a1 * p1[0] + b1 * p1[1];

    const a2 = q2[1] - q1[1];
    const b2 = q1[0] - q2[0];
    const c2 = a2 * q1[0] + b2 * q1[1];

    const denominator = a1 * b2 - a2 * b1;

    if (denominator === 0) {
      return null; // Parallel lines
    }

    const intersectX = (b2 * c1 - b1 * c2) / denominator;
    const intersectY = (a1 * c2 - a2 * c1) / denominator;

    // Check if the intersection is within the bounds of the line segments
    const withinBounds = (value, end1, end2) => Math.min(end1, end2) <= value && value <= Math.max(end1, end2);

    if (withinBounds(intersectX, p1[0], p2[0]) && withinBounds(intersectY, p1[1], p2[1]) && withinBounds(intersectX, q1[0], q2[0]) && withinBounds(intersectY, q1[1], q2[1])) {
      return [intersectX, intersectY];
    }

    return null; // Intersection point is not within the line segments
  }

  /**
   * Function to check if there is any intersection between two polygons.
   * @param {Array} polygon1 - The first polygon as an array of vertices.
   * @param {Array} polygon2 - The second polygon as an array of vertices.
   * @returns {boolean} - True if an intersection exists; false otherwise.
   */
  function hasIntersection(polygon1, polygon2) {
    // Check each edge of polygon1 against each edge of polygon2
    for (let i = 0; i < polygon1.length - 1; i++) {
      for (let j = 0; j < polygon2.length - 1; j++) {
        const intersection = segmentIntersection(polygon1[i], polygon1[i + 1], polygon2[j], polygon2[j + 1]);

        if (intersection) {
          return true; // An intersection is found
        }
      }
    }

    // Check if any point of polygon1 is inside polygon2
    for (const point of polygon1) {
      if (isPointInPolygon(point, polygon2)) {
        return true; // A contained point is found
      }
    }

    // Check if any point of polygon2 is inside polygon1
    for (const point of polygon2) {
      if (isPointInPolygon(point, polygon1)) {
        return true; // A contained point is found
      }
    }

    return false; // No intersection found
  }

  return geoBBoxPruner;
})();
