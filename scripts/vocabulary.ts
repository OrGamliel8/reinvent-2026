// Prints the catalog vocabulary (topics, services, types, levels, …) from public/catalog.sqlite3 as JSON.
import { requireSnapshot } from './lib/snapshot';

const catalog = await requireSnapshot();
console.log(JSON.stringify({ meta: catalog.meta(), ...catalog.vocabulary() }, null, 2));
