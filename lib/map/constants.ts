/** Shared Leaflet map constants (HQ origin, tile source, marker markup). */

/** Kapruka HQ — Nugegoda. Routes/ETA originate here. */
export const KAPRUKA_HQ: [number, number] = [6.8728, 79.8889];

/** CARTO Voyager raster tiles (no API key). */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/** HTML for the Kapruka hub marker (logo badge). */
export const HUB_HTML =
  '<div class="leaflet-hub"><img src="/trova-logo.svg" class="leaflet-hub-logo" /></div>';

/** HTML for the destination drop pin. */
export const PIN_HTML =
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#F5C200;border:3px solid #fff;box-shadow:0 4px 12px rgba(229,124,0,.5);transform:rotate(-45deg)"></div>';
