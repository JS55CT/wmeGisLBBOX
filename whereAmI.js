// ==UserScript==
// @name                WME Where Am I
// @namespace           https://github.com/JS55CT
// @description         Use BBOX to locate where you are from a Viewport.
// @version             1.1.1
// @author              JS55CT
// @match               https://www.waze.com/*/editor*
// @match               https://www.waze.com/editor*
// @match               https://beta.waze.com/*
// @exclude             https://www.waze.com/*user/*editor/*
// @require             https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require             https://js55ct.github.io/geoBBoxPruner/geoBBoxPruner.js
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
geoBBoxPruner
*/

var whereAmI = function () {
  "use strict";
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;

  // Get the map extent from the SDK
  const geoPruner = new geoBBoxPruner(); // Create and reuse this instance

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
      tabLabel.textContent = "wAMi";
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
      geoform.id = "geoform";
      geobox.appendChild(geoform);

      let fileContainer = document.createElement("div");
      fileContainer.style.cssText = "position: relative; display: inline-block;";

      let hrElement0 = document.createElement("hr");
      hrElement0.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement0);

      const whereAmIButtonContainer = createButton("Where Am I?", "#BA68C8", "#9C27B0", "#FFFFFF", "input");
      whereAmIButtonContainer.onclick = () => {
        whereAmI();
      };
      geoform.appendChild(whereAmIButtonContainer);

      let hrElement1 = document.createElement("hr");
      hrElement1.style.cssText = "margin: 5px 0; border: 0; border-top: 1px solid #ddd;";
      geoform.appendChild(hrElement1);

      wmeSDK.Events.on({
        eventName: "wme-map-move-end",
        eventHandler: () => {
          const whereAmIpopUp = document.getElementById("WMEwhereAmIMessage");

          if (whereAmIpopUp) {
            // Call the update function to refresh the contents of the existing popup
            whereAmI();
            //updateWhatsInView(whatsInView);
          }
          // If the message does not exist, do nothing
        },
      });
      console.log(`${scriptName}: User Interface Loaded!`);
    });
  }

  let messagePosition = {
  x: '50%', // Default position at the center
  y: '50%'
};

async function whereAmI() {
  // First remove any existing message
  const existingMessage = document.getElementById("WMEwhereAmIMessage");
  if (existingMessage) {
    existingMessage.remove();
  }

  const wgs84Extent = wmeSDK.Map.getMapExtent();

  const viewportBbox = {
    minLon: wgs84Extent[0],
    minLat: wgs84Extent[1],
    maxLon: wgs84Extent[2],
    maxLat: wgs84Extent[3],
  };

  const visibleRegions = await geoPruner.whatsInView(viewportBbox, true);
  console.log("Visible Regions:", visibleRegions);

  const parsingMessage = document.createElement("div");
  parsingMessage.id = "WMEwhereAmIMessage";
  parsingMessage.style = `
    position: absolute;
    padding: 0;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    width: 375px;
    height: 375px;
    min-width: 200px;
    min-height: 200px;
    max-width: 30vw;
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
  title.innerText = "Where Am I?";
  header.appendChild(title);

  const closeButton = document.createElement("span");
  closeButton.textContent = "X";
  closeButton.style = `cursor: pointer; font-size: 20px; margin-left: 10px;`;
  closeButton.addEventListener("click", () => {
    parsingMessage.remove();
  });
  header.appendChild(closeButton);

  header.onmousedown = (event) => {
    event.preventDefault();
    const initialX = event.clientX;
    const initialY = event.clientY;
    const offsetX = initialX - parsingMessage.offsetLeft;
    const offsetY = initialY - parsingMessage.offsetTop;

    document.onmousemove = (ev) => {
      parsingMessage.style.left = `${ev.clientX - offsetX}px`;
      parsingMessage.style.top = `${ev.clientY - offsetY}px`;
    };

    document.onmouseup = () => {
      document.onmousemove = null;
      document.onmouseup = null;
      // Update position on mouse release
      messagePosition.x = `${parsingMessage.style.left}`;
      messagePosition.y = `${parsingMessage.style.top}`;
    };
  };

  const contentContainer = document.createElement("div");
  contentContainer.id = "WMEwhereAmIContent";
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

  let messageContent = "Where Am I?:<br><br>";
  for (let countryName in visibleRegions) {
    const country = visibleRegions[countryName];
    messageContent += `<div style="margin-left: 0;"><strong>* ${countryName} (${country.ISO_ALPHA2})</strong></div>`;
    if (country.ISO_ALPHA2 === "US" && country.subL1) {
      for (let stateName in country.subL1) {
        const state = country.subL1[stateName];
        messageContent += `<div style="margin-left: 20px;">&bull; <strong>${stateName} (${state.STUSPS}) | Sub L1 | ${state.source}</strong></div>`;
        if (state.subL2) {
          for (let countyName in state.subL2) {
            const county = state.subL2[countyName];
            messageContent += `<div style="margin-left: 40px;">&mdash; <em>${countyName} (${county.COUNTYFP}) | Sub L2 | ${county.source}</em></div>`;
            if (county.subL3) {
              for (let subdivisionName in county.subL3) {
                const subdivision = county.subL3[subdivisionName];
                if (subdivision) {
                  messageContent += `<div style="margin-left: 60px;">&ndash; <span style="font-weight: lighter;">${subdivisionName} (${subdivision.COUSUBFP}) | Sub L3 | ${subdivision.source}</span></div>`;
                }
              }
            }
          }
        }
      }
    } else if (country.subL1) {
      for (let subL1Name in country.subL1) {
        const subL1data = country.subL1[subL1Name];
        messageContent += `<div style="margin-left: 20px;">&bull; <strong>${subL1Name} (${subL1data.subL1_code} ${subL1data.subL1_id}) | Sub L1 | ${subL1data.source}</strong></div>`;
        if (subL1data.subL2) {
          for (let subL2Name in subL1data.subL2) {
            const subL2data = subL1data.subL2[subL2Name];
            messageContent += `<div style="margin-left: 40px;">&mdash; <em>${subL2Name} (${subL2data.subL2_id || ""}) | Sub L2 | ${subL2data.source}</em></div>`;
          }
        }
      }
      messageContent += "<br>";
    }
  }

  contentContainer.innerHTML = messageContent;

  parsingMessage.appendChild(header);
  parsingMessage.appendChild(contentContainer);
  document.body.appendChild(parsingMessage);

  const styleElement = document.createElement("style");
  styleElement.innerHTML = `
    #WMEwhereAmIMessage div::-webkit-scrollbar { width: 12px; }
    #WMEwhereAmIMessage div::-webkit-scrollbar-track { background: #333333; border-radius: 10px; }
    #WMEwhereAmIMessage div::-webkit-scrollbar-thumb { background-color: #33ff57; border-radius: 10px; border: 2px solid transparent; }
    #WMEwhereAmIMessage div::-webkit-scrollbar-thumb:hover { background-color: #28d245; }
  `;
  document.head.appendChild(styleElement);
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
whereAmI();
