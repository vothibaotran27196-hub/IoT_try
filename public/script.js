async function getSensorData() {
    try {
        const response = await fetch("/api/sensor");
        if (!response.ok) {
            throw new Error(`Sensor request failed: ${response.status}`);
        }

        const data = await response.json();

        document.getElementById("temperature").textContent =
            data.temperature;

        document.getElementById("humidity").textContent =
            data.humidity;

        document.getElementById("time").textContent =
            data.timestamp;

        document.getElementById("location").textContent =
            data.location;

        console.log("Sensor data:", data);

    } catch (error) {
        console.error("Error loading sensor data:", error);
    }
}


getSensorData();

// Refresh the simulated sensor reading every 5 minutes.
setInterval(getSensorData, 5 * 60 * 1000);