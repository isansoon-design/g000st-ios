import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const supportedMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export type SelectedChatAttachment = Readonly<{
  byteSize: number;
  contentType: string;
  fileName: string;
  localUri: string;
}>;

function mimeFromFileName(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return (
    {
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      gif: 'image/gif',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      mov: 'video/quicktime',
      mp4: 'video/mp4',
      pdf: 'application/pdf',
      png: 'image/png',
      webm: 'video/webm',
      webp: 'image/webp',
    }[extension ?? ''] ?? null
  );
}

function imageFileName(uri: string, provided?: string | null): string {
  if (provided?.trim()) return provided.trim();
  const candidate = uri.split('/').pop()?.split('?')[0];
  return candidate?.trim() || 'attachment';
}

export function useChatAttachments() {
  const [attachments, setAttachments] = useState<readonly SelectedChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const append = useCallback((incoming: readonly SelectedChatAttachment[]) => {
    setError(null);
    setAttachments((current) => {
      const available = MAX_ATTACHMENTS - current.length;
      if (available <= 0) {
        setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        return current;
      }
      const accepted: SelectedChatAttachment[] = [];
      for (const attachment of incoming) {
        if (!supportedMimeTypes.has(attachment.contentType)) {
          setError('Only images, videos, PDF, and Word files are allowed.');
          continue;
        }
        if (attachment.byteSize < 1 || attachment.byteSize > MAX_ATTACHMENT_BYTES) {
          setError('Each attachment must be 5 MB or smaller.');
          continue;
        }
        if (accepted.length < available) accepted.push(attachment);
      }
      return [...current, ...accepted];
    });
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to attach media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit: MAX_ATTACHMENTS,
    });
    if (result.canceled) return;
    append(
      result.assets.flatMap((asset) => {
        const fileName = imageFileName(asset.uri, asset.fileName);
        const contentType = asset.mimeType ?? mimeFromFileName(fileName);
        const byteSize = asset.fileSize;
        return contentType && byteSize
          ? [{ byteSize, contentType, fileName, localUri: asset.uri }]
          : [];
      }),
    );
  }, [append]);

  const captureWithCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to capture media.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const fileName = imageFileName(asset.uri, asset.fileName);
    const contentType = asset.mimeType ?? mimeFromFileName(fileName);
    if (!contentType || !asset.fileSize) {
      setError('The selected media did not include a usable file type or size.');
      return;
    }
    append([{ byteSize: asset.fileSize, contentType, fileName, localUri: asset.uri }]);
  }, [append]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    });
    if (result.canceled) return;
    append(
      result.assets.flatMap((asset) => {
        const contentType = asset.mimeType ?? mimeFromFileName(asset.name);
        return contentType && asset.size
          ? [{ byteSize: asset.size, contentType, fileName: asset.name, localUri: asset.uri }]
          : [];
      }),
    );
  }, [append]);

  return {
    attachments,
    captureWithCamera,
    clearAttachments: () => setAttachments([]),
    error,
    pickDocument,
    pickFromLibrary,
    removeAttachment: (fileName: string) =>
      setAttachments((current) => current.filter((attachment) => attachment.fileName !== fileName)),
  };
}
