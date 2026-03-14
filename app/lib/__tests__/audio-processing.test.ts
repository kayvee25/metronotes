import { validateAudioFile, extractAudioDuration, formatDuration, formatFileSize } from '../audio-processing';
import { AUDIO } from '../constants';

describe('validateAudioFile', () => {
  it('returns null for a valid MP3 file', () => {
    const file = new File(['audio-data'], 'song.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    expect(validateAudioFile(file)).toBeNull();
  });

  it('rejects an invalid MIME type', () => {
    const file = new File(['data'], 'song.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'size', { value: 1024 });
    expect(validateAudioFile(file)).toBe('Only MP3 files are supported');
  });

  it('rejects a file exceeding the size limit', () => {
    const file = new File(['data'], 'song.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: AUDIO.MAX_AUDIO_SIZE + 1 });
    expect(validateAudioFile(file)).toBe('File too large (max 10MB)');
  });

  it('returns null for a file exactly at the size limit', () => {
    const file = new File(['data'], 'song.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: AUDIO.MAX_AUDIO_SIZE });
    expect(validateAudioFile(file)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats 60 seconds as 1:00', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatDuration(90)).toBe('1:30');
  });

  it('formats 3661 seconds as 61:01', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(59.9)).toBe('0:59');
  });

  it('pads single-digit seconds with leading zero', () => {
    expect(formatDuration(5)).toBe('0:05');
  });
});

describe('formatFileSize', () => {
  it('formats bytes below 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats large megabyte values (GB range stays as MB)', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.0 MB');
  });

  it('formats fractional KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

describe('extractAudioDuration', () => {
  it('decodes audio and returns duration', async () => {
    const mockAudioBuffer = { duration: 123.45 };
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer);

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        decodeAudioData: mockDecodeAudioData,
        close: mockClose,
      }))
    );

    const fakeArrayBuffer = new ArrayBuffer(8);
    const file = new File([fakeArrayBuffer], 'test.mp3', { type: 'audio/mpeg' });
    // jsdom File/Blob may lack arrayBuffer(), so polyfill
    file.arrayBuffer = () => Promise.resolve(fakeArrayBuffer);

    const duration = await extractAudioDuration(file);

    expect(duration).toBe(123.45);
    expect(mockDecodeAudioData).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('closes AudioContext even when decoding fails', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockDecodeAudioData = vi.fn().mockRejectedValue(new Error('decode error'));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        decodeAudioData: mockDecodeAudioData,
        close: mockClose,
      }))
    );

    const buf = new ArrayBuffer(8);
    const file = new File([buf], 'bad.mp3', { type: 'audio/mpeg' });
    file.arrayBuffer = () => Promise.resolve(buf);

    await expect(extractAudioDuration(file)).rejects.toThrow('decode error');
    expect(mockClose).toHaveBeenCalledOnce();
  });
});
