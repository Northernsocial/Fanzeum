import { DEMO_COLLECTIONS, DEMO_ITEMS, DEMO_USERS } from '../src/data/demoCatalog.ts';

console.log('Fanzeum Demo Catalogue Summary:');
console.log(`- Collectors:  ${DEMO_USERS.length}`);
console.log(`- Collections: ${DEMO_COLLECTIONS.length} (${DEMO_COLLECTIONS.filter((c) => c.featured).length} featured)`);
console.log(`- Pieces:      ${DEMO_ITEMS.length}`);
console.log(
  'To write or remove live Firestore demo documents with admin credentials, sign in as admin in the app and open Settings > Admin Tools ("Load demo data" / "Remove demo data").',
);
