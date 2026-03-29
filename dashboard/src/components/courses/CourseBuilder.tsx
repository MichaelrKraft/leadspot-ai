'use client';

import { useState } from 'react';

interface CourseBuilderProps {
  communityId: string;
  instructorId: string;
  onCourseCreated?: (course: {id: string; title: string}) => void;
}

interface ModuleBuilderLesson {
  id: number;
  title: string;
  content: string;
  videoUrl: string;
  videoDuration: number | null;
}

interface ModuleBuilder {
  id: number;
  title: string;
  description: string;
  lessons: ModuleBuilderLesson[];
}

export default function CourseBuilder({
  communityId,
  instructorId,
  onCourseCreated,
}: CourseBuilderProps) {
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Modules, 3: Settings
  const [saving, setSaving] = useState(false);

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('beginner');
  const [coverImage, setCoverImage] = useState('');

  // Modules
  const [modules, setModules] = useState<ModuleBuilder[]>([
    {
      id: Date.now(),
      title: '',
      description: '',
      lessons: [],
    },
  ]);

  // Settings
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState(0);
  const [isPublished, setIsPublished] = useState(false);

  const addModule = () => {
    setModules([
      ...modules,
      {
        id: Date.now(),
        title: '',
        description: '',
        lessons: [],
      },
    ]);
  };

  const updateModule = (index: number, field: keyof Omit<ModuleBuilder, 'id' | 'lessons'>, value: string) => {
    const updated = [...modules];
    updated[index][field] = value;
    setModules(updated);
  };

  const removeModule = (index: number) => {
    setModules(modules.filter((_, i) => i !== index));
  };

  const addLesson = (moduleIndex: number) => {
    const updated = [...modules];
    updated[moduleIndex].lessons.push({
      id: Date.now(),
      title: '',
      content: '',
      videoUrl: '',
      videoDuration: null,
    });
    setModules(updated);
  };

  const updateLesson = (moduleIndex: number, lessonIndex: number, field: keyof Omit<ModuleBuilderLesson, 'id'>, value: string | number | null) => {
    const updated = [...modules];
    updated[moduleIndex].lessons[lessonIndex][field] = value as never;
    setModules(updated);
  };

  const removeLesson = (moduleIndex: number, lessonIndex: number) => {
    const updated = [...modules];
    updated[moduleIndex].lessons.splice(lessonIndex, 1);
    setModules(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a course title');
      return;
    }

    setSaving(true);

    try {
      // Create course
      const courseResponse = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          communityId,
          title,
          description,
          instructorId,
          level,
          price: isFree ? 0 : price,
          isFree,
          isPublished,
          coverImage,
        }),
      });

      if (!courseResponse.ok) {
        throw new Error('Failed to create course');
      }

      const course = await courseResponse.json();

      // TODO: Create modules and lessons
      // This would require additional API endpoints for modules/lessons

      alert('Course created successfully!');
      if (onCourseCreated) {
        onCourseCreated(course);
      }

      // Reset form
      setTitle('');
      setDescription('');
      setLevel('beginner');
      setCoverImage('');
      setModules([{ id: Date.now(), title: '', description: '', lessons: [] }]);
      setStep(1);
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-4">
            <button
              onClick={() => setStep(s)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                step === s
                  ? 'bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] text-white'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-[#2a2a2a] text-[#a0a0a0]'
              }`}
            >
              {step > s ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                s
              )}
            </button>
            {s < 3 && <div className="w-16 h-1 bg-[#2a2a2a]" />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Course Information</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Course Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Introduction to Marketing Automation"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will students learn in this course?"
                rows={4}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white focus:border-[#00D9FF] focus:outline-none transition-colors"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Cover Image URL
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Next: Add Modules
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Modules & Lessons */}
      {step === 2 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Course Content</h2>

          <div className="space-y-6">
            {modules.map((module, moduleIdx) => (
              <div key={module.id} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Module {moduleIdx + 1}</h3>
                  {modules.length > 1 && (
                    <button
                      onClick={() => removeModule(moduleIdx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={module.title}
                    onChange={(e) => updateModule(moduleIdx, 'title', e.target.value)}
                    placeholder="Module title"
                    className="w-full px-4 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none"
                  />

                  <textarea
                    value={module.description}
                    onChange={(e) => updateModule(moduleIdx, 'description', e.target.value)}
                    placeholder="Module description (optional)"
                    rows={2}
                    className="w-full px-4 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none resize-none"
                  />

                  {/* Lessons */}
                  <div className="ml-4 space-y-3">
                    {module.lessons.map((lesson: ModuleBuilderLesson, lessonIdx: number) => (
                      <div key={lesson.id} className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm text-[#a0a0a0]">Lesson {lessonIdx + 1}</span>
                          <button
                            onClick={() => removeLesson(moduleIdx, lessonIdx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <input
                          type="text"
                          value={lesson.title}
                          onChange={(e) => updateLesson(moduleIdx, lessonIdx, 'title', e.target.value)}
                          placeholder="Lesson title"
                          className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none mb-2"
                        />

                        <input
                          type="url"
                          value={lesson.videoUrl}
                          onChange={(e) => updateLesson(moduleIdx, lessonIdx, 'videoUrl', e.target.value)}
                          placeholder="Video URL (optional)"
                          className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white placeholder-[#a0a0a0] focus:border-[#00D9FF] focus:outline-none"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => addLesson(moduleIdx)}
                      className="text-sm text-[#00D9FF] hover:text-cyan-400 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Lesson
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addModule}
              className="w-full py-3 border-2 border-dashed border-[#2a2a2a] rounded-lg text-[#a0a0a0] hover:border-[#00D9FF] hover:text-[#00D9FF] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Module
            </button>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 border border-[#2a2a2a] text-white rounded-lg hover:border-[#00D9FF] transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#00B8D4] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Next: Settings
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Settings */}
      {step === 3 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Course Settings</h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium mb-1">Free Course</div>
                <div className="text-sm text-[#a0a0a0]">Make this course available for free</div>
              </div>
              <button
                onClick={() => setIsFree(!isFree)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isFree ? 'bg-[#00D9FF]' : 'bg-[#2a2a2a]'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isFree ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {!isFree && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Price (USD)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value))}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white focus:border-[#00D9FF] focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium mb-1">Publish Course</div>
                <div className="text-sm text-[#a0a0a0]">Make this course visible to students</div>
              </div>
              <button
                onClick={() => setIsPublished(!isPublished)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isPublished ? 'bg-[#00D9FF]' : 'bg-[#2a2a2a]'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isPublished ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 border border-[#2a2a2a] text-white rounded-lg hover:border-[#00D9FF] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-[#00D9FF] to-[#a855f7] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Course
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
