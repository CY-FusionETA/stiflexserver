#!/usr/bin/env node
// Fetches the live position of the Malaysia -> Singapore truck from the TDT GPS
// share link, and posts a status update into the Bitrix24 "Logistics Tracking
// Unit" workgroup chat.
//
// Usage: node track-truck.mjs
// Config (env vars, all have defaults baked in below):
//   GPS_SHARE_TOKEN     - TDT GPS share.html token
//   GPS_WS_URL          - TDT GPS websocket endpoint
//   BITRIX_WEBHOOK       - Bitrix24 inbound webhook base URL
//   BITRIX_CHAT_DIALOG_ID - Bitrix24 im.message.add DIALOG_ID for the target chat

const GPS_SHARE_TOKEN =
  process.env.GPS_SHARE_TOKEN ||
  "ZDBbswMAaZ6MIixwKTgRy7JHbw60Q1SnzFBKGLi+J2P9EliwD0zBR31SQjwuEzDkCn2HPzEIfKGyS5iclL7LuNSMZW6oSp6sJ1/Y6vR6dAA+96fGZl/EP+ZhhYQCrovQ5iWz0fOy9C9rMBIFQ36luTmT9vA40BJV";
const GPS_WS_URL = process.env.GPS_WS_URL || "wss://live.tdtgps.com:9662/";
const BITRIX_WEBHOOK =
  process.env.BITRIX_WEBHOOK ||
  "https://dyntek.bitrix24.com/rest/445/4nzkjjyoek5sz58t";
const BITRIX_CHAT_DIALOG_ID = process.env.BITRIX_CHAT_DIALOG_ID || "chat8035"; // Logistics Tracking Unit

const WS_TIMEOUT_MS = 15000;

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

function formatMessage(row) {
  const mapsLink = `https://maps.google.com/?q=${row.Latitude},${row.Longitude}`;
  const ignition = row.acc === "ON" ? "Engine ON" : "Engine OFF";
  const speed = `${Number(row.speed).toFixed(0)} km/h`;
  const lines = [
    `🚚 [B]${row.Alias || row.deviceName}[/B] — location update`,
    `📍 ${row.location || "Unknown location"}`,
    `🗺 ${mapsLink}`,
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
  try {
    const row = await fetchTruckLocation();
    const message = formatMessage(row);
    await postToBitrix(message);
    console.log("Posted truck location update:\n" + message);
  } catch (err) {
    console.error("track-truck failed:", err.message);
    try {
      await postToBitrix(
        `⚠️ Truck GPS tracking failed to fetch a location update: ${err.message}\nThe share link may have expired and need renewing.`
      );
    } catch (postErr) {
      console.error("Also failed to post the failure notice to Bitrix24:", postErr.message);
    }
    process.exitCode = 1;
  }
}

main();
