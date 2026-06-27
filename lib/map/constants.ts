/** Shared Leaflet map constants (HQ origin, tile source, marker markup). */

/** Snoonu HQ — West Bay / Lusail, Doha (illustrative only). Routes/ETA
 *  originate here, matching the mock MCP server's delivery-distance origin. */
export const SNOONU_HQ: [number, number] = [25.3548, 51.4326];

/** CARTO Voyager raster tiles (no API key). */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/** HTML for the Snoonu hub marker (logo badge). */
export const HUB_HTML =
  '<div class="leaflet-hub"><img src="/hala-logo.svg" class="leaflet-hub-logo" /></div>';

/** HTML for the destination drop pin. */
export const PIN_HTML =
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#F5C200;border:3px solid #fff;box-shadow:0 4px 12px rgba(229,124,0,.5);transform:rotate(-45deg)"></div>';
