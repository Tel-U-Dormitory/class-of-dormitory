import assert from 'node:assert/strict';
import { fullyAccepted } from '../resources/js/lib/submission.ts';

assert.equal(fullyAccepted({ accepted: 30, rejected: [] }, 30), true);
assert.equal(fullyAccepted({ accepted: 29, rejected: [7] }, 30), false);
assert.equal(fullyAccepted({ accepted: 29, rejected: [] }, 30), false);
assert.equal(fullyAccepted({}, 0), false);
assert.equal(fullyAccepted(null, 30), false);
assert.equal(fullyAccepted({ accepted: 0, rejected: [] }, 0), true);
console.log('PASS submission acknowledgement checks');
