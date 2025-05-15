- [wmeGisLBBOX](#wmegislbbox)
  - [Features](#features)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Important Functions](#important-functions)
      - [`fetchJsonWithCache(url)`](#fetchjsonwithcacheurl)
    - [`checkIntersection(bbox1, bbox2)`](#checkintersectionbbox1-bbox2)
    - [`getIntersectingCountries(viewportBbox)`](#getintersectingcountriesviewportbbox)
    - [`getCountriesAndSubsJson()`](#getcountriesandsubsjson)
    - [`cleanIntersectingData(intersectingCountries)`](#cleanintersectingdataintersectingcountries)
    - [`fetchAndCheckGeoJsonIntersection(countyCode, subCode, subSubCode, viewportBbox, returnGeoJson)`](#fetchandcheckgeojsonintersectioncountycode-subcode-subsubcode-viewportbbox-returngeojson)
    - [Other Complementary Functions](#other-complementary-functions)
  - [Licensing](#licensing)
  - [Contribution](#contribution)
- [whatsInView Function Overview](#whatsinview-function-overview)
  - [Key Features:](#key-features)

# wmeGisLBBOX

Welcome to the `wmeGisLBBOX` userscript, This script is designed to determine which geographical divisions within a viewport intersect with a specified Bounding Box (BBOX). It can be used to dynamically fetch and process geographical data.

## Features

- **Caching Mechanism**: Efficient data retrieval using caching to prevent redundant fetch operations.
- **BBOX Intersection Checks**: Analyze two bounding boxes to identify intersection, crucial for spatial data operations.
- **Country and Subdivision Intersection Analysis**: Fetch and analyze countries and their subdivisions to identify those intersecting with your viewport.
- **GeoJSON Data Processing**: Handle GeoJSON data for more precise geographical intersection validations.

## Installation

To use `wmeGisLBBOX`, you'll need to install it as a userscript. You can use browser extensions like Tampermonkey or Greasemonkey that support userscripts.

1. Open your userscript extension dashboard.
2. Create a new script and paste the provided code into the script editor.
3. Save the script and ensure it is enabled.

## Usage

Once installed, the script runs automatically and integrates with your web application to process geographical data. The main functionality is encapsulated in the `wmeGisLBBOX` class, providing various methods for fetching and intersecting geographical data.

### Important Functions

#### `fetchJsonWithCache(url)`

Fetches JSON data from a specified URL with caching:

```javascript
fetchJsonWithCache(url: string): Promise<Object>
```

- Process Overview:
  - Checks cache for existing data; returns cached data if available.
  - Performs an HTTP GET request if data isn't cached, then stores and returns fetched data.

### `checkIntersection(bbox1, bbox2)`

Determines if two bounding boxes intersect:

```javascript
checkIntersection(bbox1: Object, bbox2: Object): boolean
```

- Process Overview:
  - Checks latitude and longitude overlap scenarios to affirm intersection.
  - Considers antimeridian wrapping issues.

### `getIntersectingCountries(viewportBbox)`

Identifies countries intersecting with the specified viewport:

```javascript
getIntersectingCountries(viewportBbox: Object): Promise<Array>
```

- Process Overview:
  - Fetches country bounding box data and confirms country intersections.

### `getCountriesAndSubsJson()`

Fetches and augments country data with subdivision information:

```javascript
getCountriesAndSubsJson(): Promise<Object>
```

- Process Overview:
  - Retrieves base and subdivision data to present comprehensive geographical details.

### `cleanIntersectingData(intersectingCountries)`

Cleans intersecting country data by removing empty subdivisions:

```javascript
cleanIntersectingData(intersectingCountries: Object)
```

- Process Overview:
  - Processes hierarchical subdivision structures, prunes empty subdivisions.

### `fetchAndCheckGeoJsonIntersection(countyCode, subCode, subSubCode, viewportBbox, returnGeoJson)`

Fetches GeoJSON data for a specified region and checks intersection with a viewport:

```javascript
fetchAndCheckGeoJsonIntersection(countyCode: string, subCode: string, subSubCode: string, viewportBbox: Object, returnGeoJson: boolean): Promise<boolean|Object>
```

- Process Overview:
  - Confirms GeoJSON intersection presence or returns GeoJSON data based on the flag.

### Other Complementary Functions

- hasIntersection(polygon1, polygon2): Checks for intersection between two polygons.
- segmentIntersection(p1, p2, q1, q2): Calculates the intersection point between two line segments.
- isPointInPolygon(point, vs): Determines if a point is inside a polygon.

## Licensing

This script is licensed under the MIT License.

## Contribution

Feel free to contribute to its development on our GitHub repository. Issues, pull requests, and feature suggestions are welcome.

# whatsInView Function Overview

The whatsInView function is a key component of the userscript that interacts with the map SDK to provide a user interface for geographical insights. This function manages the initialization of the SDK and WazeWrap, ensures all necessary components are ready, and sets up the user interface in the WME sidebar. It responds to map movements, updating the content dynamically based on changes in the viewport.

## Key Features:

- SDK Integration: Utilizes the WME SDK to access map extent and other functionalities, ensuring dependencies are loaded before proceeding.
- User Interface Setup: Creates and registers a sidebar tab within the WME, displaying script details and interactive elements.
- Popup System: Generates a popup that displays "Whats in View?" geographic details, such as visible regions within the current map viewport.
- Real-time Updates: Listens for map movement events to refresh data in the popup, ensuring accurate and up-to-date information.
- Debug and Precision Toggles: Provides interface options to enable or disable debug mode and high precision data processing.
- Collaborative Functions: Supports interaction with other components like WazeWrap to enhance functionality and data accuracy.

This function is designed to enhance geographical data visibility and usability for users interacting with web maps by providing a straightforward interface and real-time data updates.
