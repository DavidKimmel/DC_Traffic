document.addEventListener('DOMContentLoaded', function () {
  // Initialize the Leaflet map centered on Washington, DC at zoom 13
  var initialCenter = [38.9072, -77.0369];
  var initialZoom = 12;
  var map = L.map('map').setView(initialCenter, initialZoom);

  // Save the original view for resetting
  var originalCenter = initialCenter;
  var originalZoom = initialZoom;

  // Add the OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Create custom panes for layering
  map.createPane('polygonsPane');
  map.getPane('polygonsPane').style.zIndex = 420; // Lower pane for ward polygons

  map.createPane('markersPane');
  map.getPane('markersPane').style.zIndex = 650; // Higher pane for crash markers

  // Global variables for CSV data, marker layer, and full year list (excluding 2018)
  var csvData = [];
  var geoLayer;
  var allYears = [];  

  // Create a container for filter controls and add to #controls
  var controlsDiv = document.getElementById("controls");
  var filterDiv = document.createElement("div");
  filterDiv.id = "filters";
  filterDiv.innerHTML = `
    <label for="yearFilter">Select Year:</label>
    <select id="yearFilter"><option value="">-- All --</option></select>
    &nbsp;&nbsp;
    <label for="wardFilter">Ward:</label>
    <select id="wardFilter"><option value="">-- All --</option></select>
    &nbsp;&nbsp;
    <label for="injuryFilter">Injury Severity:</label>
    <select id="injuryFilter">
      <option value="all">All</option>
      <option value="high">High</option>
      <option value="low">Low</option>
      <option value="none">None</option>
    </select>
    <label><input type="checkbox" id="fatalityFilter"> Fatalities Only</label>
    &nbsp;&nbsp;
    <label><input type="checkbox" id="pedestrianFilter"> Pedestrian Involved</label>
    &nbsp;&nbsp;
    <label><input type="checkbox" id="bicyclistFilter"> Bicyclist Involved</label>
    &nbsp;&nbsp;
    <br/><br/>
  `;
  controlsDiv.insertBefore(filterDiv, controlsDiv.firstChild);

  // Get references to filter elements
  var selectYear = document.getElementById("yearFilter");
  var selectWard = document.getElementById("wardFilter");
  var checkboxFatalities = document.getElementById("fatalityFilter");
  var checkboxPedestrians = document.getElementById("pedestrianFilter");
  var checkboxBicyclists = document.getElementById("bicyclistFilter");
  var selectInjury = document.getElementById("injuryFilter");

  // Load CSV data using D3
  d3.csv("data/crash.csv").then(function(data) {
    csvData = data;

    // Extract the year from the DATE field (first 4 characters)
    csvData.forEach(function(d) {
      d.year = d.DATE.substring(0, 4);
    });
    // Filter out records from 2018
    csvData = csvData.filter(function(d) {
      return d.year !== "2018";
    });

    // Populate the Year filter and store complete year list in allYears
    var years = new Set(csvData.map(function(d) { return d.year; }));
    allYears = Array.from(years).sort();
    allYears.forEach(function(year) {
      var option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      selectYear.appendChild(option);
    });

    // Populate the Ward filter (exclude "Unknown" and "Null")
    var wards = new Set(
      csvData
        .map(function(d) { return d.WARD; })
        .filter(function(ward) { 
          return ward && ward.toLowerCase() !== "unknown" && ward.toLowerCase() !== "null"; 
        })
    );
    var wardsArr = Array.from(wards).sort();
    wardsArr.forEach(function(ward) {
      var option = document.createElement("option");
      option.value = ward;
      option.textContent = ward;
      selectWard.appendChild(option);
    });

    // Optionally, set a default filter (e.g., default to year 2025 if available)
    if (years.has("2025")) {
      selectYear.value = "2025";
    }

    // Initial update of the map with default filter values
    updateMap();
  }).catch(function(error) {
    console.error("Error loading CSV data:", error);
  });

  // Load ward polygons from wards.geojson and add interactive behavior
  d3.json("data/wards.geojson").then(function(wardsData) {
    L.geoJSON(wardsData, {
      pane: 'polygonsPane', // Add polygons to lower pane
      style: function(feature) {
        return {
          color: "blue",
          weight: 0,
          fill: true,       // Enable fill so mouse events are captured
          fillOpacity: 0    // But keep fill transparent
        };
      },
      onEachFeature: function(feature, layer) {
        layer.on({
          mouseover: function(e) {
            // On mouseover, change stroke to red, increase weight, and move to markers pane
            layer.setStyle({ weight: 3, color: "yellow" });
            layer.setPane('markersPane');
          },
          mouseout: function(e) {
            // On mouseout, revert stroke to blue, weight to 1, and move back to polygons pane
            layer.setStyle({ weight: 0, color: "blue" });
            layer.setPane('polygonsPane');
          },
          click: function(e) {
            var wardName = feature.properties.WARD;
            if (wardName) {
              selectWard.value = wardName;
              updateMap();
              if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds());
              } else {
                map.setView(e.latlng, 18);
              }
            }
          }
        });
      }
    }).addTo(map);
  }).catch(function(error) {
    console.error("Error loading ward polygons:", error);
  });

  // Custom Leaflet control for Reset Map added as a button on the map
  var ResetControl = L.Control.extend({
    options: {
      position: 'topright'
    },
    onAdd: function(map) {
      var container = L.DomUtil.create('div', 'leaflet-bar reset-control');
      container.style.backgroundColor = 'white';
      container.style.padding = '5px';
      container.style.cursor = 'pointer';
      container.innerHTML = 'Reset Zoom';

      L.DomEvent.on(container, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        map.setView(originalCenter, originalZoom);
      });

      return container;
    }
  });
  map.addControl(new ResetControl());

  // Function to update the map based on the selected filters
  function updateMap() {
    // Remove existing marker layer if it exists
    if (geoLayer) {
      map.removeLayer(geoLayer);
    }

    // Get current filter values
    var selectedYear = selectYear.value;
    var selectedWard = selectWard.value;
    var fatalitiesOnly = checkboxFatalities.checked;
    var pedestrianOnly = checkboxPedestrians.checked;
    var bicyclistOnly = checkboxBicyclists.checked;
    var injurySeverity = selectInjury.value; // "all", "high", "low", "none"

    // Filter CSV data for the map (including the year filter)
    var filteredMapData = csvData.filter(function(d) {
      if (selectedYear && d.year !== selectedYear) return false;
      if (selectedWard && d.WARD !== selectedWard) return false;
      if (fatalitiesOnly) {
        var totalFatal = (parseFloat(d.FATAL_DRIVER) || 0) +
                         (parseFloat(d.FATAL_PEDESTRIAN) || 0) +
                         (parseFloat(d.FATAL_BICYCLIST) || 0);
        if (totalFatal === 0) return false;
      }
      if (pedestrianOnly && (parseFloat(d.TOTAL_PEDESTRIANS) || 0) === 0) return false;
      if (bicyclistOnly && (parseFloat(d.TOTAL_PEDESTRIQUES) || parseFloat(d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (injurySeverity !== "all") {
        var majorInjuries = (parseFloat(d.MAJORINJURIES_DRIVER) || 0) +
                            (parseFloat(d.MAJORINJURIES_PEDESTRIAN) || 0) +
                            (parseFloat(d.MAJORINJURIES_BICYCLIST) || 0);
        var minorInjuries = (parseFloat(d.MINORINJURIES_DRIVER) || 0) +
                            (parseFloat(d.MINORINJURIES_PEDESTRIAN) || 0) +
                            (parseFloat(d.MINORINJURIES_BICYCLIST) || 0);
        if (injurySeverity === "high" && majorInjuries === 0) return false;
        if (injurySeverity === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (injurySeverity === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });

    // Convert filtered map data to GeoJSON features
    var features = filteredMapData.map(function(d) {
      var lat = parseFloat(d.LATITUDE);
      var lng = parseFloat(d.LONGITUDE);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          "type": "Feature",
          "properties": d,
          "geometry": {
            "type": "Point",
            "coordinates": [lng, lat]
          }
        };
      }
    }).filter(function(feature) { return feature !== undefined; });

    var geojsonData = {
      "type": "FeatureCollection",
      "features": features
    };

    // Add the markers layer to the map on the markers pane
    geoLayer = L.geoJSON(geojsonData, {
      pane: 'markersPane',
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 6,
          className: 'marker'
        });
      },
      onEachFeature: function(feature, layer) {
        var props = feature.properties;
        var popupLines = [];
        if (props.LATITUDE && props.LATITUDE.trim() !== "") {
          popupLines.push("<strong>LATITUDE:</strong> " + props.LATITUDE);
        }
        if (props.LONGITUDE && props.LONGITUDE.trim() !== "") {
          popupLines.push("<strong>LONGITUDE:</strong> " + props.LONGITUDE);
        }
        if (props.DATE && props.DATE.trim() !== "") {
          popupLines.push("<strong>DATE:</strong> " + props.DATE);
        }
        if (props.ADDRESS && props.ADDRESS.trim() !== "") {
          popupLines.push("<strong>ADDRESS:</strong> " + props.ADDRESS);
        }
        if (props.WARD && props.WARD.trim() !== "") {
          popupLines.push("<strong>WARD:</strong> " + props.WARD);
        }
        var skipFields = ["LATITUDE", "LONGITUDE", "DATE", "ADDRESS", "WARD", "XCOORD", "YCOORD"];
        for (var key in props) {
          if (skipFields.indexOf(key) === -1) {
            var value = props[key];
            var numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue !== 0) {
              popupLines.push("<strong>" + key + ":</strong> " + value);
            }
          }
        }
        var popupContent = "<h4>Crash Details</h4>" + popupLines.join("<br/>");
        layer.bindPopup(popupContent);
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          map.setView(e.latlng, 18);
        });
      }
    }).addTo(map);

    // For the bar chart, apply all filters except the year filter so all years appear
    var chartFiltered = csvData.filter(function(d) {
      if (selectWard.value && d.WARD !== selectWard.value) return false;
      if (checkboxFatalities.checked) {
        var totalFatal = (parseFloat(d.FATAL_DRIVER) || 0) +
                         (parseFloat(d.FATAL_PEDESTRIAN) || 0) +
                         (parseFloat(d.FATAL_BICYCLIST) || 0);
        if (totalFatal === 0) return false;
      }
      if (checkboxPedestrians.checked && (parseFloat(d.TOTAL_PEDESTRIANS) || 0) === 0) return false;
      if (checkboxBicyclists.checked && (parseFloat(d.TOTAL_PEDESTRIQUES) || parseFloat(d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (selectInjury.value !== "all") {
        var majorInjuries = (parseFloat(d.MAJORINJURIES_DRIVER) || 0) +
                            (parseFloat(d.MAJORINJURIES_PEDESTRIAN) || 0) +
                            (parseFloat(d.MAJORINJURIES_BICYCLIST) || 0);
        var minorInjuries = (parseFloat(d.MINORINJURIES_DRIVER) || 0) +
                            (parseFloat(d.MINORINJURIES_PEDESTRIAN) || 0) +
                            (parseFloat(d.MINORINJURIES_BICYCLIST) || 0);
        if (selectInjury.value === "high" && majorInjuries === 0) return false;
        if (selectInjury.value === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (selectInjury.value === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });
    updateBarChart(chartFiltered);
  }

  // Function to update the D3 bar chart based on filtered data (ignoring the year filter)
  function updateBarChart(filteredData) {
    // Aggregate data for every year from the complete list of years
    var aggregated = allYears.map(function(year) {
      var count = filteredData.filter(function(d) { return d.year === year; }).length;
      return { year: +year, count: count };
    });
    aggregated.sort(function(a, b) { return a.year - b.year; });
    var margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = 500 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;
    d3.select("#barChart").remove();
    var svg = d3.select("#controls")
      .append("svg")
      .attr("id", "barChart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var x = d3.scaleBand()
      .domain(aggregated.map(function(d) { return d.year; }))
      .range([0, width])
      .padding(0.1);
    var y = d3.scaleLinear()
      .domain([0, d3.max(aggregated, function(d) { return d.count; })]).nice()
      .range([height, 0]);
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g")
      .call(d3.axisLeft(y));
    svg.selectAll(".bar")
      .data(aggregated)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.year); })
      .attr("y", function(d) { return y(d.count); })
      .attr("width", x.bandwidth())
      .attr("height", function(d) { return height - y(d.count); })
      .attr("fill", "steelblue");
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Crash Count by Year");
  }

  // Listen for changes on each filter control to update the map and chart
  [selectYear, selectWard, checkboxFatalities, checkboxPedestrians, checkboxBicyclists, selectInjury].forEach(function(control) {
    control.addEventListener("change", updateMap);
  });
});
