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
  
  var selectYear = document.getElementById("yearFilter");
  var selectWard = document.getElementById("wardFilter");
  var checkboxFatalities = document.getElementById("fatalityFilter");
  var checkboxPedestrians = document.getElementById("pedestrianFilter");
  var checkboxBicyclists = document.getElementById("bicyclistFilter");
  var selectInjury = document.getElementById("injuryFilter");
  
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
    
    // Optionally set a default year (if desired)
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
  }
  
  // Update the donut chart based on filtered data.
  function updateDonutChart(filteredData) {
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
  
    var containerWidth = document.getElementById("donutChart").clientWidth;
    var width = containerWidth, height = 300, radius = Math.min(width, height) / 2;
    var topExtra = 50; // extra space at the top for the title
  
    // Remove any previous svg
    d3.select("#donutChart").select("svg").remove();
  
    // Create an svg with extra height on top and adjust the viewBox accordingly
    var svg = d3.select("#donutChart")
                .append("svg")
                .attr("width", "100%")
                .attr("height", height + topExtra)
                .attr("viewBox", "0 0 " + width + " " + (height + topExtra))
                // Translate group down by half of topExtra to leave room for title
                .append("g")
                .attr("transform", "translate(" + (width/2) + "," + (height/2 + topExtra/2) + ")");
  
    var color = d3.scaleOrdinal()
                  .domain(["Fatal", "Major", "Minor", "None"])
                  .range(["#d73027", "#fc8d59", "#fee08b", "#91bfdb"]);
  
    var pie = d3.pie()
                .sort(null)
                .value(function(d) { return d.count; });
  
    var arc = d3.arc()
                .innerRadius(radius * 0.5)
                .outerRadius(radius * 0.8);
  
    var path = svg.selectAll("path")
                  .data(pie(data))
                  .enter().append("path")
                  .attr("d", arc)
                  .attr("fill", function(d) { return color(d.data.category); })
                  .each(function(d) { this._current = d; });
  
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
        .on("mousemove", function(event, d){
          tooltip.style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
          d3.select(this).transition().duration(200).attr("d", arc);
          tooltip.transition().duration(500).style("opacity", 0);
        });
  
    // Create dynamic title based on selected year
    var chartTitle = "Crash Severity Distribution";
    if (selectYear.value) { chartTitle += " for " + selectYear.value; }
  
    // Append title at (0, -radius - offset)
    svg.append("text")
       .attr("x", 0)
       .attr("y", -radius - 20)
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
    
    d3.select("#barChart").select("svg").remove();
    
    var svg = d3.select("#barChart")
                .append("svg")
                .attr("width", "100%")
                .attr("height", height + margin.top + margin.bottom)
                .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    var aggregated = allYears.map(function(year) {
      var count = filteredData.filter(function(d) { return d.year === year; }).length;
      return { year: +year, count: count };
    });
    aggregated.sort(function(a, b) { return a.year - b.year; });
    
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
    
    svg.append("text")
       .attr("x", width / 2)
       .attr("y", height + margin.bottom - 5)
       .attr("text-anchor", "middle")
       .attr("fill", "#000")
       .style("font-size", "12px")
       .text("Year");
    
    svg.append("g")
       .call(d3.axisLeft(y));
    
    var bars = svg.selectAll(".bar")
                  .data(aggregated)
                  .enter().append("rect")
                  .attr("class", "bar")
                  .attr("x", function(d) { return x(d.year); })
                  .attr("y", function(d) { return y(d.count); })
                  .attr("width", x.bandwidth())
                  .attr("height", function(d) { return height - y(d.count); })
                  .attr("fill", "steelblue");
    
    var barTooltip = d3.select("body").select(".bar-tooltip");
    if (barTooltip.empty()) {
      barTooltip = d3.select("body").append("div")
                     .attr("class", "bar-tooltip");
    }
    
    bars.on("mouseover", function(event, d) {
            barTooltip.transition().duration(200).style("opacity", 0.9);
            barTooltip.html("Total crashes: " + d.count)
                      .style("left", (event.pageX + 10) + "px")
                      .style("top", (event.pageY - 28) + "px");
          })
          .on("mousemove", function(event, d){
            barTooltip.style("left", (event.pageX + 10) + "px")
                      .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", function(d) {
            barTooltip.transition().duration(500).style("opacity", 0);
          });
    
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
