'use client';

import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import { CourseLesson, LessonProgress } from '@/types/course';

interface CoursePlayerProps {
  lesson: CourseLesson | null;
  courseId: string;
  userId: string;
}

export default function CoursePlayer({ lesson, courseId, userId }: CoursePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const progressUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!lesson) return;

    // Fetch lesson progress
    fetchProgress();

    // Initialize video player if lesson has video
    if (lesson.videoUrl && videoRef.current) {
      const player = videojs(videoRef.current, {
        controls: true,
        fluid: true,
        preload: 'auto',
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        controlBar: {
          volumePanel: { inline: false },
          pictureInPictureToggle: true,
        },
      });

      playerRef.current = player;

      // Load video source
      player.src({
        src: lesson.videoUrl,
        type: 'video/mp4',
      });

      // Resume from last position
      player.ready(() => {
        if (progress?.watchedSeconds) {
          player.currentTime(progress.watchedSeconds);
        }
      });

      // Track progress every 5 seconds
      progressUpdateInterval.current = setInterval(() => {
        if (!player.paused()) {
          const currentTime = Math.floor(player.currentTime() || 0);
          updateProgress(currentTime);
        }
      }, 5000);

      // Track when video ends
      player.on('ended', () => {
        const duration = Math.floor(player.duration() || 0);
        updateProgress(duration);
      });

      return () => {
        if (progressUpdateInterval.current) {
          clearInterval(progressUpdateInterval.current);
        }
        if (player) {
          player.dispose();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const fetchProgress = async () => {
    if (!lesson) return;

    try {
      const response = await fetch(
        `/api/courses/${courseId}/lessons/${lesson.id}?userId=${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);
        setIsCompleted(data.progress?.isCompleted || false);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const updateProgress = async (watchedSeconds: number) => {
    if (!lesson) return;

    try {
      const response = await fetch(`/api/lessons/${lesson.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          watchedSeconds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);
        setIsCompleted(data.progress.isCompleted);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const markComplete = async () => {
    if (!lesson) return;

    const duration = lesson.videoDuration || 0;
    await updateProgress(duration);
  };

  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-[#2a2a2a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-[#a0a0a0]">Select a lesson to start learning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#0a0a0a]">
      {/* Video Player */}
      {lesson.videoUrl ? (
        <div className="bg-black">
          <div data-vjs-player>
            <video
              ref={videoRef}
              className="video-js vjs-big-play-centered"
              style={{ width: '100%', height: 'auto', aspectRatio: '16/9' }}
            />
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#141414] to-[#1a1a1a] p-12 text-center border-b border-[#2a2a2a]">
          <svg className="w-24 h-24 mx-auto text-[#00D9FF]/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-2xl font-semibold text-white mb-2">{lesson.title}</h2>
          <p className="text-[#a0a0a0]">Text-based lesson</p>
        </div>
      )}

      {/* Lesson Content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Progress Badge */}
        {isCompleted && (
          <div className="mb-6 flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Completed</span>
          </div>
        )}

        {/* Lesson Title */}
        <h1 className="text-3xl font-semibold text-white mb-6">{lesson.title}</h1>

        {/* Lesson Content */}
        {lesson.content && (
          <div
            className="prose prose-invert max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: lesson.content }}
          />
        )}

        {/* Mark Complete Button */}
        {!isCompleted && !lesson.videoUrl && (
          <button
            onClick={markComplete}
            className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Mark as Complete
          </button>
        )}

        {/* Resources Section */}
        <div className="mt-12 p-6 bg-[#141414] border border-[#2a2a2a] rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Lesson Resources</h3>
          <p className="text-[#a0a0a0] text-sm">
            Additional resources and downloadable materials will appear here.
          </p>
        </div>

        {/* Discussion Section */}
        <div className="mt-8 p-6 bg-[#141414] border border-[#2a2a2a] rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Discussion</h3>
          <p className="text-[#a0a0a0] text-sm">
            Ask questions and discuss this lesson with other students.
          </p>
        </div>
      </div>
    </div>
  );
}
