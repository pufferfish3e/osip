import ACTIVE from '../data/active.json' with { type:'json' };
import DEMO from '../data/demo.json' with { type:'json' };
import NEW_USER from '../data/newuser.json' with { type:'json' };

if (!['demo', 'newuser'].includes(ACTIVE.profile)) throw new Error('data/active.json profile must be demo or newuser.');

export const STORAGE_PROFILE = ACTIVE.profile;
export const SEED_STATE = STORAGE_PROFILE === 'demo' ? DEMO : NEW_USER;
