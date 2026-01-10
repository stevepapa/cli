/**
 * Variable Substitution Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  substituteVariables,
  validateVariables,
  hasVariables,
  describeVariables,
} from '../src/core/lib/variables.js';

describe('Variable Substitution', () => {
  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const content = 'Review {{language}} code';
      const vars = extractVariables(content);
      expect(vars).toEqual(['language']);
    });

    it('should extract multiple variables', () => {
      const content = 'Review {{language}} code for {{focus}} issues';
      const vars = extractVariables(content);
      expect(vars).toEqual(['language', 'focus']);
    });

    it('should extract variables with spaces', () => {
      const content = 'Review {{ language }} code for {{ focus }}';
      const vars = extractVariables(content);
      expect(vars).toEqual(['language', 'focus']);
    });

    it('should handle duplicate variables', () => {
      const content = '{{lang}} and {{lang}} again';
      const vars = extractVariables(content);
      expect(vars).toEqual(['lang']);
    });

    it('should handle no variables', () => {
      const content = 'Plain text with no variables';
      const vars = extractVariables(content);
      expect(vars).toEqual([]);
    });

    it('should handle variables with hyphens and underscores', () => {
      const content = '{{my-variable}} and {{another_var}}';
      const vars = extractVariables(content);
      expect(vars).toEqual(['my-variable', 'another_var']);
    });

    it('should ignore invalid patterns', () => {
      const content = '{single} {{}} {{valid}} { not valid }';
      const vars = extractVariables(content);
      expect(vars).toEqual(['valid']);
    });

    it('should ignore strict escaped placeholders', () => {
      const content = '{{!a}} {{a}} {{!b}}';
      const vars = extractVariables(content);
      expect(vars).toEqual(['a']);
    });
  });

  describe('substituteVariables', () => {
    it('should replace single variable', () => {
      const content = 'Review {{language}} code';
      const result = substituteVariables(content, { language: 'TypeScript' });
      expect(result).toBe('Review TypeScript code');
    });

    it('should replace multiple variables', () => {
      const content = 'Review {{language}} code for {{focus}} issues';
      const result = substituteVariables(content, {
        language: 'TypeScript',
        focus: 'security',
      });
      expect(result).toBe('Review TypeScript code for security issues');
    });

    it('should handle variables with spaces', () => {
      const content = 'Review {{ language }} code';
      const result = substituteVariables(content, { language: 'Go' });
      expect(result).toBe('Review Go code');
    });

    it('should leave unmatched variables unchanged', () => {
      const content = 'Review {{language}} code for {{focus}}';
      const result = substituteVariables(content, { language: 'Go' });
      expect(result).toBe('Review Go code for {{focus}}');
    });

    it('should handle duplicate variables', () => {
      const content = '{{lang}} and {{lang}} again';
      const result = substituteVariables(content, { lang: 'Rust' });
      expect(result).toBe('Rust and Rust again');
    });

    it('should handle empty vars object', () => {
      const content = 'Review {{language}} code';
      const result = substituteVariables(content, {});
      expect(result).toBe('Review {{language}} code');
    });

    it('should handle content with no variables', () => {
      const content = 'Plain text';
      const result = substituteVariables(content, { lang: 'Go' });
      expect(result).toBe('Plain text');
    });

    it('should not treat templated-looking variable values as placeholders', () => {
      const content = '{{foo}}';
      const result = substituteVariables(content, { foo: '{{hello}}', hello: 'X' });
      expect(result).toBe('{{hello}}');
    });

    it('should render strict escaped placeholders as literals and not substitute them in the same pass', () => {
      const content = '{{!a}} {{a}}';
      const result = substituteVariables(content, { a: '1' });
      expect(result).toBe('{{a}} 1');
    });

    it('should treat non-matching {{! sequences as ordinary text', () => {
      const content = 'Not escape: {{! a}} {{!a }} {{!}} {{!name';
      const result = substituteVariables(content, { a: '1', name: 'x' });
      expect(result).toBe('Not escape: {{! a}} {{!a }} {{!}} {{!name');
    });
  });

  describe('validateVariables', () => {
    it('should return missing variables', () => {
      const content = 'Review {{language}} code for {{focus}}';
      const missing = validateVariables(content, { language: 'Go' });
      expect(missing).toEqual(['focus']);
    });

    it('should return empty array when all provided', () => {
      const content = 'Review {{language}} code';
      const missing = validateVariables(content, { language: 'Go' });
      expect(missing).toEqual([]);
    });

    it('should return all variables when none provided', () => {
      const content = 'Review {{language}} for {{focus}}';
      const missing = validateVariables(content, {});
      expect(missing).toEqual(['language', 'focus']);
    });

    it('should return empty array for no variables', () => {
      const content = 'Plain text';
      const missing = validateVariables(content, {});
      expect(missing).toEqual([]);
    });
  });

  describe('hasVariables', () => {
    it('should return true for content with variables', () => {
      expect(hasVariables('{{language}}')).toBe(true);
      expect(hasVariables('Review {{lang}} code')).toBe(true);
    });

    it('should return false for content without variables', () => {
      expect(hasVariables('Plain text')).toBe(false);
      expect(hasVariables('{single}')).toBe(false);
    });
  });

  describe('describeVariables', () => {
    it('should describe single variable', () => {
      expect(describeVariables(['language'])).toBe('language');
    });

    it('should describe multiple variables', () => {
      expect(describeVariables(['language', 'focus'])).toBe('language, focus');
    });

    it('should describe no variables', () => {
      expect(describeVariables([])).toBe('none');
    });

    it('should describe many variables', () => {
      expect(describeVariables(['a', 'b', 'c'])).toBe('a, b, c');
    });
  });
});
