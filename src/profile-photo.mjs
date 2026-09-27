import { t } from './i18n.mjs';

const MAX_PHOTO_CHARACTERS = 200000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const PHOTO_EDGE = 256;
const MAX_PIXELS = 48000000;
const JPEG_QUALITY = 0.8;

/** @param {unknown} photo @returns {boolean} */
export function isProfilePhoto(photo) {
  return photo === undefined || photo === '/assets/profile-ahmad.jpg'
    || (typeof photo === 'string' && photo.length <= MAX_PHOTO_CHARACTERS
      && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(photo));
}

/** @param {File} file @returns {Promise<string>} */
export async function prepareProfilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(t('Choose a JPEG, PNG or WebP photo.'));
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error(t('Choose a photo smaller than 15 MB.'));
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_PIXELS) throw new Error(t('Choose a smaller photo.'));
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_EDGE; canvas.height = PHOTO_EDGE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('Could not prepare this photo.'));
    context.fillStyle = '#fff'; context.fillRect(0, 0, PHOTO_EDGE, PHOTO_EDGE);
    context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, PHOTO_EDGE, PHOTO_EDGE);
    const photo = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!isProfilePhoto(photo)) throw new Error(t('Could not prepare this photo.'));
    return photo;
  } finally { URL.revokeObjectURL(url); }
}

/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {void} */
export function initializeProfilePicture(root, store) {
  for (const input of root.querySelectorAll('[data-profile-photo]')) {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const status = input.closest('[data-photo-upload]').querySelector('[role="status"]');
      input.disabled = true;
      status.textContent = t('Saving photo…');
      try {
        const photo = await prepareProfilePhoto(file);
        store.update((state) => { state.profile.photo = photo; });
        for (const image of document.querySelectorAll('.profile-photo')) image.src = photo;
        status.textContent = t('Photo saved on this device.');
      } catch (error) {
        console.error('Profile photo upload failed.', error);
        status.textContent = error instanceof Error ? error.message : t('Could not save this photo.');
      } finally { input.disabled = false; input.value = ''; }
    });
  }
}
