import { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

type SunsetInfo =
  | { status: 'waiting' }
  | { status: 'until'; minutes: number }
  | { status: 'dark' };

/**
 * Minutes until civil sunset at the given location; updates every 30s.
 */
export function useSunsetMinutes(latitude: number | null, longitude: number | null): SunsetInfo {
  const [info, setInfo] = useState<SunsetInfo>({ status: 'waiting' });

  useEffect(() => {
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setInfo({ status: 'waiting' });
      return;
    }

    const tick = () => {
      const now = new Date();
      const times = SunCalc.getTimes(now, latitude, longitude);
      // Civil dusk — roughly when it’s getting properly dark (not just sun below horizon).
      const darkAt = times.dusk;
      const ms = darkAt.getTime() - now.getTime();
      if (ms <= 0) {
        setInfo({ status: 'dark' });
        return;
      }
      setInfo({ status: 'until', minutes: Math.ceil(ms / 60_000) });
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [latitude, longitude]);

  return info;
}
