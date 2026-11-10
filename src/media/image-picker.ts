import * as ImagePicker from 'expo-image-picker';

import { imagePickErrorMessage, type ImageSource } from './image-source.ts';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
  fileName?: string | null;
};

export type PickImageResult =
  | { status: 'picked'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedImage {
  return { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType, fileName: asset.fileName };
}

export async function pickImage(source: ImageSource): Promise<PickImageResult> {
  try {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false });
    if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
    return { status: 'picked', image: toPicked(result.assets[0]) };
  } catch (error) {
    return { status: 'error', message: imagePickErrorMessage(error) };
  }
}
