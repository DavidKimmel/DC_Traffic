# DC Traffic Crash Dashboard

An interactive web application that enables transportation planners to explore, filter, and analyze traffic crash data for Washington, D.C. through a dynamic map interface and D3 charts.

## 🗺️ Overview
The DC Traffic Crash Dashboard provides:

- **Leaflet Map** with clustered crash points and detailed popups
- **Interactive Filters** for Year, Ward, Injury Severity, Fatalities, Pedestrian, and Bicyclist involvement
- **D3 Visualizations**
  - Donut chart for crash severity distribution
  - Bar chart for crash trends over years
- **Export Functionality** to download filtered data as an Excel (.xlsx) file
- **Responsive Layout** using Bootstrap and Flexbox for consistent appearance across devices

## 🎯 Features
- **Spatial Exploration**: Click clusters to zoom into individual incidents and view detailed attributes.
- **Multi-Criteria Filtering**: Combine filters to focus on specific years, neighborhoods, or crash severities.
- **Trend Analysis**: Instantly update charts to reveal temporal patterns and severity distributions.
- **Export Data**: Generate a downloadable Excel file of the current filtered dataset for reporting.

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge)
- A local web server (e.g., [VS Code Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer))

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-username>/dc-crash-dashboard.git
   cd dc-crash-dashboard
   ```
2. **Serve the files**

   - Using Live Server in VS Code: Right-click `index.html` → "Open with Live Server"
   - Or with Python HTTP server:
     ```bash
     python3 -m http.server 8000
     open http://localhost:8000
     ```

### Project Structure
```
├── index.html           # Main HTML file
├── css/
│   └── style.css        # Custom styles
├── js/
│   └── main.js          # Map & chart logic, filters, export
├── data/
│   ├── crash.csv        # Raw crash data (CSV)
│   └── wards.geojson    # Ward polygons (GeoJSON)
├── img/
│   └── crash.png        # Custom map marker icon
└── README.md            # Project documentation
```

## 🔧 Usage
1. **Open the dashboard** in your browser.
2. **Use the filter controls** on the right to select:
   - Year (e.g., 2025)
   - Ward (e.g., Ward 7)
   - Injury severity (All, High, Low, None)
   - Toggle Fatalities, Pedestrian, and Bicyclist involvement
3. **Interact with the map**:
   - Click on clusters to zoom in and view popups.
   - Click individual markers for detailed crash attributes.
4. **Analyze trends**:
   - Donut chart updates to show severity distribution.
   - Bar chart displays crash counts by year, shaded by count intensity.
5. **Export your filtered dataset** by clicking the **Export Data** button—an `.xlsx` file will be downloaded.

## 📈 Use Case Example
Transportation Planner Gabe Rivera investigating crash hotspots:
1. Selects **2025**, **Ward 7**, and toggles **Fatalities** + **Pedestrian** filters.
2. Map and charts update to highlight critical incidents and rising fatality trends.
3. Exports data for an in-depth safety report to senior management.

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request with your improvements.

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

