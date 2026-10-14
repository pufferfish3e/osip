import ACTIVE from '../data/active.json' with { type:'json' };
import DEMO from '../data/demo.json' with { type:'json' };
import NEW_USER from '../data/newuser.json' with { type:'json' };

// Tests pin a profile with OSIP_PROFILE so they do not depend on the template chosen for the app.
const PROFILE = globalThis.process?.env?.OSIP_PROFILE ?? ACTIVE.profile;
if (!['demo', 'newuser'].includes(PROFILE)) throw new Error('data/active.json profile must be demo or newuser.');

export const STORAGE_PROFILE = PROFILE;
export const SEED_STATE = STORAGE_PROFILE === 'demo' ? DEMO : NEW_USER;
