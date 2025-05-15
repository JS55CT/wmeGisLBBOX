// ==UserScript==
// @name                WME Whats in View
// @namespace           https://github.com/JS55CT
// @description         Displays a popup with geographic information for the visible map region in Waze Map Editor.
// @version             2.1.0
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://js55ct.github.io/wmeGisLBBOX/wmeGisLBBOX.js
// @connect             github.io
// @grant               unsafeWindow
// @grant               GM_xmlhttpRequest
// @license             MIT
// ==/UserScript==

/*
External Variables and Objects:
GM_info
unsafeWindow
WazeWrap
wmeGisLBBOX
*/

var whatsInView = function () {
  "use strict";
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;
  let debug = false;
  let highPrecision = true;

  // Get the map extent from the SDK
  const geoPruner = new wmeGisLBBOX(); // Create and reuse this instance
  let wmeSDK;

  // Ensure SDK_INITIALIZED is available
  if (unsafeWindow.SDK_INITIALIZED) {
    unsafeWindow.SDK_INITIALIZED.then(bootstrap).catch((err) => {
      console.error(`${scriptName}: SDK initialization failed`, err);
    });
  } else {
    console.warn(`${scriptName}: SDK_INITIALIZED is undefined`);
  }

  function bootstrap() {
    wmeSDK = unsafeWindow.getWmeSdk({
      scriptId: scriptName.replaceAll(" ", ""),
      scriptName: scriptName,
    });

    // Wait for both WME and WazeWrap to be ready
    Promise.all([isWmeReady(), isWazeWrapReady()])
      .then(() => {
        console.log(`${scriptName}: All dependencies are ready.`);
        init();
      })
      .catch((error) => {
        console.error(`${scriptName}: Error during bootstrap -`, error);
      });
  }

  function isWmeReady() {
    return new Promise((resolve, reject) => {
      if (wmeSDK && wmeSDK.State.isReady() && wmeSDK.Sidebar && wmeSDK.LayerSwitcher && wmeSDK.Shortcuts && wmeSDK.Events) {
        resolve();
      } else {
        wmeSDK.Events.once({ eventName: "wme-ready" })
          .then(() => {
            if (wmeSDK.Sidebar && wmeSDK.LayerSwitcher && wmeSDK.Shortcuts && wmeSDK.Events) {
              console.log(`${scriptName}: WME is fully ready now.`);
              resolve();
            } else {
              reject(`${scriptName}: Some SDK components are not loaded.`);
            }
          })
          .catch((error) => {
            console.error(`${scriptName}: Error while waiting for WME to be ready:`, error);
            reject(error);
          });
      }
    });
  }

  function isWazeWrapReady() {
    return new Promise((resolve, reject) => {
      (function check(tries = 0) {
        if (unsafeWindow.WazeWrap && unsafeWindow.WazeWrap.Ready) {
          resolve();
        } else if (tries < 1000) {
          setTimeout(() => {
            check(++tries);
          }, 500);
        } else {
          reject(`${scriptName}: WazeWrap took too long to load.`);
        }
      })();
    });
  }

  /*********************************************************************
   * init
   *************************************************************************/
  async function init() {
    console.log(`${scriptName}: Loading User Interface ...`);

    wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
      tabLabel.textContent = "WIV";
      tabLabel.title = `${scriptName}`;

      let geobox = document.createElement("div");
      geobox.style.cssText = "padding: 5px; background-color: #fff; border: 2px solid #ddd; border-radius: 5px; box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);";
      tabPane.appendChild(geobox);

      let geotitle = document.createElement("div");
      geotitle.innerHTML = GM_info.script.name;
      geotitle.style.cssText = "text-align: center; font-size: 1.1em; font-weight: bold; color: #222;";
      geobox.appendChild(geotitle);

      let geoversion = document.createElement("div");
      geoversion.innerHTML = "v " + GM_info.script.version;
      geoversion.style.cssText = "text-align: center; font-size: 0.9em; color: #222;";
      geobox.appendChild(geoversion);

      let geoform = document.createElement("form");
      geoform.style.cssText = "display: flex; flex-direction: column; gap: 0px;";
      geoform.id = "whatsInView";
      geobox.appendChild(geoform);

      let fileContainer = document.createElement("div");
      fileContainer.style.cssText = "position: relative; display: inline-block;";

      let hrElement0 = document.createElement("hr");
      hrElement0.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement0);

      const whereInViewIButtonContainer = createButton("Whats in Veiw?", "#BA68C8", "#9C27B0", "#FFFFFF", "input");
      whereInViewIButtonContainer.onclick = () => {
        whatsInViewPopUp();
      };
      geoform.appendChild(whereInViewIButtonContainer);

      let hrElement1 = document.createElement("hr");
      hrElement1.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement1);

      wmeSDK.Events.on({
        eventName: "wme-map-move-end",
        eventHandler: () => {
          if (isPopupCreated) {
            whatsInViewPopUp(); // Call the update function to refresh the contents of the existing popup
          }
        },
      });

      // Add Toggle Button for Debug
      let debugToggleContainer = document.createElement("div");
      debugToggleContainer.style.cssText = `display: flex; align-items: center; margin-top: 15px;`;

      let debugToggleLabel = document.createElement("label");
      debugToggleLabel.style.cssText = `margin-left: 10px;`;

      const updateDebugLabel = () => {
        debugToggleLabel.innerText = `Debug mode ${debug ? "ON" : "OFF"}`;
      };

      let debugSwitchWrapper = document.createElement("label");
      debugSwitchWrapper.style.cssText = `position: relative; display: inline-block; width: 40px; height: 20px; border: 1px solid #ccc; border-radius: 20px;`;

      let debugToggleSwitch = document.createElement("input");
      debugToggleSwitch.type = "checkbox";
      debugToggleSwitch.style.cssText = `opacity: 0; width: 0; height: 0;`;

      let debugSwitchSlider = document.createElement("span");
      debugSwitchSlider.style.cssText = `position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;`;

      let debugInnerSpan = document.createElement("span");
      debugInnerSpan.style.cssText = `position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;`;

      debugSwitchSlider.appendChild(debugInnerSpan);

      const updateDebugSwitchState = () => {
        debugSwitchSlider.style.backgroundColor = debug ? "#8BC34A" : "#ccc";
        debugInnerSpan.style.transform = debug ? "translateX(20px)" : "translateX(0)";
      };

      // Initialize Debug Toggle State
      debugToggleSwitch.checked = debug;
      updateDebugLabel();
      updateDebugSwitchState();

      debugToggleSwitch.addEventListener("change", () => {
        debug = debugToggleSwitch.checked;
        updateDebugLabel();
        updateDebugSwitchState();
        console.log(`${scriptName}: Debug mode is now ${debug ? "enabled" : "disabled"}`);
      });

      debugSwitchWrapper.appendChild(debugToggleSwitch);
      debugSwitchWrapper.appendChild(debugSwitchSlider);
      debugToggleContainer.appendChild(debugSwitchWrapper);
      debugToggleContainer.appendChild(debugToggleLabel);
      geoform.appendChild(debugToggleContainer);

      // Add Toggle Button for High Precision
      let highPrecisionToggleContainer = document.createElement("div");
      highPrecisionToggleContainer.style.cssText = `display: flex; align-items: center; margin-top: 15px;`;

      let highPrecisionToggleLabel = document.createElement("label");
      highPrecisionToggleLabel.style.cssText = `margin-left: 10px;`;

      const updateHighPrecisionLabel = () => {
        highPrecisionToggleLabel.innerText = `High Precision ${highPrecision ? "ON" : "OFF"}`;
      };

      let highPrecisionSwitchWrapper = document.createElement("label");
      highPrecisionSwitchWrapper.style.cssText = `position: relative; display: inline-block; width: 40px; height: 20px; border: 1px solid #ccc; border-radius: 20px;`;

      let highPrecisionToggleSwitch = document.createElement("input");
      highPrecisionToggleSwitch.type = "checkbox";
      highPrecisionToggleSwitch.style.cssText = `opacity: 0; width: 0; height: 0;`;

      let highPrecisionSwitchSlider = document.createElement("span");
      highPrecisionSwitchSlider.style.cssText = `position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;`;

      let highPrecisionInnerSpan = document.createElement("span");
      highPrecisionInnerSpan.style.cssText = `position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;`;

      highPrecisionSwitchSlider.appendChild(highPrecisionInnerSpan);

      const updateHighPrecisionSwitchState = () => {
        highPrecisionSwitchSlider.style.backgroundColor = highPrecision ? "#8BC34A" : "#ccc";
        highPrecisionInnerSpan.style.transform = highPrecision ? "translateX(20px)" : "translateX(0)";
      };

      // Initialize High Precision Toggle State
      highPrecisionToggleSwitch.checked = highPrecision;
      updateHighPrecisionLabel();
      updateHighPrecisionSwitchState();

      highPrecisionToggleSwitch.addEventListener("change", () => {
        highPrecision = highPrecisionToggleSwitch.checked;
        updateHighPrecisionLabel();
        updateHighPrecisionSwitchState();
        console.log(`${scriptName}: High Precision is now ${highPrecision ? "enabled" : "disabled"}`);
      });

      highPrecisionSwitchWrapper.appendChild(highPrecisionToggleSwitch);
      highPrecisionSwitchWrapper.appendChild(highPrecisionSwitchSlider);
      highPrecisionToggleContainer.appendChild(highPrecisionSwitchWrapper);
      highPrecisionToggleContainer.appendChild(highPrecisionToggleLabel);
      geoform.appendChild(highPrecisionToggleContainer);

      console.log(`${scriptName}: User Interface Loaded!`);
    });
  }

  let messagePosition = {
    x: "50%",
    y: "50%",
    width: "375px",
    height: "375px",
  };

  let isPopupCreated = false; // Flag to track if the popup has been created

  async function whatsInViewPopUp() {
    if (!isPopupCreated) {
      const messageElement = document.createElement("div");
      messageElement.id = "WMEwhatsInViewPopUpMessage";
      messageElement.style = `
        position: absolute;
        padding: 0;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        width: ${messagePosition.width};
        height: ${messagePosition.height};
        min-width: 200px;
        min-height: 200px;
        max-width: 40vw;
        max-height: 40vh;
        left: ${messagePosition.x};
        top: ${messagePosition.y};
        transform: translate(-50%, -50%);
        resize: both;
        overflow: hidden;
      `;

      const header = document.createElement("div");
      header.style = `
        background: #33ff57;
        font-weight: 300;
        color: black;
        padding: 5px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 30px;
        position: sticky;
        top: 0;
        cursor: move;
      `;

      const title = document.createElement("span");
      title.innerText = "Whats in View?";
      header.appendChild(title);

      const closeButton = document.createElement("span");
      closeButton.textContent = "X";
      closeButton.style = `cursor: pointer; font-size: 20px; margin-left: 10px;`;
      closeButton.addEventListener("click", () => {
        messageElement.remove();
        isPopupCreated = false;
      });
      header.appendChild(closeButton);

      header.onmousedown = (event) => {
        const initialX = event.clientX;
        const initialY = event.clientY;
        const offsetX = initialX - messageElement.offsetLeft;
        const offsetY = initialY - messageElement.offsetTop;

        document.onmousemove = (ev) => {
          messageElement.style.left = `${ev.clientX - offsetX}px`;
          messageElement.style.top = `${ev.clientY - offsetY}px`;
        };

        document.onmouseup = () => {
          document.onmousemove = null;
          document.onmouseup = null;
          messagePosition.x = `${messageElement.style.left}`;
          messagePosition.y = `${messageElement.style.top}`;
        };
      };

      messageElement.appendChild(header);
      document.body.appendChild(messageElement);

      const contentContainer = document.createElement("div");
      contentContainer.id = "WMEwhatsInViewPopUpContent";
      contentContainer.style = `
        padding: 5px;
        height: calc(100% - 30px);
        overflow-y: auto;
        overflow-x: hidden;
        color: #ffffff;
        font-family: 'Arial', sans-serif;
        font-size: 1.0rem;
        text-align: left;
      `;

      messageElement.appendChild(contentContainer);

      const styleElement = document.createElement("style");
      styleElement.innerHTML = `
        #WMEwhatsInViewPopUpMessage div::-webkit-scrollbar { width: 12px; }
        #WMEwhatsInViewPopUpMessage div::-webkit-scrollbar-track { background: #333333; border-radius: 10px; }
        #WMEwhatsInViewPopUpMessage div::-webkit-scrollbar-thumb { background-color: #33ff57; border-radius: 10px; border: 2px solid transparent; }
        #WMEwhatsInViewPopUpMessage div::-webkit-scrollbar-thumb:hover { background-color: #28d245; }
      `;
      document.head.appendChild(styleElement);

      // Track resizing actions and update size accordingly
      messageElement.addEventListener("mousemove", (event) => {
        if (event.buttons !== 1) return; // Only track when mouse button is held

        const rect = messageElement.getBoundingClientRect();
        messagePosition.width = `${rect.width}px`;
        messagePosition.height = `${rect.height}px`;
      });

      isPopupCreated = true; // Set flag to true once popup is created
      updatewhatsInViewPopUp(); // Call update function to populate content
    } else {
      updatewhatsInViewPopUp();
    }
  }

  async function updatewhatsInViewPopUp() {
    const wgs84Extent = wmeSDK.Map.getMapExtent();

    const viewportBbox = {
      minLon: wgs84Extent[0],
      minLat: wgs84Extent[1],
      maxLon: wgs84Extent[2],
      maxLat: wgs84Extent[3],
    };

    const visibleRegions = await geoPruner.whatsInView(viewportBbox, highPrecision, highPrecision);
    if (debug) console.log(`${scriptName}: WhatsInView JSON:`, visibleRegions);

    const contentContainer = document.getElementById("WMEwhatsInViewPopUpContent");
    let messageContent = "<br>";

    // Sort and iterate over countries
    const sortedCountries = Object.entries(visibleRegions).sort(([a], [b]) => a.localeCompare(b));
    for (let [countryName, country] of sortedCountries) {
      messageContent += `<div style="margin-left: 0;"><strong>* ${countryName} (${country.ISO_ALPHA3})</strong></div>`;

      if (country.ISO_ALPHA3 === "USA" && country.subL1) {
        // Sort and iterate over states
        const sortedStates = Object.entries(country.subL1).sort(([a], [b]) => a.localeCompare(b));
        for (let [stateName, state] of sortedStates) {
          messageContent += `<div style="margin-left: 20px;">&bull; <strong>${stateName} (${state.subL1_id} ${state.subL1_num}) | Sub L1 | ${state.source}</strong></div>`;

          if (state.subL2) {
            // Sort and iterate over counties
            const sortedCounties = Object.entries(state.subL2).sort(([a], [b]) => a.localeCompare(b));
            for (let [countyName, county] of sortedCounties) {
              messageContent += `<div style="margin-left: 40px;">&mdash; <em>${countyName} (${county.subL2_num}) | Sub L2 | ${county.source}</em></div>`;

              if (county.subL3) {
                // Sort and iterate over subdivisions
                const sortedSubdivisions = Object.entries(county.subL3).sort(([a], [b]) => a.localeCompare(b));
                for (let [subdivisionName, subdivision] of sortedSubdivisions) {
                  if (subdivision) {
                    messageContent += `<div style="margin-left: 60px;">&ndash; <span style="font-weight: lighter;">${subdivisionName} (${subdivision.subL3_num}) | Sub L3 | ${subdivision.source}</span></div>`;
                  }
                }
              }
            }
          }
        }
      } else if (country.subL1) {
        const sortedSubL1 = Object.entries(country.subL1).sort(([a], [b]) => a.localeCompare(b));
        for (let [subL1Name, subL1data] of sortedSubL1) {
          messageContent += `<div style="margin-left: 20px;">&bull; <strong>${subL1Name} (${subL1data.subL1_id} ${subL1data.subL1_num}) | Sub L1 | ${subL1data.source}</strong></div>`;

          if (subL1data.subL2) {
            const sortedSubL2 = Object.entries(subL1data.subL2).sort(([a], [b]) => a.localeCompare(b));
            for (let [subL2Name, subL2data] of sortedSubL2) {
              messageContent += `<div style="margin-left: 40px;">&mdash; <em>${subL2Name} (${subL2data.subL2_num}) | Sub L2 | ${subL2data.source}</em></div>`;
            }
          }
        }
        messageContent += "<br>";
      }
    }

    contentContainer.innerHTML = messageContent;
  }

  function createButton(text, bgColor, mouseoverColor, textColor, type = "button", labelFor = "") {
    let element;

    if (type === "label") {
      element = document.createElement("label");
      element.textContent = text;

      if (labelFor) {
        element.htmlFor = labelFor;
      }
    } else if (type === "input") {
      element = document.createElement("input");
      element.type = "button";
      element.value = text;
    } else {
      element = document.createElement("button");
      element.textContent = text;
    }

    element.style.cssText = `padding: 8px 0; font-size: 1rem; border: 2px solid ${bgColor}; border-radius: 20px; cursor: pointer; background-color: ${bgColor}; color: ${textColor}; 
        box-sizing: border-box; transition: background-color 0.3s, border-color 0.3s; font-weight: bold; text-align: center; width: 95%; margin: 3px;`;

    element.addEventListener("mouseover", function () {
      element.style.backgroundColor = mouseoverColor;
      element.style.borderColor = mouseoverColor;
    });

    element.addEventListener("mouseout", function () {
      element.style.backgroundColor = bgColor;
      element.style.borderColor = bgColor;
    });

    return element;
  }
};
whatsInView();
