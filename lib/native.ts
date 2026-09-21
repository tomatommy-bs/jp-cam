// Platform bridge: the same build runs on the web (Vercel) and inside the
// Capacitor shell (iOS / Android). Each helper uses the native plugin when
// running in the app and falls back to the browser API otherwise, so callers
// never branch on platform themselves.

import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type Coords = { lat: number; lng: number };

export type PositionOptions = {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
};

export async function getCurrentPosition(opts: PositionOptions): Promise<Coords> {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition(opts);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('位置情報に対応していません');
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

const ALBUM_NAME = 'JP-CAM';

// Android requires an album identifier for savePhoto; iOS saves to the camera
// roll without one (and only asks for add-only permission in that case).
async function androidAlbumIdentifier(): Promise<string> {
  const { Media } = await import('@capacitor-community/media');
  const { path } = await Media.getAlbumsPath();
  const find = async () =>
    (await Media.getAlbums()).albums.find(a => a.name === ALBUM_NAME && a.identifier.startsWith(path));
  let album = await find();
  if (!album) {
    await Media.createAlbum({ name: ALBUM_NAME });
    album = await find();
  }
  if (!album) throw new Error('アルバムを作成できませんでした');
  return album.identifier;
}

/** Saves a JPEG data URL to the device photo library. Native only. */
export async function saveImageToPhotos(dataUrl: string, filename: string): Promise<void> {
  const { Media } = await import('@capacitor-community/media');
  const albumIdentifier = Capacitor.getPlatform() === 'android' ? await androidAlbumIdentifier() : undefined;
  await Media.savePhoto({ path: dataUrl, albumIdentifier, fileName: filename.replace(/\.jpe?g$/i, '') });
}

/** Opens the native share sheet for a JPEG data URL. Native only. */
export async function shareImage(dataUrl: string, filename: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    directory: Directory.Cache,
  });
  await Share.share({ files: [uri] });
}
