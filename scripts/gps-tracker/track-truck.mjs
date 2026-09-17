#!/usr/bin/env node
// Fetches the live position of the Malaysia -> Singapore truck from the TDT GPS
// share link, and posts a status update into the Bitrix24 "Logistics Tracking
// Unit" workgroup chat. Also raises three alerts, and pauses monitoring once
// the day's round trip is done — see .claude/skills/track-truck/SKILL.md.
//
// Usage: node track-truck.mjs   (run from the repo root — it reads/writes
// scripts/gps-tracker/state.json next to this file and commits it back)

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "state.json");

const GPS_SHARE_TOKEN =
  process.env.GPS_SHARE_TOKEN ||
  "ZDBbswMAaZ6MIixwKTgRy7JHbw60Q1SnzFBKGLi+J2P9EliwD0zBR31SQjwuEzDkCn2HPzEIfKGyS5iclL7LuNSMZW6oSp6sJ1/Y6vR6dAA+96fGZl/EP+ZhhYQCrovQ5iWz0fOy9C9rMBIFQ36luTmT9vA40BJV";
const GPS_WS_URL = process.env.GPS_WS_URL || "wss://live.tdtgps.com:9662/";
const BITRIX_WEBHOOK =
  process.env.BITRIX_WEBHOOK ||
  "https://dyntek.bitrix24.com/rest/445/4nzkjjyoek5sz58t";
const BITRIX_CHAT_DIALOG_ID = process.env.BITRIX_CHAT_DIALOG_ID || "chat8035"; // Logistics Tracking Unit

const WS_TIMEOUT_MS = 15000;
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia/Singapore, fixed UTC+8, no DST

// SSB = "StiFlex Sdn Bhd" factory (Jalan Tahana, Kawasan Perindustrian Tampoi,
// Johor Bahru). From https://maps.app.goo.gl/3KXQNxB1nNamXtNJA
const SSB_LAT = 1.502346;
const SSB_LNG = 103.7210203;
const SSB_ADDRESS =
  "StiFlex Sdn Bhd, Jalan Tahana, Kawasan Perindustrian Tampoi, Bandar Baru Uda, 81200 Johor Bahru, Johor";
const SSB_RADIUS_M = 400; // factory compound + GPS drift

const SAME_LOCATION_RADIUS_M = 150;
const SAME_LOCATION_ALERT_MS = 60 * 60 * 1000; // 1 hour
const PARKED_MIN_SECONDS = 15 * 60; // require 15+ min parked before calling a return "done"

function nowMYT() {
  // Read UTC getters on a shifted timestamp to get MYT wall-clock fields
  // without needing a timezone DB (MYT has no DST, fixed +8).
  return new Date(Date.now() + MYT_OFFSET_MS);
}

function mytDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseDurationToSeconds(hhmmss) {
  if (!hhmmss || typeof hhmmss !== "string") return 0;
  const parts = hhmmss.split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function defaultState(dateStr) {
  return {
    date: dateStr,
    lastLat: null,
    lastLng: null,
    sameLocationSince: null,
    sameLocationAlerted: false,
    ssbAlerted: false,
    wasInSingaporeToday: false,
    monitoringDone: false,
  };
}

function loadState(dateStr) {
  if (!existsSync(STATE_PATH)) return defaultState(dateStr);
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    if (parsed.date !== dateStr) return defaultState(dateStr); // new day, fresh state
    return parsed;
  } catch {
    return defaultState(dateStr);
  }
}

function saveAndPushState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
  const repoRoot = path.resolve(__dirname, "..", "..");
  const relPath = path.relative(repoRoot, STATE_PATH);
  const git = (args) => execFileSync("git", args, { cwd: repoRoot, stdio: "pipe" });
  git(["add", relPath]);
  try {
    git(["diff", "--cached", "--quiet", "--", relPath]);
    return; // exit code 0 means nothing actually changed - nothing to commit
  } catch {
    // non-zero exit means there ARE staged changes - fall through and commit them
  }
  try {
    git([
      "-c",
      "user.name=Claude Stiflex",
      "-c",
      "user.email=stiflex.claude@fusioneta.com",
      "commit",
      "-m",
      `Update GPS tracker state (${state.date})`,
    ]);
    const branch = execFileSync("git", ["branch", "--show-current"], { cwd: repoRoot })
      .toString()
      .trim();
    git(["pull", "--rebase", "--autostash", "origin", branch]);
    git(["push", "origin", branch]);
  } catch (e) {
    console.error("Warning: failed to commit/push tracker state:", e.message);
  }
}

function fetchTruckLocation() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GPS_WS_URL);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out waiting for GPS data (15s)"));
    }, WS_TIMEOUT_MS);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "share_location", data: GPS_SHARE_TOKEN }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "share_location") {
        clearTimeout(timer);
        ws.close();
        try {
          // Payload is a JSON string containing a JSON string containing an array.
          const rows = JSON.parse(JSON.parse(msg.data));
          resolve(rows[0]);
        } catch (e) {
          reject(new Error("Failed to parse GPS payload: " + e.message));
        }
      } else if (
        msg.type === "share_location_error" ||
        msg.type === "share_expire" ||
        msg.type === "exception"
      ) {
        clearTimeout(timer);
        ws.close();
        reject(new Error("GPS share error (" + msg.type + "): " + (msg.data || "unknown")));
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection error"));
    };
  });
}

