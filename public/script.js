const POLL_INTERVAL_MS = 10 * 1000;
const elements = {
    temperature: document.getElementById("temperature"),
    humidity: document.getElementById("humidity"),
    time: document.getElementById("time"),
    location: document.getElementById("location"),
    footerLocation: document.getElementById("footer-location"),
    error: document.getElementById("error-message"),
    rangeForm: document.getElementById("range-form"),
    rangeFrom: document.getElementById("range-from"),
    rangeTo: document.getElementById("range-to"),
    chart: document.getElementById("history-chart"),
    chartEmpty: document.getElementById("chart-empty"),
    ledIndicator: document.getElementById("led-indicator"),
    ledStatus: document.getElementById("led-status"),
    buzzerIndicator: document.getElementById("buzzer-indicator"),
    buzzerStatus: document.getElementById("buzzer-status"),
    alarmMessage: document.getElementById("alarm-message"),
    muteButton: document.getElementById("mute-button")
};

let chartReadings = [];
let chartRange = { from: new Date(), to: new Date() };

function toLocalInputValue(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
}

function clearError() {
    elements.error.textContent = "";
    elements.error.hidden = true;
}

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
}

function updateAlarm(alarm) {
    const ledOn = Boolean(alarm.ledOn);
    const buzzerOn = Boolean(alarm.buzzerOn);

    elements.ledIndicator.classList.toggle("is-on", ledOn);
    elements.ledStatus.textContent = ledOn ? "On" : "Off";
    elements.buzzerIndicator.classList.toggle("is-on", buzzerOn);
    elements.buzzerStatus.textContent = buzzerOn
        ? "On"
        : alarm.buzzerMuted
            ? "Silenced"
            : "Off";
    elements.muteButton.disabled = !buzzerOn;

    if (alarm.active && alarm.buzzerMuted) {
        elements.alarmMessage.textContent = "High temperature alert — buzzer silenced; LED remains on.";
    } else if (alarm.active) {
        elements.alarmMessage.textContent = "High temperature alert — LED and buzzer are on.";
    } else {
        elements.alarmMessage.textContent = "Normal — alarm activates at 40°C and resets at 35°C.";
    }
}

async function loadSensorData() {
    const data = await requestJson("/api/sensor");
    elements.temperature.textContent = Number(data.temperature).toFixed(1);
    elements.humidity.textContent = Number(data.humidity).toFixed(1);
    elements.time.textContent = new Date(data.timestamp).toLocaleString();
    elements.location.textContent = data.location;
    elements.footerLocation.textContent = data.location;
    updateAlarm(data.alarm);
}

