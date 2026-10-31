const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;
const SAMPLE_INTERVAL_MS = 2 * 60 * 1000;
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEMO_HISTORY_MS = 6 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const readings = [];
const alarm = {
    active: false,
    buzzerMuted: false
};

function makeReading(date) {
    const time = date.getTime();
    const temperature =
        33 +
        7.5 * Math.sin(time / (45 * 60 * 1000)) +
        0.4 * Math.sin(time / (7 * 60 * 1000));
    const humidity =
        55 +
        14 * Math.sin(time / (70 * 60 * 1000) + 1.4) +
        2 * Math.sin(time / (13 * 60 * 1000));

    return {
        temperature: Number(temperature.toFixed(1)),
        humidity: Number(Math.max(20, Math.min(90, humidity)).toFixed(1)),
        timestamp: date.toISOString(),
        location: "Demo location"
    };
}

function updateAlarm(temperature) {
    if (temperature >= 40) {
        alarm.active = true;
    } else if (temperature <= 35) {
        alarm.active = false;
        alarm.buzzerMuted = false;
    }
}

function getAlarmState() {
    return {
        active: alarm.active,
        ledOn: alarm.active,
        buzzerOn: alarm.active && !alarm.buzzerMuted,
        buzzerMuted: alarm.buzzerMuted
    };
}

function recordReading(date = new Date()) {
    const reading = makeReading(date);
    readings.push(reading);
    updateAlarm(reading.temperature);

    const cutoff = date.getTime() - HISTORY_RETENTION_MS;
    while (readings.length && Date.parse(readings[0].timestamp) < cutoff) {
        readings.shift();
    }
}

const seedStart = Date.now() - DEMO_HISTORY_MS;
for (let time = seedStart; time <= Date.now(); time += SAMPLE_INTERVAL_MS) {
    recordReading(new Date(time));
}
if (Date.now() - Date.parse(readings[readings.length - 1].timestamp) > SAMPLE_INTERVAL_MS / 2) {
    recordReading();
}

setInterval(recordReading, SAMPLE_INTERVAL_MS);

app.get("/api/sensor", (req, res) => {
    res.json({
        ...readings[readings.length - 1],
        alarm: getAlarmState(),
        source: "simulation"
    });
});

app.get("/api/history", (req, res) => {
    const from = req.query.from ? Date.parse(req.query.from) : Date.now() - 24 * 60 * 60 * 1000;
    const to = req.query.to ? Date.parse(req.query.to) : Date.now();

    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return res.status(400).json({ error: "The start and end dates must be valid." });
    }
    if (from > to) {
        return res.status(400).json({ error: "The start date must be before the end date." });
    }

    const results = readings.filter((reading) => {
        const timestamp = Date.parse(reading.timestamp);
        return timestamp >= from && timestamp <= to;
    });

    res.json({
        readings: results,
        retentionHours: HISTORY_RETENTION_MS / (60 * 60 * 1000)
    });
});

app.post("/api/buzzer/mute", (req, res) => {
    if (alarm.active) {
        alarm.buzzerMuted = true;
    }

    res.json({ alarm: getAlarmState() });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
