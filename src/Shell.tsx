import { useEffect, useState } from "react";
import App from "./App";
import { SqlApp } from "./sql/SqlApp";
import { TRACK_KEY, type Track } from "./track";

function loadTrack(): Track {
  try {
    return localStorage.getItem(TRACK_KEY) === "sql" ? "sql" : "python";
  } catch {
    return "python";
  }
}

export function Shell() {
  const [track, setTrack] = useState<Track>(loadTrack);

  useEffect(() => {
    document.title = track === "sql" ? "Elice × SQL" : "Elice × RoboWorld";
    try {
      localStorage.setItem(TRACK_KEY, track);
    } catch {
      // Private mode can block storage. The switch still works for this visit.
    }
  }, [track]);

  if (track === "sql") return <SqlApp track={track} onTrack={setTrack} />;
  return <App track={track} onTrack={setTrack} />;
}