function formatTick(date, rangeMs) {
    if (rangeMs <= 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function drawChart() {
    const canvas = elements.chart;
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    if (!chartReadings.length) {
        elements.chartEmpty.hidden = false;
        return;
    }
    elements.chartEmpty.hidden = true;

    const width = bounds.width;
    const height = bounds.height;
    const plot = { left: 44, right: width - 43, top: 16, bottom: height - 31 };
    const plotWidth = plot.right - plot.left;
    const plotHeight = plot.bottom - plot.top;
    const requestedFrom = chartRange.from.getTime();
    const requestedTo = chartRange.to.getTime();
    const start = requestedFrom === requestedTo ? requestedFrom - 60_000 : requestedFrom;
    const end = requestedFrom === requestedTo ? requestedTo + 60_000 : requestedTo;
    const rangeMs = end - start;
    const temperatureMin = 15;
    const temperatureMax = 45;
    const humidityMin = 0;
    const humidityMax = 100;
    const colors = {
        grid: "#edf0f5",
        text: "#8591a3",
        temperature: "#e8903b",
        humidity: "#4778e8"
    };

    context.font = "10px system-ui, sans-serif";
    context.lineWidth = 1;
    context.textBaseline = "middle";

    for (let tick = 0; tick <= 4; tick += 1) {
        const ratio = tick / 4;
        const y = plot.bottom - ratio * plotHeight;
        const temperatureValue = Math.round(temperatureMin + ratio * (temperatureMax - temperatureMin));
        const humidityValue = Math.round(humidityMin + ratio * (humidityMax - humidityMin));

        context.strokeStyle = colors.grid;
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
        context.stroke();

        context.fillStyle = colors.temperature;
        context.textAlign = "right";
        context.fillText(`${temperatureValue}°`, plot.left - 7, y);
        context.fillStyle = colors.humidity;
        context.textAlign = "left";
        context.fillText(`${humidityValue}%`, plot.right + 7, y);
    }

    for (let tick = 0; tick <= 4; tick += 1) {
        const ratio = tick / 4;
        const x = plot.left + ratio * plotWidth;
        const date = new Date(start + ratio * rangeMs);
        context.fillStyle = colors.text;
        context.textAlign = tick === 0 ? "left" : tick === 4 ? "right" : "center";
        context.fillText(formatTick(date, rangeMs), x, plot.bottom + 17);
    }

    function drawSeries(field, min, max, color) {
        const points = chartReadings
            .map((reading) => ({
                x: plot.left + ((Date.parse(reading.timestamp) - start) / rangeMs) * plotWidth,
                y: plot.bottom - ((reading[field] - min) / (max - min)) * plotHeight
            }))
            .filter((point) => point.x >= plot.left && point.x <= plot.right);

        if (!points.length) return;

        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2.5;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.beginPath();
        points.forEach((point, index) => {
            if (index === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
        });
        context.stroke();

        if (points.length === 1) {
            context.beginPath();
            context.arc(points[0].x, points[0].y, 3.5, 0, Math.PI * 2);
            context.fill();
        }
    }

    drawSeries("temperature", temperatureMin, temperatureMax, colors.temperature);
    drawSeries("humidity", humidityMin, humidityMax, colors.humidity);
}

async function loadHistory() {
    const from = new Date(elements.rangeFrom.value);
    const to = new Date(elements.rangeTo.value);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
        throw new Error("Choose a valid start and end date.");
    }
    if (from > to) {
        throw new Error("The start date must be before the end date.");
    }

    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString()
    });
    const data = await requestJson(`/api/history?${params}`);
    chartRange = { from, to };
    chartReadings = data.readings;
    drawChart();
}

async function refreshDashboard() {
    try {
        await loadSensorData();
        clearError();
    } catch (error) {
        console.error("Error loading sensor data:", error);
        showError(`Could not load sensor data: ${error.message}`);
    }
}

elements.rangeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await loadHistory();
        clearError();
    } catch (error) {
        showError(`Could not load graph: ${error.message}`);
    }
});

elements.muteButton.addEventListener("click", async () => {
    elements.muteButton.disabled = true;
    try {
        const data = await requestJson("/api/buzzer/mute", { method: "POST" });
        updateAlarm(data.alarm);
        clearError();
    } catch (error) {
        console.error("Error silencing buzzer:", error);
        showError(`Could not silence the buzzer: ${error.message}`);
        await refreshDashboard();
    }
});

window.addEventListener("resize", drawChart);

const initialTo = new Date();
const initialFrom = new Date(initialTo.getTime() - 6 * 60 * 60 * 1000);
elements.rangeFrom.value = toLocalInputValue(initialFrom);
elements.rangeTo.value = toLocalInputValue(initialTo);

Promise.all([refreshDashboard(), loadHistory()])
    .catch((error) => {
        showError(`Could not load graph: ${error.message}`);
    });

setInterval(refreshDashboard, POLL_INTERVAL_MS);
setInterval(() => {
    loadHistory().catch((error) => {
        console.error("Error refreshing graph:", error);
        showError(`Could not refresh graph: ${error.message}`);
    });
}, 2 * 60 * 1000);
