document.addEventListener('DOMContentLoaded', function () {
  // Initialize the Leaflet map centered on Washington, DC at zoom 12
  var initialCenter = [38.9072, -77.0369];
  var initialZoom = 12;
  var map = L.map('map').setView(initialCenter, initialZoom);

  // Save the original view for resetting
  var originalCenter = initialCenter;
  var originalZoom = initialZoom;
  
  // Crash Icon
  var crashIcon = L.icon({
    iconUrl: 'img/crash.png',  // update the path as needed
    iconSize: [40, 50],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  
  // Create custom panes for layering
  map.createPane('polygonsPane');
  map.getPane('polygonsPane').style.zIndex = 320;
  map.createPane('markersPane');
  map.getPane('markersPane').style.zIndex = 650;
  
  var csvData = [];
  var markersCluster;
  var allYears = [];
  
  // Render filter controls into the existing #filters container
  var filtersDiv = document.getElementById("filters");
  filtersDiv.innerHTML = `
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
  `;
  // Create and append the Export button below the filters.
  var exportButton = document.createElement("button");
  exportButton.id = "exportDataButton";
  exportButton.innerText = "Export Data";
  exportButton.className = "btn btn-primary mt-2";  // Using Bootstrap classes for styling.
  filtersDiv.appendChild(exportButton);
  exportButton.addEventListener("click", exportData);

  
  var selectYear = document.getElementById("yearFilter");
  var selectWard = document.getElementById("wardFilter");
  var checkboxFatalities = document.getElementById("fatalityFilter");
  var checkboxPedestrians = document.getElementById("pedestrianFilter");
  var checkboxBicyclists = document.getElementById("bicyclistFilter");
  var selectInjury = document.getElementById("injuryFilter");


  function exportData() {
    // Retrieve filter values from existing controls.
    var selectedYearVal = selectYear.value;
    var selectedWardVal = selectWard.value;
    var fatalitiesOnly = checkboxFatalities.checked;
    var pedestrianOnly = checkboxPedestrians.checked;
    var bicyclistOnly = checkboxBicyclists.checked;
    var injurySeverity = selectInjury.value;
  
    // Filter the CSV data just like in updateMap.
    var filteredData = csvData.filter(function(d) {
      if (selectedYearVal && d.year !== selectedYearVal) return false;
      if (selectedWardVal && d.WARD !== selectedWardVal) return false;
      if (fatalitiesOnly) {
        var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
        if (totalFatal === 0) return false;
      }
      if (pedestrianOnly && (+d.TOTAL_PEDESTRIANS || 0) === 0) return false;
      if (bicyclistOnly && ((+d.TOTAL_PEDESTRIQUES) || (+d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (injurySeverity !== "all") {
        var majorInjuries = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
        var minorInjuries = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
        if (injurySeverity === "high" && majorInjuries === 0) return false;
        if (injurySeverity === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (injurySeverity === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });
  
    // Create a new workbook and worksheet using SheetJS.
    var wb = XLSX.utils.book_new();
    // Convert the filtered data (an array of objects) to a worksheet.
    var ws = XLSX.utils.json_to_sheet(filteredData);
    // Append the worksheet to the workbook.
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Data");
    // Trigger a download of the file.
    XLSX.writeFile(wb, "filtered_crash_data.xlsx");
  }
  
  function updateKPICards(filteredData) {
    // Compute Total Crashes from the filtered dataset.
    var totalCrashes = filteredData.length;
  
    // Compute Fatal Crashes: count records where any fatality (driver, pedestrian, or bicyclist) is greater than 0.
    var fatalCrashes = filteredData.filter(function(d) {
      var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
      return totalFatal > 0;
    }).length;
  
    // Compute Crashes with Major Injuries.
    var majorInjuryCrashes = filteredData.filter(function(d) {
      var majorCount = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
      return majorCount > 0;
    }).length;
  
    // Compute Percentage Change from Previous Year.
    var percChangeText = "N/A";
    
    if (selectYear.value) {
      // When a specific year filter is applied, compare that year against its previous year.
      var selectedYear = parseInt(selectYear.value);
      var previousYear = selectedYear - 1;
      // Compute previous year's count using csvData (apply all filter criteria except the year)
      var previousYearData = csvData.filter(function(d) {
        // Use the same filter criteria as in updateMap but for the previous year.
        if (selectWard.value && d.WARD !== selectWard.value) return false;
        if (checkboxFatalities.checked) {
          var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
          if (totalFatal === 0) return false;
        }
        if (checkboxPedestrians.checked && (+d.TOTAL_PESTRIANS || 0) === 0) return false;
        if (checkboxBicyclists.checked && ((+d.TOTAL_PESTRIQUES) || (+d.TOTAL_BICYCLES) || 0) === 0) return false;
        if (selectInjury.value !== "all") {
          var majorInjuries = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
          var minorInjuries = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
          if (selectInjury.value === "high" && majorInjuries === 0) return false;
          if (selectInjury.value === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
          if (selectInjury.value === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
        }
        return d.year === String(previousYear);
      });
      
      // current filteredData should consist of records for the selected year.
      if (previousYearData.length > 0) {
        var change = ((filteredData.length - previousYearData.length) / previousYearData.length) * 100;
        percChangeText = change.toFixed(1) + "%";
      } else {
        percChangeText = "N/A";
      }
    } else {
      // When no specific year is selected, group filteredData by year and compare the two most recent years.
      var yearCounts = {};
      filteredData.forEach(function(d) {
        var yr = d.year;
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      });
      var yearsArr = Object.keys(yearCounts).sort();
      if (yearsArr.length >= 2) {
        var lastYear = yearsArr[yearsArr.length - 1];
        var secondLastYear = yearsArr[yearsArr.length - 2];
        var change = ((yearCounts[lastYear] - yearCounts[secondLastYear]) / yearCounts[secondLastYear]) * 100;
        percChangeText = change.toFixed(1) + "%";
      }
    }
    
    // Update the KPI card elements with computed values.
    document.getElementById("totalCrashes").innerText = totalCrashes;
    document.getElementById("fatalCrashes").innerText = fatalCrashes;
    document.getElementById("majorInjuries").innerText = majorInjuryCrashes;
    document.getElementById("percChange").innerText = percChangeText;
  }
  
  

  
  d3.csv("data/crash.csv").then(function(data) {
    csvData = data;
    csvData.forEach(function(d) {
      d.year = d.DATE.substring(0, 4);
    });
    // Filter out records from 2018
    csvData = csvData.filter(function(d) { return d.year !== "2018"; });
    
    var years = new Set(csvData.map(function(d) { return d.year; }));
    allYears = Array.from(years).sort();
    allYears.forEach(function(year) {
      var option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      selectYear.appendChild(option);
    });
    
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
    
    // Optionally set a default year 
    if (years.has("2025")) { selectYear.value = "2025"; }
    updateMap();
  }).catch(function(error) {
    console.error("Error loading CSV data:", error);
  });
  
  d3.json("data/wards.geojson").then(function(wardsData) {
    L.geoJSON(wardsData, {
      pane: 'polygonsPane',
      style: function(feature) {
        return {
          color: "blue",
          weight: 2,
          fill: false,
          fillOpacity: 0
        };
      }
    }).addTo(map);
  }).catch(function(error) {
    console.error("Error loading ward polygons:", error);
  });
  
  var ResetControl = L.Control.extend({
    options: { position: 'topright' },
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
  
  function updateMap() {
    if (markersCluster) { map.removeLayer(markersCluster); }
    
    var selectedYearVal = selectYear.value;
    var selectedWardVal = selectWard.value;
    var fatalitiesOnly = checkboxFatalities.checked;
    var pedestrianOnly = checkboxPedestrians.checked;
    var bicyclistOnly = checkboxBicyclists.checked;
    var injurySeverity = selectInjury.value;
    
    // Filter for the map (includes year filter)
    var filteredMapData = csvData.filter(function(d) {
      if (selectedYearVal && d.year !== selectedYearVal) return false;
      if (selectedWardVal && d.WARD !== selectedWardVal) return false;
      if (fatalitiesOnly) {
        var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
        if (totalFatal === 0) return false;
      }
      if (pedestrianOnly && (+d.TOTAL_PEDESTRIANS || 0) === 0) return false;
      if (bicyclistOnly && ((+d.TOTAL_PEDESTRIQUES) || (+d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (injurySeverity !== "all") {
        var majorInjuries = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
        var minorInjuries = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
        if (injurySeverity === "high" && majorInjuries === 0) return false;
        if (injurySeverity === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (injurySeverity === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });
    
    var features = filteredMapData.map(function(d) {
      var lat = +d.LATITUDE, lng = +d.LONGITUDE;
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          "type": "Feature",
          "properties": d,
          "geometry": { "type": "Point", "coordinates": [lng, lat] }
        };
      }
    }).filter(function(f) { return f !== undefined; });
    
    var geojsonData = { "type": "FeatureCollection", "features": features };
    
    markersCluster = L.markerClusterGroup({ pane: 'markersPane', showCoverageOnHover: false });
    
    var geojsonLayer = L.geoJSON(geojsonData, {
      pointToLayer: function(feature, latlng) {
        return L.marker(latlng, { icon: crashIcon });
      },
      onEachFeature: function(feature, layer) {
        var props = feature.properties, popupLines = [];
        if (props.LATITUDE && props.LATITUDE.trim() !== "") { popupLines.push("<strong>LATITUDE:</strong> " + props.LATITUDE); }
        if (props.LONGITUDE && props.LONGITUDE.trim() !== "") { popupLines.push("<strong>LONGITUDE:</strong> " + props.LONGITUDE); }
        if (props.DATE && props.DATE.trim() !== "") { popupLines.push("<strong>DATE:</strong> " + props.DATE); }
        if (props.ADDRESS && props.ADDRESS.trim() !== "") { popupLines.push("<strong>ADDRESS:</strong> " + props.ADDRESS); }
        if (props.WARD && props.WARD.trim() !== "") { popupLines.push("<strong>WARD:</strong> " + props.WARD); }
        var skipFields = ["LATITUDE", "LONGITUDE", "DATE", "ADDRESS", "WARD", "XCOORD", "YCOORD"];
        for (var key in props) {
          if (skipFields.indexOf(key) === -1) {
            var value = props[key];
            if (!isNaN(+value) && +value !== 0) {
              popupLines.push("<strong>" + key + ":</strong> " + value);
            }
          }
        }
        var popupContent = "<h4>Crash Details</h4>" + popupLines.join("<br/>");
        layer.bindPopup(popupContent);
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          map.setView(e.latlng, 18);
          layer.openPopup();
        });
      }
    });
    markersCluster.addLayer(geojsonLayer);
    map.addLayer(markersCluster);
    
    // Create separate filtered datasets for the charts:
    // For the donut chart, we apply the year filter so it shows breakdown for the selected year (if any)
    var chartFilteredForDonut = csvData.filter(function(d) {
      if (selectYear.value && d.year !== selectYear.value) return false;
      if (selectWard.value && d.WARD !== selectWard.value) return false;
      if (checkboxFatalities.checked) {
        var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
        if (totalFatal === 0) return false;
      }
      if (checkboxPedestrians.checked && (+d.TOTAL_PEDESTRIANS || 0) === 0) return false;
      if (checkboxBicyclists.checked && ((+d.TOTAL_PEDESTRIQUES) || (+d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (selectInjury.value !== "all") {
        var majorInjuries = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
        var minorInjuries = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
        if (selectInjury.value === "high" && majorInjuries === 0) return false;
        if (selectInjury.value === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (selectInjury.value === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });
    
    // For the bar chart, we ignore the year filter so it shows trends across all years
    var chartFilteredForBar = csvData.filter(function(d) {
      if (selectWard.value && d.WARD !== selectWard.value) return false;
      if (checkboxFatalities.checked) {
        var totalFatal = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
        if (totalFatal === 0) return false;
      }
      if (checkboxPedestrians.checked && (+d.TOTAL_PEDESTRIANS || 0) === 0) return false;
      if (checkboxBicyclists.checked && ((+d.TOTAL_PEDESTRIQUES) || (+d.TOTAL_BICYCLES) || 0) === 0) return false;
      if (selectInjury.value !== "all") {
        var majorInjuries = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
        var minorInjuries = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
        if (selectInjury.value === "high" && majorInjuries === 0) return false;
        if (selectInjury.value === "low" && (majorInjuries > 0 || minorInjuries === 0)) return false;
        if (selectInjury.value === "none" && (majorInjuries > 0 || minorInjuries > 0)) return false;
      }
      return true;
    });
    
    updateDonutChart(chartFilteredForDonut);
    updateBarChart(chartFilteredForBar);
    updateKPICards(chartFilteredForDonut);
  }
  
  function updateDonutChart(filteredData) {
    // Compute severity counts.
    var severityCounts = { "Fatal": 0, "Major": 0, "Minor": 0, "None": 0 };
    filteredData.forEach(function(d) {
      var fatalCount = (+d.FATAL_DRIVER || 0) + (+d.FATAL_PEDESTRIAN || 0) + (+d.FATAL_BICYCLIST || 0);
      var majorCount = (+d.MAJORINJURIES_DRIVER || 0) + (+d.MAJORINJURIES_PEDESTRIAN || 0) + (+d.MAJORINJURIES_BICYCLIST || 0);
      var minorCount = (+d.MINORINJURIES_DRIVER || 0) + (+d.MINORINJURIES_PEDESTRIAN || 0) + (+d.MINORINJURIES_BICYCLIST || 0);
      if (fatalCount > 0) { severityCounts["Fatal"] += 1; }
      else if (majorCount > 0) { severityCounts["Major"] += 1; }
      else if (minorCount > 0) { severityCounts["Minor"] += 1; }
      else { severityCounts["None"] += 1; }
    });
  
    var data = Object.keys(severityCounts).map(function(key) {
      return { category: key, count: severityCounts[key] };
    });
  
    // Fixed dimensions: use a fixed height (e.g., 300px) so it matches the bar chart.
    var container = document.getElementById("donutChart");
    var containerWidth = container.clientWidth;
    var height = 300; // fixed height
    var topExtra = 30; // reserve space for title
    var width = containerWidth; // full container width
    var radius = Math.min(width, height - topExtra) / 2; // effective donut radius
  
    // Remove any previous svg.
    d3.select("#donutChart").select("svg").remove();
  
    // Create the svg element.
    var svg = d3.select("#donutChart")
                .append("svg")
                .attr("width", "100%")
                .attr("height", height)
                .attr("viewBox", "0 0 " + width + " " + height)
                .append("g")
                // Position the donut in the center, shifting vertically to account for the title.
                .attr("transform", "translate(" + width / 2 + "," + ((height - topExtra) / 2 + topExtra) + ")");
  
    // Color scale remains as before.
    var color = d3.scaleOrdinal()
                  .domain(["Fatal", "Major", "Minor", "None"])
                  .range(["#d73027", "#fc8d59", "#fee08b", "#91bfdb"]);
  
    // Pie layout.
    var pie = d3.pie()
                .sort(null)
                .value(function(d) { return d.count; });
  
    // Adjust the arc so the donut fills more of the space.
    var arc = d3.arc()
                .innerRadius(radius * 0.5)
                .outerRadius(radius * 0.8);
  
    // Append the donut arcs.
    var path = svg.selectAll("path")
                  .data(pie(data))
                  .enter()
                  .append("path")
                  .attr("d", arc)
                  .attr("fill", function(d) { return color(d.data.category); })
                  .each(function(d) { this._current = d; });
  
    // Setup tooltip.
    var tooltip = d3.select("body").select(".donut-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
                  .attr("class", "donut-tooltip");
    }
    path.on("mouseover", function(event, d) {
           d3.select(this).transition().duration(200)
             .attr("d", d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.85));
           tooltip.transition().duration(200).style("opacity", 0.9);
           tooltip.html("Severity: " + d.data.category + "<br/>Total crashes: " + d.data.count)
                  .style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 28) + "px");
         })
         .on("mousemove", function(event, d) {
           tooltip.style("left", (event.pageX + 10) + "px")
                  .style("top", (event.pageY - 28) + "px");
         })
         .on("mouseout", function(event, d) {
           d3.select(this).transition().duration(200)
             .attr("d", arc);
           tooltip.transition().duration(500).style("opacity", 0);
         });
  
    // Append chart title above the donut.
    var chartTitle = "Crash Severity Distribution";
    if (selectYear.value) {
      chartTitle += " for " + selectYear.value;
    }
    svg.append("text")
       .attr("x", 0)
       .attr("y", -radius - 10)  // place title just above the donut
       .attr("fill", "#333")
       .attr("text-anchor", "middle")
       .style("font-size", "16px")
       .text(chartTitle);
  }
    
  
// Update the bar chart based on filtered data.
function updateBarChart(filteredData) {
  var containerWidth = document.getElementById("barChart").clientWidth;
  var margin = { top: 20, right: 20, bottom: 40, left: 50 },
      width = containerWidth - margin.left - margin.right,
      height = 300 - margin.top - margin.bottom;

  // Remove any previous svg element
  d3.select("#barChart").select("svg").remove();

  // Create svg element in the bar chart container
  var svg = d3.select("#barChart")
              .append("svg")
              .attr("width", "100%")
              .attr("height", height + margin.top + margin.bottom)
              .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
              .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Aggregate crash counts per year.
  var aggregated = allYears.map(function(year) {
    var count = filteredData.filter(function(d) { return d.year === year; }).length;
    return { year: +year, count: count };
  });
  aggregated.sort(function(a, b) { return a.year - b.year; });

  // X-scale for years.
  var x = d3.scaleBand()
            .domain(aggregated.map(function(d) { return d.year; }))
            .range([0, width])
            .padding(0.1);

  // Y-scale for crash counts.
  var y = d3.scaleLinear()
            .domain([0, d3.max(aggregated, function(d) { return d.count; })]).nice()
            .range([height, 0]);

  // Create a linear color scale for the bars.
  // Lower counts map to a light bluish-gray, higher counts to a deep blue.
  var countExtent = d3.extent(aggregated, function(d) { return d.count; });
  var colorCount = d3.scaleLinear()
                     .domain(countExtent)  // [minCount, maxCount]
                     .range(["#bdc3c7", "#2c3e50"]);

  // Render the X-axis.
  svg.append("g")
     .attr("transform", "translate(0," + height + ")")
     .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  // X-axis label.
  svg.append("text")
     .attr("x", width / 2)
     .attr("y", height + margin.bottom - 5)
     .attr("text-anchor", "middle")
     .attr("fill", "#000")
     .style("font-size", "12px")
     .text("Year");

  // Render the Y-axis.
  svg.append("g")
     .call(d3.axisLeft(y));

  // Create (or update) the tooltip for the bar chart.
  var barTooltip = d3.select("body").select(".bar-tooltip");
  if (barTooltip.empty()) {
    barTooltip = d3.select("body").append("div")
                   .attr("class", "bar-tooltip");
  }

  // Append the bars using the aggregated data.
  var bars = svg.selectAll(".bar")
                .data(aggregated)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) { return x(d.year); })
                .attr("y", function(d) { return y(d.count); })
                .attr("width", x.bandwidth())
                .attr("height", function(d) { return height - y(d.count); })
                .attr("fill", function(d) { return colorCount(d.count); })
                // Adding rounded corners for a smoother look:
                .attr("rx", 3)
                // Mouseover to brighten the color slightly
                .on("mouseover", function(event, d) {
                  d3.select(this)
                    .transition().duration(200)
                    .attr("fill", d3.rgb(colorCount(d.count)).brighter(0.5));
                  barTooltip.transition().duration(200).style("opacity", 0.9);
                  barTooltip.html("Total crashes: " + d.count)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                })
                .on("mousemove", function(event, d) {
                  barTooltip.style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function(event, d) {
                  d3.select(this)
                    .transition().duration(200)
                    .attr("fill", colorCount(d.count));
                  barTooltip.transition().duration(500).style("opacity", 0);
                });

  // Add chart title.
  svg.append("text")
     .attr("x", width / 2)
     .attr("y", -5)
     .attr("text-anchor", "middle")
     .style("font-size", "14px")
     .text("Crash Count by Year");
}


  
  [selectYear, selectWard, checkboxFatalities, checkboxPedestrians, checkboxBicyclists, selectInjury]
    .forEach(function(control) {
      control.addEventListener("change", updateMap);
  });
});
