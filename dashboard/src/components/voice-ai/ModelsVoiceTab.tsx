'use client';

import { useState, useRef } from 'react';
import { AgentConfig } from './types';

interface Props {
  config: AgentConfig;
  onChange: (updates: Partial<AgentConfig>) => void;
}

// ElevenLabs Premium Voices with preview URLs
// Using ElevenLabs public voice sample previews
const VOICE_OPTIONS = [
  // Female Voices
  {
    id: 'rachel',
    name: 'Rachel',
    description: 'Calm, professional American',
    gender: 'female',
    previewUrl: 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream?optimize_streaming_latency=0',
    voiceApiId: '21m00Tcm4TlvDq8ikWAM'
  },
  {
    id: 'sarah',
    name: 'Sarah',
    description: 'Soft-spoken, friendly American',
    gender: 'female',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2571db387e.mp3',
    voiceApiId: 'EXAVITQu4vr4xnSDxMaL'
  },
  {
    id: 'charlotte',
    name: 'Charlotte',
    description: 'Warm British accent',
    gender: 'female',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d89-bda5-4f8505ee038b.mp3',
    voiceApiId: 'XB0fDUnXU5powFXDhCwa'
  },
  {
    id: 'matilda',
    name: 'Matilda',
    description: 'Warm, news-anchor style',
    gender: 'female',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
    voiceApiId: 'XrExE9yKIg1WjnnlVkGX'
  },
  // Male Voices
  {
    id: 'josh',
    name: 'Josh',
    description: 'Deep, confident American',
    gender: 'male',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/3ae2fc71-d5f9-4769-bb71-2135d4f99a48.mp3',
    voiceApiId: 'TxGEqnHWrfWFTfGW9XjX'
  },
  {
    id: 'adam',
    name: 'Adam',
    description: 'Deep, narrative American',
    gender: 'male',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/69baa399-0d31-48d6-92e0-d15207f8d8fc.mp3',
    voiceApiId: 'pNInz6obpgDQGcFmaJgB'
  },
  {
    id: 'antoni',
    name: 'Antoni',
    description: 'Friendly, casual American',
    gender: 'male',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f8f0-1122-4333-b323-0b87478d506a.mp3',
    voiceApiId: 'ErXwobaYiN019PkySvjV'
  },
  {
    id: 'brian',
    name: 'Brian',
    description: 'Deep British narrator',
    gender: 'male',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzI2devNBz1zQrb/2dd3e72c-4fd3-42f1-93ea-abc5d4e5aa6a.mp3',
    voiceApiId: 'nPczCjzI2devNBz1zQrb'
  },
];

export function ModelsVoiceTab({ config, onChange }: Props) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const femaleVoices = VOICE_OPTIONS.filter((v) => v.gender === 'female');
  const maleVoices = VOICE_OPTIONS.filter((v) => v.gender === 'male');

  const playVoicePreview = (voiceId: string, previewUrl: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking the same voice, just stop
    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }

    // Play new voice preview
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingVoice(voiceId);

    audio.play().catch((err) => {
      console.error('Error playing voice preview:', err);
      setPlayingVoice(null);
    });

    audio.onended = () => {
      setPlayingVoice(null);
      audioRef.current = null;
    };
  };

  return (
    <div className="space-y-6">
      {/* Voice Provider Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Voice Selection</h3>
          <p className="text-sm text-gray-500 mt-1">
            Choose the voice your agent will use on calls
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          ElevenLabs Premium
        </span>
      </div>

      {/* Cost Info */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-purple-900">Premium Realistic Voices</p>
            <p className="text-sm text-purple-700 mt-0.5">
              ElevenLabs voices are the most realistic AI voices available (~$0.03/min).
              They sound natural and human-like, perfect for professional phone calls.
            </p>
          </div>
        </div>
      </div>

      {/* Female Voices */}
      <div>
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
          Female Voices
        </p>
        <div className="grid grid-cols-2 gap-3">
          {femaleVoices.map((voice) => (
            <div
              key={voice.id}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition ${
                config.voiceId === voice.id
                  ? 'border-mautic-blue bg-mautic-blue/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="voice"
                  value={voice.id}
                  checked={config.voiceId === voice.id}
                  onChange={(e) => onChange({ voiceId: e.target.value })}
                  className="sr-only"
                />
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {voice.name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{voice.name}</div>
                  <div className="text-xs text-gray-500">{voice.description}</div>
                </div>
              </label>
              <button
                type="button"
                onClick={() => playVoicePreview(voice.id, voice.previewUrl)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                  playingVoice === voice.id
                    ? 'bg-mautic-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={playingVoice === voice.id ? 'Stop preview' : 'Play preview'}
              >
                {playingVoice === voice.id ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h4v12H6V6zm8 0h4v12h-4V6z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              {config.voiceId === voice.id && (
                <svg className="w-5 h-5 text-mautic-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Male Voices */}
      <div>
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
          Male Voices
        </p>
        <div className="grid grid-cols-2 gap-3">
          {maleVoices.map((voice) => (
            <div
              key={voice.id}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition ${
                config.voiceId === voice.id
                  ? 'border-mautic-blue bg-mautic-blue/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="voice"
                  value={voice.id}
                  checked={config.voiceId === voice.id}
                  onChange={(e) => onChange({ voiceId: e.target.value })}
                  className="sr-only"
                />
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {voice.name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{voice.name}</div>
                  <div className="text-xs text-gray-500">{voice.description}</div>
                </div>
              </label>
              <button
                type="button"
                onClick={() => playVoicePreview(voice.id, voice.previewUrl)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                  playingVoice === voice.id
                    ? 'bg-mautic-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={playingVoice === voice.id ? 'Stop preview' : 'Play preview'}
              >
                {playingVoice === voice.id ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h4v12H6V6zm8 0h4v12h-4V6z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              {config.voiceId === voice.id && (
                <svg className="w-5 h-5 text-mautic-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Voice Preview */}
      {config.voiceId && (() => {
        const selectedVoice = VOICE_OPTIONS.find(v => v.id === config.voiceId);
        if (!selectedVoice) return null;
        return (
          <div className="bg-gradient-to-r from-mautic-blue/5 to-purple-50 border border-mautic-blue/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium ${
                  selectedVoice.gender === 'female'
                    ? 'bg-gradient-to-br from-pink-400 to-purple-500'
                    : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                }`}>
                  {selectedVoice.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Selected: {selectedVoice.name}</p>
                  <p className="text-xs text-gray-500">{selectedVoice.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => playVoicePreview(selectedVoice.id, selectedVoice.previewUrl)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
                  playingVoice === selectedVoice.id
                    ? 'bg-mautic-blue text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {playingVoice === selectedVoice.id ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h4v12H6V6zm8 0h4v12h-4V6z" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play Preview
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
