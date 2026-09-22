import { TelnyxRTC, type Call } from '@telnyx/react-native-voice-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { authorizeExternalCall, issueWebrtcCredential } from '@/api/mobile';

export type ExternalCallStatus = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended' | 'error';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined;
}

function mapCallState(state: string): ExternalCallStatus | undefined {
  if (state === 'new' || state === 'connecting') return 'connecting';
  if (state === 'ringing') return 'ringing';
  if (state === 'active' || state === 'held') return 'active';
  if (state === 'ended' || state === 'dropped') return 'ended';
  return undefined;
}

/**
 * Wraps the Telnyx React Native Voice SDK for placing external (PSTN) calls straight from the
 * device — there is no server-side call placement; the server only pre-authorizes on balance
 * (POST /telephony/calls) and issues a short-lived, server-signed credential
 * (POST /telephony/webrtc-credential) that this hook registers with directly. `clientState` is
 * passed through unmodified for billing attribution — never construct it here. This uses
 * `react-native-webrtc`, which is npm-aliased at the workspace root to the already-installed
 * `@livekit/react-native-webrtc` (see the root package.json's `overrides`) so the app links
 * exactly one native WebRTC module, shared with the in-app calling feature.
 */
export function useMobileExternalCall() {
  const [status, setStatus] = useState<ExternalCallStatus>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorCodeValue, setErrorCodeValue] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.hangup();
      clientRef.current?.disconnect();
    };
  }, []);

  const teardown = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    callRef.current = null;
    setIsMuted(false);
  }, []);

  const placeCall = useCallback(
    async (toE164: string) => {
      setErrorText(null);
      setErrorCodeValue(null);
      setStatus('connecting');

      try {
        await authorizeExternalCall(toE164);
        const credential = await issueWebrtcCredential();

        const client = new TelnyxRTC({ login_token: credential.loginToken });
        clientRef.current = client;

        client.on('telnyx.client.error', (error: Error) => {
          setErrorText(errorMessage(error));
          setStatus('error');
          teardown();
        });

        client.on('telnyx.call.stateChanged', (_call: Call, state: string) => {
          const mapped = mapCallState(state);
          if (!mapped) return;
          setStatus(mapped);
          if (mapped === 'ended') teardown();
        });

        await client.connect();
        callRef.current = await client.newCall({
          destinationNumber: toE164,
          clientState: credential.clientState,
        });
      } catch (error) {
        setErrorText(errorMessage(error));
        setErrorCodeValue(errorCode(error) ?? null);
        setStatus('error');
        teardown();
      }
    },
    [teardown],
  );

  const hangup = useCallback(() => {
    callRef.current?.hangup();
    teardown();
    setStatus('ended');
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    if (isMuted) call.unmute();
    else call.mute();
    setIsMuted((previous) => !previous);
  }, [isMuted]);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorText(null);
    setErrorCodeValue(null);
  }, []);

  return { errorCode: errorCodeValue, errorText, isMuted, placeCall, hangup, reset, status, toggleMute };
}
