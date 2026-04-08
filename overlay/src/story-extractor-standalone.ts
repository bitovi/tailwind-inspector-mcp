/**
 * Standalone entry point for createStoryExtractor.
 * Built as an IIFE bundle — exposes window.createStoryExtractor.
 */
import { createStoryExtractor } from './story-extractor';

(window as any).createStoryExtractor = createStoryExtractor;
