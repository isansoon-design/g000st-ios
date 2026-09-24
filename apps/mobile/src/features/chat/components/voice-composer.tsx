import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

const MAX_DURATION_MS = 5 * 60 * 1_000;
const waveform = [5, 11, 16, 9, 19, 13, 7, 15, 20, 10, 17, 8, 14, 6, 12, 18];
const voiceRecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  bitRate: 64_000,
  numberOfChannels: 1,
};

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.ceil(value / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function VoicePreview({ durationMs, uri }: Readonly<{ durationMs: number; uri: string }>) {
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) void player.seekTo(0);
    player.play();
  };

  return (
    <View className="min-h-11 flex-1 flex-row items-center rounded-[22px] border border-black/15 bg-white px-2">
      <Pressable accessibilityLabel={status.playing ? 'Pause recording preview' : 'Play recording preview'} accessibilityRole="button" className="h-8 w-8 items-center justify-center rounded-full bg-g000st-black" onPress={toggle}>
        <Text className="ml-px text-xs font-black text-white">{status.playing ? 'Ⅱ' : '▶'}</Text>
      </Pressable>
      <View className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
        <View className="h-full rounded-full bg-g000st-red" style={{ width: `${progress * 100}%` }} />
      </View>
      <Text className="font-mono text-[11px] font-black text-black/45">{formatDuration(durationMs)}</Text>
    </View>
  );
}

type VoiceComposerProps = Readonly<{
  canSendText: boolean;
  draft: string;
  hasAttachments: boolean;
  isSending: boolean;
  onChangeDraft: (value: string) => void;
  onError: (message: string | null) => void;
  onSend: (uri: string, durationMs: number) => Promise<boolean>;
  onSendText: () => void;
}>;

function VoiceComposerComponent({
  canSendText,
  draft,
  hasAttachments,
  isSending,
  onChangeDraft,
  onError,
  onSend,
  onSendText,
}: VoiceComposerProps) {
  const recorder = useAudioRecorder(voiceRecordingOptions);
  const recorderState = useAudioRecorderState(recorder, 100);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recorded, setRecorded] = useState<Readonly<{ durationMs: number; uri: string }> | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const deleteRecording = useCallback(() => {
    if (recorded) {
      try {
        new File(recorded.uri).delete();
      } catch {
        // Cache cleanup is best effort.
      }
    }
    setRecorded(null);
    onError(null);
  }, [onError, recorded]);

  const startRecording = useCallback(async () => {
    if (isPreparing || isSending) return;
    setIsPreparing(true);
    onError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError('Microphone access is required to record a voice message.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      limitTimerRef.current = setTimeout(() => {
        void recorder.stop().then(async () => {
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
          if (recorder.uri) setRecorded({ durationMs: MAX_DURATION_MS, uri: recorder.uri });
        });
      }, MAX_DURATION_MS);
    } catch {
      onError('Could not start recording. Please try again.');
    } finally {
      setIsPreparing(false);
    }
  }, [isPreparing, isSending, onError, recorder]);

  const stopRecording = useCallback(async () => {
    if (!recorderState.isRecording) return;
    const durationMs = Math.max(1, Math.min(MAX_DURATION_MS, recorderState.durationMillis));
    try {
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error('Missing recording URI');
      setRecorded({ durationMs, uri: recorder.uri });
    } catch {
      onError('Could not save the recording. Please try again.');
    }
  }, [onError, recorder, recorderState.durationMillis, recorderState.isRecording]);

  const cancelRecording = useCallback(async () => {
    try {
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
      if (recorderState.isRecording) await recorder.stop();
      if (recorder.uri) new File(recorder.uri).delete();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // The UI can still safely return to idle.
    }
    setRecorded(null);
    onError(null);
  }, [onError, recorder, recorderState.isRecording]);

  const send = async () => {
    if (!recorded || isSending) return;
    if (await onSend(recorded.uri, recorded.durationMs)) {
      try {
        new File(recorded.uri).delete();
      } catch {
        // The operating system will eventually clear the cache.
      }
      setRecorded(null);
    }
  };

  useEffect(() => () => {
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [recorder]);

  if (recorderState.isRecording) {
    return (
      <>
        <View className="min-h-11 flex-1 flex-row items-center rounded-[22px] border border-g000st-red/25 bg-white px-3">
          <View className="h-2.5 w-2.5 rounded-full bg-g000st-red" />
          <Text className="ml-2 font-mono text-sm font-black text-g000st-red">{formatDuration(recorderState.durationMillis)}</Text>
          <View className="mx-2 flex-1 flex-row items-center justify-center gap-0.5">
            {waveform.slice(0, 11).map((height, index) => <View className="w-1 rounded-full bg-g000st-red/55" key={index} style={{ height }} />)}
          </View>
          <Pressable accessibilityLabel="Cancel recording" accessibilityRole="button" className="h-8 w-8 items-center justify-center rounded-full" onPress={() => void cancelRecording()}>
            <Text className="text-lg font-black text-black/45">×</Text>
          </Pressable>
        </View>
        <Pressable accessibilityLabel="Stop recording" accessibilityRole="button" className="h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-red" onPress={() => void stopRecording()}>
          <View className="h-3.5 w-3.5 rounded-sm bg-white" />
        </Pressable>
      </>
    );
  }

  if (recorded) {
    return (
      <>
        <VoicePreview durationMs={recorded.durationMs} uri={recorded.uri} />
        <Pressable accessibilityLabel="Delete recording" accessibilityRole="button" className="h-[42px] w-8 items-center justify-center" disabled={isSending} onPress={deleteRecording}>
          <Text className="text-xl font-black text-g000st-red">×</Text>
        </Pressable>
        <Pressable accessibilityLabel="Send voice message" accessibilityRole="button" className="h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-black" disabled={isSending} onPress={() => void send()}>
          {isSending ? <ActivityIndicator color="white" size="small" /> : <Text className="text-base font-black text-white">➤</Text>}
        </Pressable>
      </>
    );
  }

  return (
    <>
      <View className="min-h-11 flex-1 justify-center rounded-[22px] border border-black/15 bg-white px-1.5">
        <TextInput
          accessibilityLabel="Message"
          className="max-h-28 min-h-11 w-full px-2.5 pb-1.5 pt-2.5 text-[15px] text-g000st-black"
          editable={!isSending}
          maxLength={4_000}
          multiline
          onChangeText={onChangeDraft}
          placeholder="Type a message"
          placeholderTextColor="#777777"
          value={draft}
        />
      </View>
      {draft.trim() || hasAttachments ? (
        <Pressable accessibilityLabel="Send" accessibilityRole="button" accessibilityState={{ disabled: !canSendText }} className={`h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-silver ${canSendText ? '' : 'opacity-50'}`} disabled={!canSendText} onPress={onSendText}>
          <Text className="text-base font-black text-white">➤</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityLabel="Record a voice message" accessibilityRole="button" className="h-[42px] w-[42px] items-center justify-center rounded-full bg-g000st-black" disabled={isPreparing || isSending} onPress={() => void startRecording()}>
          {isPreparing ? <ActivityIndicator color="white" size="small" /> : <Text className="text-lg font-black text-white">🎙</Text>}
        </Pressable>
      )}
    </>
  );
}

export const VoiceComposer = memo(VoiceComposerComponent);
