/**
 * Where the service photographs came from, and what each licence requires.
 *
 * These are real photographs of real water and plumbing work, chosen from
 * Wikimedia Commons because the stock libraries kept offering laboratories
 * and lab coats, which is not what this company does.
 *
 * Several are Creative Commons and oblige us to credit the photographer. The
 * credits page is how we do that, so this list is the source of truth for
 * both the page and the script that installs the images. Removing an entry
 * here without removing the photograph would quietly break the licence.
 */
export interface ImageCredit {
  /** The service this illustrates, by slug. */
  slug: string;
  /** What the picture shows, used as the alt text too. */
  caption: string;
  /** Exact file name on Wikimedia Commons. */
  file: string;
  author: string;
  licence: string;
  licenceUrl: string | null;
  source: string;
}

/** Licences that oblige us to name the photographer. */
const ATTRIBUTION_FREE = ['Public domain', 'CC0'];

export function requiresAttribution(credit: ImageCredit): boolean {
  return !ATTRIBUTION_FREE.includes(credit.licence);
}

export const IMAGE_CREDITS: ImageCredit[] = [
  {
    slug: 'water-treatment',
    caption: 'A plant technician working on a process pump',
    file: 'Blue Grass Chemical Agent-Destruction Pilot Plant Supercritical Water Oxidation Processing Building (32310504244).jpg',
    author: 'PEO ACWA',
    licence: 'CC BY 2.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Supercritical_Water_Oxidation_Processing_Building_(32310504244).jpg',
  },
  {
    slug: 'reverse-osmosis-water-treatment',
    caption: 'A commercial reverse osmosis plant',
    file: 'A 1000 liter reverse osmosis plant for commercial use.jpg',
    author: 'Vishalsh521',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:A_1000_liter_reverse_osmosis_plant_for_commercial_use.jpg',
  },
  {
    slug: 'osmosis-membrane-supply-and-replacement',
    caption: 'Membrane filtration vessels and manifold pipework',
    file: 'Filtration unit (crossflow filtration).jpg',
    author: 'Wikiwayman',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Filtration_unit_(crossflow_filtration).jpg',
  },
  {
    slug: 'borehole-drilling',
    caption: 'A drilling crew at work on a borehole',
    file: 'Borehole drilling testing the purity of the water.jpg',
    author: 'Obedmakolo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Borehole_drilling_testing_the_purity_of_the_water.jpg',
  },
  {
    slug: 'geophysical-surveys',
    caption: 'A survey team setting out resistivity electrodes in the field',
    file: 'Electrical Resistance Measurements DVIDS176153.jpg',
    author: 'Petty Officer 1st Class Jonathan Kulp, US Department of Defense',
    licence: 'Public domain',
    licenceUrl: null,
    source:
      'https://commons.wikimedia.org/wiki/File:Electrical_Resistance_Measurements_DVIDS176153.jpg',
  },
  {
    slug: 'community-water-systems',
    caption: 'Excavation for a piped water supply serving a town',
    file: 'Pipeline installation for water to Masasi Town.jpg',
    author: 'Grahamcole',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Pipeline_installation_for_water_to_Masasi_Town.jpg',
  },
  {
    slug: 'general-plumbing',
    caption: 'Two plumbers at work on a fit out',
    file: 'Cameroon male plumbier at work 04.jpg',
    author: 'Gatien Titcho Seumo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Cameroon_male_plumbier_at_work_04.jpg',
  },
  {
    slug: 'pipe-laying',
    caption: 'A pipelayer jointing a run of pipe in an open trench',
    file: 'Pipelayers - DPLA - 2c6fc44d0577c7b884ca69affe859bc6.jpg',
    author: 'United States Department of Labor, 1913',
    licence: 'Public domain',
    licenceUrl: null,
    source:
      'https://commons.wikimedia.org/wiki/File:Pipelayers_-_DPLA_-_2c6fc44d0577c7b884ca69affe859bc6.jpg',
  },
  {
    slug: 'solar-water-heater-installation',
    caption: 'Installers fitting solar thermal collectors to a roof',
    file: 'Installation of solar thermal collectors, assisted by forklift.jpg',
    author: 'Stefan Thiesen',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:Installation_of_solar_thermal_collectors,_assisted_by_forklift.jpg',
  },
  {
    slug: 'leak-detection-and-repair',
    caption: 'A plumber working on a pipe run to trace and stop a leak',
    file: 'Cameroon male plumbier at work 01.jpg',
    author: 'Gatien Titcho Seumo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Cameroon_male_plumbier_at_work_01.jpg',
  },
  {
    slug: 'pressure-testing-of-pipes',
    caption: 'A pressure gauge on a test manifold',
    file: 'OIL SHALE PROJECT, NEVADA TEST SITE - DPLA - 896209a9c6e760ce8649e7b96ae3b8bb.jpg',
    author: 'Sandia National Laboratories, US Department of Energy',
    licence: 'Public domain',
    licenceUrl: null,
    source:
      'https://commons.wikimedia.org/wiki/File:OIL_SHALE_PROJECT,_NEVADA_TEST_SITE_-_DPLA_-_896209a9c6e760ce8649e7b96ae3b8bb.jpg',
  },
  {
    slug: 'drainage-works',
    caption: 'A crew jetting and clearing a drain from a tanker',
    file: 'Hydrocureur, France.jpg',
    author: 'Cjp24',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Hydrocureur,_France.jpg',
  },
];