function formatLocationMessage(row) {
  const ignition = row.acc === "ON" ? "Engine ON" : "Engine OFF";
  const speed = `${Number(row.speed).toFixed(0)} km/h`;
  const lines = [
    `🚚 ${row.Alias || row.deviceName} — location update`,
    `📍 ${row.location || "Unknown location"}`,
    `🚦 ${ignition} · ${speed}`,
    `🕐 ${row.gpsDateTime} (device local time)`,
  ];
  if (row.acc !== "ON" && row.parkingDuration) {
    lines.push(`⏸ Parked for ${row.parkingDuration}`);
  }
  return lines.join("\n");
}

async function postToBitrix(message) {
  const res = await fetch(`${BITRIX_WEBHOOK}/im.message.add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ DIALOG_ID: BITRIX_CHAT_DIALOG_ID, MESSAGE: message }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(`Bitrix24 im.message.add failed: ${body.error_description || body.error}`);
  }
  return body.result;
}

async function main() {
  const today = nowMYT();
  const dateStr = mytDateStr(today);
  const weekday = today.getUTCDay(); // reading UTC getters on the shifted "now" = MYT wall-clock fields

  if (weekday === 0) {
    console.log("Sunday in Malaysia/Singapore time — no monitoring today, skipping quietly.");
    return;
  }

  const state = loadState(dateStr);

  if (state.monitoringDone) {
    console.log(
      `Truck already returned to Malaysia today (${dateStr}) — monitoring paused until tomorrow 7am.`
    );
    return;
  }

  let row;
  try {
    row = await fetchTruckLocation();
  } catch (err) {
    console.error("track-truck failed:", err.message);
    try {
      await postToBitrix(
        `🔔 ALERT: Truck GPS tracking failed to fetch a location update\n${err.message}\nThe share link may have expired and need renewing.`
      );
    } catch (postErr) {
      console.error("Also failed to post the failure notice to Bitrix24:", postErr.message);
    }
    process.exitCode = 1;
    return;
  }

  // 1) Normal hourly location update.
  await postToBitrix(formatLocationMessage(row));
  console.log("Posted truck location update for " + (row.Alias || row.deviceName));

  const alias = row.Alias || row.deviceName || "Truck";
  const nowMs = Date.now();

  // 2) Same-location-for-over-1-hour alert.
  const movedFromLast =
    state.lastLat == null ||
    haversineMeters(state.lastLat, state.lastLng, row.Latitude, row.Longitude) >
      SAME_LOCATION_RADIUS_M;

  if (movedFromLast) {
    state.lastLat = row.Latitude;
    state.lastLng = row.Longitude;
    state.sameLocationSince = row.gpsDateTime;
    state.sameLocationAlerted = false;
  } else if (state.sameLocationSince && !state.sameLocationAlerted) {
    const since = new Date(state.sameLocationSince.replace(" ", "T") + "+08:00").getTime();
    if (!Number.isNaN(since) && nowMs - since >= SAME_LOCATION_ALERT_MS) {
      await postToBitrix(
        `🔔 ALERT: ${alias} -> 1hrs Same location\n📍 ${row.location || "Unknown location"}`
      );
      state.sameLocationAlerted = true;
      console.log("Posted same-location (>1hr) alert.");
    }
  }

  // 3) Still-at-SSB-by-0800 alert.
  const hour = today.getUTCHours();
  const distToSSB = haversineMeters(row.Latitude, row.Longitude, SSB_LAT, SSB_LNG);
  const atSSB = distToSSB <= SSB_RADIUS_M;
  if (hour >= 8 && atSSB && !state.ssbAlerted) {
    await postToBitrix(
      `🔔 ALERT: Truck still in SSB (StiFlex factory) as of ${String(hour).padStart(2, "0")}:00\n📍 ${SSB_ADDRESS}`
    );
    state.ssbAlerted = true;
    console.log("Posted still-at-SSB alert.");
  }

  // 4) Singapore/Malaysia return tracking, to know when to pause for the day.
  const inSingapore = /singapore/i.test(row.location || "");
  if (inSingapore) {
    state.wasInSingaporeToday = true;
  } else if (
    state.wasInSingaporeToday &&
    row.acc !== "ON" &&
    parseDurationToSeconds(row.parkingDuration) >= PARKED_MIN_SECONDS
  ) {
    state.monitoringDone = true;
    await postToBitrix(
      `✅ ${alias} has returned to Malaysia and is parked. Pausing tracking for today — resuming tomorrow 7am.`
    );
    console.log("Truck returned to Malaysia; monitoring paused for the day.");
  }

  saveAndPushState(state);
}

main();
