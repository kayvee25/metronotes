import { validateFileSize, validateSongStorage } from '../image-processing';

describe('validateFileSize', () => {
  it('returns null for image under 3MB', () => {
    expect(validateFileSize(2 * 1024 * 1024)).toBeNull();
  });

  it('returns null for image at exactly 3MB', () => {
    expect(validateFileSize(3 * 1024 * 1024)).toBeNull();
  });

  it('returns error string for image over 3MB', () => {
    const result = validateFileSize(3 * 1024 * 1024 + 1);
    expect(result).toContain('3MB');
  });

  it('returns null for PDF under 5MB', () => {
    expect(validateFileSize(4 * 1024 * 1024, 'pdf')).toBeNull();
  });

  it('returns error string for PDF over 5MB', () => {
    const result = validateFileSize(5 * 1024 * 1024 + 1, 'pdf');
    expect(result).toContain('5MB');
  });

  it('defaults to image limit when no type specified', () => {
    // 4MB should fail for image (3MB limit) but pass for PDF (5MB limit)
    expect(validateFileSize(4 * 1024 * 1024)).not.toBeNull();
    expect(validateFileSize(4 * 1024 * 1024, 'pdf')).toBeNull();
  });
});

describe('validateSongStorage', () => {
  it('returns null when adding file within 30MB total', () => {
    expect(validateSongStorage(10 * 1024 * 1024, 5 * 1024 * 1024)).toBeNull();
  });

  it('returns error string when exceeding 30MB total', () => {
    const result = validateSongStorage(25 * 1024 * 1024, 10 * 1024 * 1024);
    expect(result).toContain('30MB');
  });

  it('returns null at exactly 30MB', () => {
    expect(validateSongStorage(20 * 1024 * 1024, 10 * 1024 * 1024)).toBeNull();
  });
});
