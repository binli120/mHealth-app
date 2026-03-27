/**
 * ChatBubble
 * Renders a single chat message — text or voice.
 *
 * Voice messages:
 *   • If signedUrl is already present in Redux, renders an <audio> player.
 *   • Otherwise, fetches a fresh signed URL from
 *     GET /api/sessions/[sessionId]/voice/[messageId] on first render.
 *
 * @author Bin Lee
 */

'use client';

import { Loader2, Mic, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { SessionMessage } from '@/lib/collaborative-sessions/types';
import { updateMessageSignedUrl } from '@/lib/redux/features/collaborative-session-slice';
import { useAppDispatch } from '@/lib/redux/hooks';
import { authenticatedFetch } from '@/lib/supabase/authenticated-fetch';
import { formatTime } from '@/lib/utils/format';

interface Props {
  message: SessionMessage;
  isMine: boolean;
  sessionId: string;
}

// ── Voice player ──────────────────────────────────────────────────────────────

function VoicePlayer({
  message,
  sessionId,
}: {
  message: SessionMessage;
  sessionId: string;
}) {
  const dispatch = useAppDispatch();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // useRef as a fetch-in-flight guard — mutating a ref never causes a render,
  // so it is safe to set synchronously inside an effect body.
  const fetchingRef = useRef(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    message.signedUrl,
  );
  // Start as "loading" only when we don't already have a signed URL.
  // The state is only mutated inside async callbacks (never synchronously).
  const [loading, setLoading] = useState(!message.signedUrl);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const [duration, setDuration] = useState(message.durationSec ?? 0);

  // Fetch signed URL on first render if missing
  useEffect(() => {
    if (resolvedUrl || fetchingRef.current) return;
    fetchingRef.current = true; // ref mutation — safe in effect body
    authenticatedFetch(`/api/sessions/${sessionId}/voice/${message.id}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; signedUrl?: string }) => {
        // async callback — setState is fine
        if (data.ok && data.signedUrl) {
          setResolvedUrl(data.signedUrl);
          dispatch(
            updateMessageSignedUrl({
              messageId: message.id,
              signedUrl: data.signedUrl,
            }),
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [resolvedUrl, message.id, sessionId, dispatch]);

  function handleToggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => null);
      setPlaying(true);
    }
  }

  function formatSec(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-xs opacity-60'>
        <Loader2 className='w-3.5 h-3.5 animate-spin' />
        Loading audio…
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className='flex items-center gap-2 text-xs opacity-60'>
        <Mic className='w-3.5 h-3.5' />
        Voice message unavailable
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 min-w-[160px]'>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={resolvedUrl}
        onLoadedMetadata={(e) =>
          setDuration((e.target as HTMLAudioElement).duration)
        }
        onTimeUpdate={(e) => {
          const el = e.target as HTMLAudioElement;
          setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />

      {/* Play / Pause button */}
      <button
        onClick={handleToggle}
        className='flex-shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors'
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <Pause className='w-3.5 h-3.5' />
        ) : (
          <Play className='w-3.5 h-3.5 ml-0.5' />
        )}
      </button>

      {/* Progress bar */}
      <div className='flex-1 flex flex-col gap-0.5'>
        <div className='h-1.5 rounded-full bg-white/20 overflow-hidden'>
          <div
            className='h-full rounded-full bg-white/70 transition-all duration-100'
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className='text-[10px] opacity-70'>{formatSec(duration)}</span>
      </div>

      <Mic className='w-3 h-3 opacity-50 flex-shrink-0' />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatBubble({ message, isMine, sessionId }: Props) {
  return (
    <div
      className={`flex flex-col gap-0.5 max-w-[72%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}
    >
      {/* Other party: "Name · timestamp" on one compact line */}
      {!isMine && (
        <div className='flex items-center gap-1 px-1'>
          <span className='text-[11px] font-semibold text-gray-300'>
            {message.senderName}
          </span>
          <span className='text-[11px] text-gray-500'>·</span>
          <span className='text-[10px] text-gray-500'>
            {formatTime(message.createdAt)}
          </span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`
          px-3 py-1.5 rounded-2xl text-sm leading-snug
          ${
            isMine
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm'
          }
        `}
      >
        {message.type === 'voice' ? (
          <VoicePlayer message={message} sessionId={sessionId} />
        ) : (
          <span className='whitespace-pre-wrap break-words'>
            {message.content}
          </span>
        )}
      </div>

      {/* My messages: timestamp below the bubble */}
      {isMine && (
        <span className='text-[10px] text-gray-500 px-1'>
          {formatTime(message.createdAt)}
        </span>
      )}
    </div>
  );
}
