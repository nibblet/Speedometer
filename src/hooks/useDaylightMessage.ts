import { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

export type DaylightHeaderLabel = 'DAYLIGHT' | 'SUNRISE' | 'SUNSET' | 'GOLDEN HOUR';

export type DaylightInfo =
  | { status: 'waiting' }
  | { status: 'ready'; message: string; label: DaylightHeaderLabel };

const MS_MIN = 60_000;
const MS_HOUR = 60 * MS_MIN;

function minutesUntil(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / MS_MIN);
}

function isBetween(now: Date, start: Date, end: Date): boolean {
  const t = now.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function localMinutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Pure daylight message resolver — priority-ordered contextual strings for the MAP header.
 */
export function getDaylightMessage(
  now: Date,
  latitude: number,
  longitude: number,
): DaylightInfo {
  const times = SunCalc.getTimes(now, latitude, longitude);
  const t = now.getTime();
  const dawn = times.dawn.getTime();
  const sunrise = times.sunrise.getTime();
  const sunriseEnd = times.sunriseEnd.getTime();
  const solarNoon = times.solarNoon.getTime();
  const goldenHour = times.goldenHour.getTime();
  const sunset = times.sunset.getTime();
  const dusk = times.dusk.getTime();

  if (!Number.isFinite(dusk)) {
    return { status: 'waiting' };
  }

  // 1 — after civil dusk
  if (t >= dusk) {
    return { status: 'ready', message: 'Headlights on, partner', label: 'DAYLIGHT' };
  }

  const minToDusk = minutesUntil(now, times.dusk);

  // 2 — ≤ 30 min before dusk
  if (minToDusk <= 30) {
    return {
      status: 'ready',
      message: `Headlights soon — ${minToDusk} min`,
      label: 'SUNSET',
    };
  }

  // 3 — sunset ± 60 min
  if (isBetween(now, new Date(sunset - MS_HOUR), new Date(sunset + MS_HOUR))) {
    return {
      status: 'ready',
      message: 'Sunset hour — easy on the throttle',
      label: 'SUNSET',
    };
  }

  // 4 — ≤ 60 min before sunset
  const minToSunset = minutesUntil(now, times.sunset);
  if (minToSunset > 0 && minToSunset <= 60) {
    return {
      status: 'ready',
      message: "1 hr 'til sunset",
      label: 'SUNSET',
    };
  }

  // 5 — evening golden hour
  if (isBetween(now, times.goldenHour, times.sunset)) {
    return {
      status: 'ready',
      message: 'Golden hour — soak it in',
      label: 'GOLDEN HOUR',
    };
  }

  // 6 — sunrise ± 60 min
  if (isBetween(now, new Date(sunrise - MS_HOUR), new Date(sunrise + MS_HOUR))) {
    return {
      status: 'ready',
      message: 'Sunrise run — morning fairways',
      label: 'SUNRISE',
    };
  }

  // 7 — morning golden hour
  if (isBetween(now, times.sunrise, times.sunriseEnd)) {
    return {
      status: 'ready',
      message: 'Morning glow — soft light',
      label: 'GOLDEN HOUR',
    };
  }

  // 8 — pre-dawn (outside sunrise ±60)
  if (isBetween(now, times.dawn, times.sunrise)) {
    return {
      status: 'ready',
      message: 'First light — almost sunrise',
      label: 'SUNRISE',
    };
  }

  // 9 — solar noon ± 30 min
  if (isBetween(now, new Date(solarNoon - 30 * MS_MIN), new Date(solarNoon + 30 * MS_MIN))) {
    return {
      status: 'ready',
      message: 'High noon — peak sun',
      label: 'DAYLIGHT',
    };
  }

  const localMin = localMinutesSinceMidnight(now);

  // 10 — lunch 11:00–13:00
  if (localMin >= 11 * 60 && localMin < 13 * 60) {
    return { status: 'ready', message: 'Lunch lap?', label: 'DAYLIGHT' };
  }

  // 11 — afternoon 13:00–15:00
  if (localMin >= 13 * 60 && localMin < 15 * 60) {
    return { status: 'ready', message: 'Afternoon putt?', label: 'DAYLIGHT' };
  }

  // 12 — weekend mornings 07:00–10:00 (daytime only — before dusk)
  if (isWeekend(now) && localMin >= 7 * 60 && localMin < 10 * 60 && t < dusk) {
    return { status: 'ready', message: 'Weekend fairways', label: 'DAYLIGHT' };
  }

  // 13 — before sunrise (outside dawn windows)
  if (t < sunrise && t < dawn) {
    const minToSunrise = minutesUntil(now, times.sunrise);
    return {
      status: 'ready',
      message: `Sunrise in ${minToSunrise} min`,
      label: 'SUNRISE',
    };
  }

  // 14 — daytime default
  return {
    status: 'ready',
    message: `${minToDusk} min 'til headlights`,
    label: 'DAYLIGHT',
  };
}

/**
 * Contextual daylight message for the MAP header; updates every 30s.
 */
export function useDaylightMessage(
  latitude: number | null,
  longitude: number | null,
): DaylightInfo {
  const [info, setInfo] = useState<DaylightInfo>({ status: 'waiting' });

  useEffect(() => {
    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setInfo({ status: 'waiting' });
      return;
    }

    const tick = () => {
      setInfo(getDaylightMessage(new Date(), latitude, longitude));
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [latitude, longitude]);

  return info;
}
